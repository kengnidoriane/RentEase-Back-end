import { Router } from 'express';
import { AdminController } from '@/controllers/admin.controller';
import { authenticateAdmin, logAdminAction } from '@/middleware/admin-auth.middleware';
import { z } from 'zod';
import { validateRequest, validateParams } from '@/middleware/validation.middleware';

const router = Router();
const adminController = new AdminController();

// All admin routes require admin authentication with logging
router.use(authenticateAdmin);

// Validation schemas
const userIdParamsSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

const documentIdParamsSchema = z.object({
  documentId: z.string().min(1, 'Document ID is required'),
});

const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
});

const reviewDocumentSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().optional(),
});

const propertyIdParamsSchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
});

const rejectPropertySchema = z.object({
  rejectionReason: z.string().min(1, 'Rejection reason is required'),
});

const auditTrailParamsSchema = z.object({
  targetType: z.string().min(1, 'Target type is required'),
  targetId: z.string().min(1, 'Target ID is required'),
});

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Get admin dashboard statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/dashboard', adminController.getDashboardStats);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users with pagination
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of users per page
 *     responses:
 *       200:
 *         description: List of users with pagination
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/users', adminController.getAllUsers);

/**
 * @swagger
 * /api/admin/users/{userId}:
 *   get:
 *     summary: Get user by ID with verification documents
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details with verification documents
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: User not found
 */
router.get('/users/:userId', validateParams(userIdParamsSchema), adminController.getUserById);

/**
 * @swagger
 * /api/admin/users/{userId}/status:
 *   put:
 *     summary: Update user status (activate/deactivate)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isActive
 *             properties:
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User status updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: User not found
 */
router.put(
  '/users/:userId/status',
  validateParams(userIdParamsSchema),
  validateRequest(updateUserStatusSchema),
  adminController.updateUserStatus
);

/**
 * @swagger
 * /api/admin/verification/documents:
 *   get:
 *     summary: Get all pending verification documents
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending verification documents
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/verification/documents', adminController.getPendingVerificationDocuments);

/**
 * @swagger
 * /api/admin/verification/documents/{documentId}/review:
 *   put:
 *     summary: Review verification document (approve/reject)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [APPROVED, REJECTED]
 *               rejectionReason:
 *                 type: string
 *                 description: Required when status is REJECTED
 *     responses:
 *       200:
 *         description: Document reviewed successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Document not found
 */
router.put(
  '/verification/documents/:documentId/review',
  validateParams(documentIdParamsSchema),
  validateRequest(reviewDocumentSchema),
  logAdminAction('DOCUMENT_REVIEWED', 'DOCUMENT'),
  adminController.reviewVerificationDocument
);

/**
 * @swagger
 * /api/admin/properties/pending:
 *   get:
 *     summary: Get all properties pending verification
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of properties pending verification
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/properties/pending', adminController.getPendingProperties);

/**
 * @swagger
 * /api/admin/properties/{propertyId}:
 *   get:
 *     summary: Get property by ID for verification
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *         description: Property ID
 *     responses:
 *       200:
 *         description: Property details
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Property not found
 */
router.get('/properties/:propertyId', validateParams(propertyIdParamsSchema), adminController.getPropertyById);

/**
 * @swagger
 * /api/admin/properties/{propertyId}/approve:
 *   put:
 *     summary: Approve property
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *         description: Property ID
 *     responses:
 *       200:
 *         description: Property approved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Property not found
 */
router.put(
  '/properties/:propertyId/approve',
  validateParams(propertyIdParamsSchema),
  logAdminAction('PROPERTY_APPROVED', 'PROPERTY'),
  adminController.approveProperty
);

/**
 * @swagger
 * /api/admin/properties/{propertyId}/reject:
 *   put:
 *     summary: Reject property
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *         description: Property ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rejectionReason
 *             properties:
 *               rejectionReason:
 *                 type: string
 *                 description: Reason for rejecting the property
 *     responses:
 *       200:
 *         description: Property rejected successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Property not found
 */
router.put(
  '/properties/:propertyId/reject',
  validateParams(propertyIdParamsSchema),
  validateRequest(rejectPropertySchema),
  logAdminAction('PROPERTY_REJECTED', 'PROPERTY'),
  adminController.rejectProperty
);

/**
 * @swagger
 * /api/admin/audit/logs:
 *   get:
 *     summary: Get admin activity logs
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of logs per page
 *       - in: query
 *         name: adminId
 *         schema:
 *           type: string
 *         description: Filter by admin ID
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action type
 *       - in: query
 *         name: targetType
 *         schema:
 *           type: string
 *         description: Filter by target type
 *       - in: query
 *         name: targetId
 *         schema:
 *           type: string
 *         description: Filter by target ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by end date
 *     responses:
 *       200:
 *         description: Admin activity logs with pagination and summary
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/audit/logs', adminController.getActivityLogs);

/**
 * @swagger
 * /api/admin/audit/summary:
 *   get:
 *     summary: Get activity summary for dashboard
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *         description: Number of days to include in summary (default 30)
 *     responses:
 *       200:
 *         description: Activity summary with statistics
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/audit/summary', adminController.getActivitySummary);

/**
 * @swagger
 * /api/admin/audit/trail/{targetType}/{targetId}:
 *   get:
 *     summary: Get audit trail for specific target
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: targetType
 *         required: true
 *         schema:
 *           type: string
 *         description: Target type (USER, PROPERTY, DOCUMENT)
 *       - in: path
 *         name: targetId
 *         required: true
 *         schema:
 *           type: string
 *         description: Target ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 500
 *         description: Maximum number of audit entries (default 100)
 *     responses:
 *       200:
 *         description: Audit trail for the specified target
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get(
  '/audit/trail/:targetType/:targetId',
  validateParams(auditTrailParamsSchema),
  adminController.getTargetAuditTrail
);

export default router;