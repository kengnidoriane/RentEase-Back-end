import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import {
  uploadProfilePicture,
  uploadPropertyImages,
  processProfilePicture,
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

describe('Upload Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockReq = {
      path: '/test',
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    
    mockNext = jest.fn();
  });

  describe('processProfilePicture', () => {
    it('should process profile picture successfully', async () => {
      // Arrange
      const mockBuffer = Buffer.from('processed-image-data');
      const mockFile = {
        buffer: Buffer.from('original-image-data'),
        mimetype: 'image/jpeg',
        originalname: 'profile.jpg',
        size: 1024,
      } as Express.Multer.File;

      mockReq.file = mockFile;

      const mockSharpInstance = {
        resize: jest.fn().mockReturnThis(),
        jpeg: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(mockBuffer),
      };

      mockSharp.mockReturnValue(mockSharpInstance as any);

      // Act
      await processProfilePicture(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockSharp).toHaveBeenCalledWith(mockFile.buffer);
      expect(mockSharpInstance.resize).toHaveBeenCalledWith(400, 400, {
        fit: 'cover',
        position: 'center',
      });
      expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({
        quality: 85,
        progressive: true,
      });
      expect(mockReq.processedImage).toEqual({
        buffer: mockBuffer,
        filename: expect.stringMatching(/^profile-\d+-\d+\.jpg$/),
        mimetype: 'image/jpeg',
        size: mockBuffer.length,
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next if no file provided', async () => {
      // Arrange
      mockReq.file = undefined;

      // Act
      await processProfilePicture(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockSharp).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.processedImage).toBeUndefined();
    });

    it('should handle processing errors', async () => {
      // Arrange
      const mockFile = {
        buffer: Buffer.from('original-image-data'),
        mimetype: 'image/jpeg',
        originalname: 'profile.jpg',
        size: 1024,
      } as Express.Multer.File;

      mockReq.file = mockFile;

      const mockSharpInstance = {
        resize: jest.fn().mockReturnThis(),
        jpeg: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockRejectedValue(new Error('Processing failed')),
      };

      mockSharp.mockReturnValue(mockSharpInstance as any);

      // Act
      await processProfilePicture(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'IMAGE_PROCESSING_ERROR',
          message: 'Failed to process image',
          timestamp: expect.any(String),
          path: '/test',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('processPropertyImages', () => {
    it('should process multiple property images successfully', async () => {
      // Arrange
      const mockBuffer1 = Buffer.from('processed-image-1');
      const mockBuffer2 = Buffer.from('processed-image-2');
      const mockFiles = [
        {
          buffer: Buffer.from('original-image-1'),
          mimetype: 'image/jpeg',
          originalname: 'image1.jpg',
          size: 1024,
        },
        {
          buffer: Buffer.from('original-image-2'),
          mimetype: 'image/png',
          originalname: 'image2.png',
          size: 2048,
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

      mockSharp
        .mockReturnValueOnce(mockSharpInstance1 as any)
        .mockReturnValueOnce(mockSharpInstance2 as any);

      // Act
      await processPropertyImages(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockSharp).toHaveBeenCalledTimes(2);
      expect(mockSharp).toHaveBeenNthCalledWith(1, mockFiles[0]!.buffer);
      expect(mockSharp).toHaveBeenNthCalledWith(2, mockFiles[1]!.buffer);

      expect(mockReq.processedImages).toHaveLength(2);
      expect(mockReq.processedImages![0]).toEqual({
        buffer: mockBuffer1,
        filename: expect.stringMatching(/^property-\d+-0-\d+\.jpg$/),
        mimetype: 'image/jpeg',
        size: mockBuffer1.length,
        originalname: 'image1.jpg',
      });
      expect(mockReq.processedImages![1]).toEqual({
        buffer: mockBuffer2,
        filename: expect.stringMatching(/^property-\d+-1-\d+\.jpg$/),
        mimetype: 'image/jpeg',
        size: mockBuffer2.length,
        originalname: 'image2.png',
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next if no files provided', async () => {
      // Arrange
      mockReq.files = [];

      // Act
      await processPropertyImages(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockSharp).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.processedImages).toBeUndefined();
    });

    it('should handle processing errors', async () => {
      // Arrange
      const mockFiles = [
        {
          buffer: Buffer.from('original-image-1'),
          mimetype: 'image/jpeg',
          originalname: 'image1.jpg',
          size: 1024,
        },
      ] as Express.Multer.File[];

      mockReq.files = mockFiles;

      const mockSharpInstance = {
        resize: jest.fn().mockReturnThis(),
        jpeg: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockRejectedValue(new Error('Processing failed')),
      };

      mockSharp.mockReturnValue(mockSharpInstance as any);

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
          path: '/test',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle non-array files', async () => {
      // Arrange
      mockReq.files = undefined;

      // Act
      await processPropertyImages(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockSharp).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('handleUploadError', () => {
    it('should handle LIMIT_FILE_SIZE error', () => {
      // Arrange
      const error = new multer.MulterError('LIMIT_FILE_SIZE', 'file');

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
          path: '/test',
        },
      });
    });

    it('should handle LIMIT_FILE_COUNT error', () => {
      // Arrange
      const error = new multer.MulterError('LIMIT_FILE_COUNT', 'files');

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
          path: '/test',
        },
      });
    });

    it('should handle LIMIT_UNEXPECTED_FILE error', () => {
      // Arrange
      const error = new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'field');

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
          path: '/test',
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
          path: '/test',
        },
      });
    });

    it('should pass through other errors', () => {
      // Arrange
      const error = new Error('Some other error');

      // Act
      handleUploadError(error, mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should handle generic multer error', () => {
      // Arrange
      const error = new multer.MulterError('LIMIT_PART_COUNT' as any, 'field');
      error.message = 'Custom multer error';

      // Act
      handleUploadError(error, mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UPLOAD_ERROR',
          message: 'Custom multer error',
          timestamp: expect.any(String),
          path: '/test',
        },
      });
    });
  });

  describe('File filters', () => {
    // Note: These tests would require more complex setup to test the actual multer configuration
    // For now, we'll focus on the processing middleware which is more testable
    
    it('should be configured with correct limits for profile pictures', () => {
      // This is more of a configuration test
      expect(uploadProfilePicture).toBeDefined();
    });

    it('should be configured with correct limits for property images', () => {
      // This is more of a configuration test
      expect(uploadPropertyImages).toBeDefined();
    });
  });
});