import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import {
  processPropertyImages,
  handleUploadError,
} from '../../middleware/upload.middleware';

// Mock sharp
jest.mock('sharp');
const mockSharp = sharp as jest.MockedFunction<typeof sharp>;

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Property Image Upload Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockReq = {
      path: '/api/properties/123/images',
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    
    mockNext = jest.fn();
  });

  describe('processPropertyImages', () => {
    it('should process multiple property images with different formats', async () => {
      // Arrange
      const mockBuffer1 = Buffer.from('processed-image-1');
      const mockBuffer2 = Buffer.from('processed-image-2');
      const mockBuffer3 = Buffer.from('processed-image-3');
      
      const mockFiles = [
        {
          buffer: Buffer.from('original-jpeg'),
          mimetype: 'image/jpeg',
          originalname: 'living-room.jpg',
          size: 1024,
        },
        {
          buffer: Buffer.from('original-png'),
          mimetype: 'image/png',
          originalname: 'kitchen.png',
          size: 2048,
        },
        {
          buffer: Buffer.from('original-webp'),
          mimetype: 'image/webp',
          originalname: 'bedroom.webp',
          size: 1536,
        },
      ] as Express.Multer.File[];

      mockReq.files = mockFiles;

      const mockSharpInstance1 = {
        resize: jest.fn().mockReturnThis(),
        jpeg: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(mockBuffer1),
      };

      const mockSharpInstance2 = {
        resize: jest.fn().mockReturnThis(),
        jpeg: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(mockBuffer2),
      };

      const mockSharpInstance3 = {
        resize: jest.fn().mockReturnThis(),
        jpeg: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(mockBuffer3),
      };

      mockSharp
        .mockReturnValueOnce(mockSharpInstance1 as any)
        .mockReturnValueOnce(mockSharpInstance2 as any)
        .mockReturnValueOnce(mockSharpInstance3 as any);

      // Act
      await processPropertyImages(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockSharp).toHaveBeenCalledTimes(3);
      expect(mockSharp).toHaveBeenNthCalledWith(1, mockFiles[0]!.buffer);
      expect(mockSharp).toHaveBeenNthCalledWith(2, mockFiles[1]!.buffer);
      expect(mockSharp).toHaveBeenNthCalledWith(3, mockFiles[2]!.buffer);

      // Verify resize parameters for property images
      expect(mockSharpInstance1.resize).toHaveBeenCalledWith(1200, 800, {
        fit: 'cover',
        position: 'center',
      });
      expect(mockSharpInstance2.resize).toHaveBeenCalledWith(1200, 800, {
        fit: 'cover',
        position: 'center',
      });
      expect(mockSharpInstance3.resize).toHaveBeenCalledWith(1200, 800, {
        fit: 'cover',
        position: 'center',
      });

      // Verify JPEG conversion with quality settings
      expect(mockSharpInstance1.jpeg).toHaveBeenCalledWith({
        quality: 85,
        progressive: true,
      });
      expect(mockSharpInstance2.jpeg).toHaveBeenCalledWith({
        quality: 85,
        progressive: true,
      });
      expect(mockSharpInstance3.jpeg).toHaveBeenCalledWith({
        quality: 85,
        progressive: true,
      });

      expect(mockReq.processedImages).toHaveLength(3);
      expect(mockReq.processedImages![0]).toEqual({
        buffer: mockBuffer1,
        filename: expect.stringMatching(/^property-\d+-0-\d+\.jpg$/),
        mimetype: 'image/jpeg',
        size: mockBuffer1.length,
        originalname: 'living-room.jpg',
      });
      expect(mockReq.processedImages![1]).toEqual({
        buffer: mockBuffer2,
        filename: expect.stringMatching(/^property-\d+-1-\d+\.jpg$/),
        mimetype: 'image/jpeg',
        size: mockBuffer2.length,
        originalname: 'kitchen.png',
      });
      expect(mockReq.processedImages![2]).toEqual({
        buffer: mockBuffer3,
        filename: expect.stringMatching(/^property-\d+-2-\d+\.jpg$/),
        mimetype: 'image/jpeg',
        size: mockBuffer3.length,
        originalname: 'bedroom.webp',
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle maximum file count (10 images)', async () => {
      // Arrange
      const mockFiles = Array.from({ length: 10 }, (_, i) => ({
        buffer: Buffer.from(`original-image-${i}`),
        mimetype: 'image/jpeg',
        originalname: `image-${i}.jpg`,
        size: 1024,
      })) as Express.Multer.File[];

      mockReq.files = mockFiles;

      const mockBuffers = Array.from({ length: 10 }, (_, i) => Buffer.from(`processed-image-${i}`));

      mockBuffers.forEach((buffer) => {
        const mockSharpInstance = {
          resize: jest.fn().mockReturnThis(),
          jpeg: jest.fn().mockReturnThis(),
          toBuffer: jest.fn().mockResolvedValue(buffer),
        };
        mockSharp.mockReturnValueOnce(mockSharpInstance as any);
      });

      // Act
      await processPropertyImages(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockSharp).toHaveBeenCalledTimes(10);
      expect(mockReq.processedImages).toHaveLength(10);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle large image files', async () => {
      // Arrange
      const largeImageBuffer = Buffer.alloc(5 * 1024 * 1024); // 5MB
      const mockFiles = [
        {
          buffer: largeImageBuffer,
          mimetype: 'image/jpeg',
          originalname: 'large-image.jpg',
          size: largeImageBuffer.length,
        },
      ] as Express.Multer.File[];

      mockReq.files = mockFiles;

      const processedBuffer = Buffer.from('processed-large-image');
      const mockSharpInstance = {
        resize: jest.fn().mockReturnThis(),
        jpeg: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(processedBuffer),
      };

      mockSharp.mockReturnValue(mockSharpInstance as any);

      // Act
      await processPropertyImages(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockSharp).toHaveBeenCalledWith(largeImageBuffer);
      expect(mockSharpInstance.resize).toHaveBeenCalledWith(1200, 800, {
        fit: 'cover',
        position: 'center',
      });
      expect(mockReq.processedImages).toHaveLength(1);
      expect(mockReq.processedImages![0]!.size).toBe(processedBuffer.length);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle processing errors for individual images', async () => {
      // Arrange
      const mockFiles = [
        {
          buffer: Buffer.from('good-image'),
          mimetype: 'image/jpeg',
          originalname: 'good.jpg',
          size: 1024,
        },
        {
          buffer: Buffer.from('corrupted-image'),
          mimetype: 'image/jpeg',
          originalname: 'corrupted.jpg',
          size: 1024,
        },
      ] as Express.Multer.File[];

      mockReq.files = mockFiles;

      const mockSharpInstance1 = {
        resize: jest.fn().mockReturnThis(),
        jpeg: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(Buffer.from('processed-good')),
      };

      const mockSharpInstance2 = {
        resize: jest.fn().mockReturnThis(),
        jpeg: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockRejectedValue(new Error('Corrupted image data')),
      };

      mockSharp
        .mockReturnValueOnce(mockSharpInstance1 as any)
        .mockReturnValueOnce(mockSharpInstance2 as any);

      // Act
      await processPropertyImages(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'IMAGE_PROCESSING_ERROR',
          message: 'Failed to process images',
          timestamp: expect.any(String),
          path: '/api/properties/123/images',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle empty files array', async () => {
      // Arrange
      mockReq.files = [];

      // Act
      await processPropertyImages(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockSharp).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.processedImages).toBeUndefined();
    });

    it('should handle undefined files', async () => {
      // Arrange
      mockReq.files = undefined;

      // Act
      await processPropertyImages(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockSharp).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.processedImages).toBeUndefined();
    });

    it('should generate unique filenames for concurrent uploads', async () => {
      // Arrange
      const mockFiles = [
        {
          buffer: Buffer.from('image1'),
          mimetype: 'image/jpeg',
          originalname: 'same-name.jpg',
          size: 1024,
        },
        {
          buffer: Buffer.from('image2'),
          mimetype: 'image/jpeg',
          originalname: 'same-name.jpg',
          size: 1024,
        },
      ] as Express.Multer.File[];

      mockReq.files = mockFiles;

      const mockSharpInstance = {
        resize: jest.fn().mockReturnThis(),
        jpeg: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(Buffer.from('processed')),
      };

      mockSharp.mockReturnValue(mockSharpInstance as any);

      // Act
      await processPropertyImages(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockReq.processedImages).toHaveLength(2);
      expect(mockReq.processedImages![0]!.filename).not.toBe(mockReq.processedImages![1]!.filename);
      expect(mockReq.processedImages![0]!.filename).toMatch(/^property-\d+-0-\d+\.jpg$/);
      expect(mockReq.processedImages![1]!.filename).toMatch(/^property-\d+-1-\d+\.jpg$/);
    });

    it('should preserve original filename in metadata', async () => {
      // Arrange
      const mockFiles = [
        {
          buffer: Buffer.from('image'),
          mimetype: 'image/png',
          originalname: 'beautiful-sunset.png',
          size: 1024,
        },
      ] as Express.Multer.File[];

      mockReq.files = mockFiles;

      const mockSharpInstance = {
        resize: jest.fn().mockReturnThis(),
        jpeg: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(Buffer.from('processed')),
      };

      mockSharp.mockReturnValue(mockSharpInstance as any);

      // Act
      await processPropertyImages(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockReq.processedImages![0]!.originalname).toBe('beautiful-sunset.png');
      expect(mockReq.processedImages![0]!.filename).toMatch(/^property-\d+-0-\d+\.jpg$/);
      expect(mockReq.processedImages![0]!.mimetype).toBe('image/jpeg'); // Converted to JPEG
    });
  });

  describe('File upload error handling', () => {
    it('should handle file size limit exceeded', () => {
      // Arrange
      const error = new multer.MulterError('LIMIT_FILE_SIZE', 'images');

      // Act
      handleUploadError(error, mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UPLOAD_ERROR',
          message: 'File size too large',
          timestamp: expect.any(String),
          path: '/api/properties/123/images',
        },
      });
    });

    it('should handle too many files error', () => {
      // Arrange
      const error = new multer.MulterError('LIMIT_FILE_COUNT', 'images');

      // Act
      handleUploadError(error, mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UPLOAD_ERROR',
          message: 'Too many files',
          timestamp: expect.any(String),
          path: '/api/properties/123/images',
        },
      });
    });

    it('should handle invalid file type error', () => {
      // Arrange
      const error = new Error('Only JPEG, PNG, and WebP images are allowed');

      // Act
      handleUploadError(error, mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: 'Only JPEG, PNG, and WebP images are allowed',
          timestamp: expect.any(String),
          path: '/api/properties/123/images',
        },
      });
    });

    it('should handle unexpected file field error', () => {
      // Arrange
      const error = new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'wrongField');

      // Act
      handleUploadError(error, mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UPLOAD_ERROR',
          message: 'Unexpected file field',
          timestamp: expect.any(String),
          path: '/api/properties/123/images',
        },
      });
    });
  });

  describe('Image quality and optimization', () => {
    it('should apply correct image optimization settings', async () => {
      // Arrange
      const mockFiles = [
        {
          buffer: Buffer.from('high-quality-image'),
          mimetype: 'image/png',
          originalname: 'high-res.png',
          size: 3 * 1024 * 1024, // 3MB
        },
      ] as Express.Multer.File[];

      mockReq.files = mockFiles;

      const mockSharpInstance = {
        resize: jest.fn().mockReturnThis(),
        jpeg: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(Buffer.from('optimized-image')),
      };

      mockSharp.mockReturnValue(mockSharpInstance as any);

      // Act
      await processPropertyImages(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockSharpInstance.resize).toHaveBeenCalledWith(1200, 800, {
        fit: 'cover',
        position: 'center',
      });
      expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({
        quality: 85,
        progressive: true,
      });
    });

    it('should handle different aspect ratios correctly', async () => {
      // Arrange - Test with a very wide image
      const mockFiles = [
        {
          buffer: Buffer.from('wide-panoramic-image'),
          mimetype: 'image/jpeg',
          originalname: 'panorama.jpg',
          size: 2048,
        },
      ] as Express.Multer.File[];

      mockReq.files = mockFiles;

      const mockSharpInstance = {
        resize: jest.fn().mockReturnThis(),
        jpeg: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(Buffer.from('resized-image')),
      };

      mockSharp.mockReturnValue(mockSharpInstance as any);

      // Act
      await processPropertyImages(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockSharpInstance.resize).toHaveBeenCalledWith(1200, 800, {
        fit: 'cover', // Should crop to maintain aspect ratio
        position: 'center', // Should center the crop
      });
    });
  });
});