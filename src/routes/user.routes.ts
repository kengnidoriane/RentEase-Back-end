import { Router } from 'express';
import { UserController } from '@/controllers/user.controller';
import { validateRequest } from '@/middleware/validation.middleware';
import { authenticate } from '@/middleware/auth.middleware';
import {
  uploadProfilePicture,
  uploadVerificationDocument,
  processProfilePicture,
  handleUploadError,
} from '@/middleware/upload.middleware';
import {
  updateProfileSchema,
  changePasswordSchema,
  uploadDocumentSchema,
} from '@/utils/validation';

const router = Router();
const userController = new UserController();

// All user routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get('/profile', userController.getProfile);

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 minLength: 2
 *               lastName:
 *                 type: string
 *                 minLength: 2
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.put('/profile', validateRequest(updateProfileSchema), userController.updateProfile);

/**
 * @swagger
 * /api/users/profile/picture:
 *   post:
 *     summary: Upload profile picture
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               profilePicture:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile picture updated successfully
 *       400:
 *         description: Invalid file or upload error
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/profile/picture',
  uploadProfilePicture,
  handleUploadError,
  processProfilePicture,
  userController.uploadProfilePicture
);

/**
 * @swagger
 * /api/users/profile/avatar:
 *   post:
 *     summary: Generate new avatar
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: New avatar generated successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/profile/avatar', userController.generateAvatar);

/**
 * @swagger
 * /api/users/change-password:
 *   put:
 *     summary: Change user password
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid current password or validation error
 *       401:
 *         description: Unauthorized
 */
router.put('/change-password', validateRequest(changePasswordSchema), userController.changePassword);

/**
 * @swagger
 * /api/users/verification/documents:
 *   post:
 *     summary: Upload verification document
 *     tags: [User Verification]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - document
 *               - documentType
 *             properties:
 *               document:
 *                 type: string
 *                 format: binary
 *               documentType:
 *                 type: string
 *                 enum: [ID, PROPERTY_OWNERSHIP, PROOF_OF_ADDRESS]
 *     responses:
 *       201:
 *         description: Document uploaded successfully
 *       400:
 *         description: Invalid file or validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (e.g., tenant trying to upload property ownership)
 */
router.post(
  '/verification/documents',
  uploadVerificationDocument,
  handleUploadError,
  validateRequest(uploadDocumentSchema),
  userController.uploadVerificationDocument
);

/**
 * @swagger
 * /api/users/verification/documents:
 *   get:
 *     summary: Get user verification documents
 *     tags: [User Verification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of verification documents
 *       401:
 *         description: Unauthorized
 */
router.get('/verification/documents', userController.getVerificationDocuments);

/**
 * @swagger
 * /api/users/verification/status:
 *   get:
 *     summary: Get user verification status
 *     tags: [User Verification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification status information
 *       401:
 *         description: Unauthorized
 */
router.get('/verification/status', userController.getVerificationStatus);

/**
 * @swagger
 * /api/users/account:
 *   delete:
 *     summary: Delete user account
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *       401:
 *         description: Unauthorized
 */
router.delete('/account', userController.deleteAccount);

export default router;