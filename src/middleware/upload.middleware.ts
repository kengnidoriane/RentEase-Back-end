import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter for images
const imageFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
  }
};

// File filter for documents
const documentFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only images, PDF, and Word documents are allowed'));
  }
};

// Multer configurations
export const uploadProfilePicture = multer({
  storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
}).single('profilePicture');

export const uploadVerificationDocument = multer({
  storage,
  fileFilter: documentFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
}).single('document');

export const uploadPropertyImages = multer({
  storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 10, // Maximum 10 files
  },
}).array('images', 10);

// Image processing middleware
export const processProfilePicture = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file) {
      next();
      return;
    }

    // Process image with Sharp
    const processedBuffer = await sharp(req.file.buffer)
      .resize(400, 400, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({
        quality: 85,
        progressive: true,
      })
      .toBuffer();

    // Generate filename
    const filename = `profile-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
    
    // Add processed image info to request
    req.processedImage = {
      buffer: processedBuffer,
      filename,
      mimetype: 'image/jpeg',
      size: processedBuffer.length,
    };

    logger.info(`Profile picture processed: ${filename}`);
    next();
  } catch (error) {
    logger.error('Error processing profile picture:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'IMAGE_PROCESSING_ERROR',
        message: 'Failed to process image',
        timestamp: new Date().toISOString(),
        path: req.path,
      },
    });
  }
};

export const processPropertyImages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      next();
      return;
    }

    const processedImages = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      
      // Process image with Sharp
      const processedBuffer = await sharp(file.buffer)
        .resize(1200, 800, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({
          quality: 85,
          progressive: true,
        })
        .toBuffer();

      // Generate filename
      const filename = `property-${Date.now()}-${i}-${Math.round(Math.random() * 1E9)}.jpg`;
      
      processedImages.push({
        buffer: processedBuffer,
        filename,
        mimetype: 'image/jpeg',
        size: processedBuffer.length,
        originalname: file.originalname,
      });
    }

    // Add processed images to request
    req.processedImages = processedImages;

    logger.info(`${processedImages.length} property images processed`);
    next();
  } catch (error) {
    logger.error('Error processing property images:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'IMAGE_PROCESSING_ERROR',
        message: 'Failed to process images',
        timestamp: new Date().toISOString(),
        path: req.path,
      },
    });
  }
};

// Error handling middleware for multer
export const handleUploadError = (error: any, req: Request, res: Response, next: NextFunction): void => {
  if (error instanceof multer.MulterError) {
    let message = 'File upload error';
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File size too large';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        break;
      default:
        message = error.message;
    }

    res.status(400).json({
      success: false,
      error: {
        code: 'UPLOAD_ERROR',
        message,
        timestamp: new Date().toISOString(),
        path: req.path,
      },
    });
    return;
  }

  if (error.message.includes('Only') && error.message.includes('allowed')) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_FILE_TYPE',
        message: error.message,
        timestamp: new Date().toISOString(),
        path: req.path,
      },
    });
    return;
  }

  next(error);
};

// Extend Express Request interface for processed files
declare global {
  namespace Express {
    interface Request {
      processedImage?: {
        buffer: Buffer;
        filename: string;
        mimetype: string;
        size: number;
      };
      processedImages?: Array<{
        buffer: Buffer;
        filename: string;
        mimetype: string;
        size: number;
        originalname: string;
      }>;
    }
  }
}