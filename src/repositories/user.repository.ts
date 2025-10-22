import { PrismaClient, User, UserType, VerificationDocument } from '@prisma/client';
import { prisma } from '@/config/database';

export class UserRepository {
  private db: PrismaClient;

  constructor() {
    this.db = prisma;
  }

  /**
   * Create a new user
   */
  async create(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
    userType: UserType;
    profilePicture?: string;
  }): Promise<User> {
    return this.db.user.create({
      data: userData,
    });
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({
      where: { email },
    });
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    return this.db.user.findUnique({
      where: { id },
    });
  }

  /**
   * Update user
   */
  async update(id: string, data: Partial<User>): Promise<User> {
    return this.db.user.update({
      where: { id },
      data,
    });
  }

  /**
   * Update user verification status
   */
  async updateVerificationStatus(id: string, isVerified: boolean): Promise<User> {
    return this.db.user.update({
      where: { id },
      data: { isVerified },
    });
  }

  /**
   * Update user password
   */
  async updatePassword(id: string, hashedPassword: string): Promise<User> {
    return this.db.user.update({
      where: { id },
      data: { password: hashedPassword },
    });
  }

  /**
   * Get user with verification documents
   */
  async findWithVerificationDocuments(id: string): Promise<(User & { verificationDocuments: VerificationDocument[] }) | null> {
    return this.db.user.findUnique({
      where: { id },
      include: {
        verificationDocuments: true,
      },
    });
  }

  /**
   * Create verification document
   */
  async createVerificationDocument(data: {
    userId: string;
    documentType: 'ID' | 'PROPERTY_OWNERSHIP' | 'PROOF_OF_ADDRESS';
    documentUrl: string;
  }): Promise<VerificationDocument> {
    return this.db.verificationDocument.create({
      data,
    });
  }

  /**
   * Get verification documents for user
   */
  async getVerificationDocuments(userId: string): Promise<VerificationDocument[]> {
    return this.db.verificationDocument.findMany({
      where: { userId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  /**
   * Update verification document status
   */
  async updateVerificationDocumentStatus(
    documentId: string,
    status: 'PENDING' | 'APPROVED' | 'REJECTED',
    rejectionReason?: string
  ): Promise<VerificationDocument> {
    return this.db.verificationDocument.update({
      where: { id: documentId },
      data: {
        status,
        rejectionReason: rejectionReason ?? null,
        reviewedAt: new Date(),
      },
    });
  }

  /**
   * Delete user (soft delete by setting isActive to false)
   */
  async softDelete(id: string): Promise<User> {
    return this.db.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Get all pending verification documents (admin only)
   */
  async getPendingVerificationDocuments(): Promise<(VerificationDocument & { user: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'userType'> })[]> {
    return this.db.verificationDocument.findMany({
      where: { status: 'PENDING' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            userType: true,
          },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  /**
   * Get dashboard statistics (admin only)
   */
  async getDashboardStats(): Promise<{
    totalUsers: number;
    totalTenants: number;
    totalLandlords: number;
    pendingVerifications: number;
    totalProperties: number;
  }> {
    const [
      totalUsers,
      totalTenants,
      totalLandlords,
      pendingVerifications,
      totalProperties,
    ] = await Promise.all([
      this.db.user.count({ where: { isActive: true } }),
      this.db.user.count({ where: { userType: 'TENANT', isActive: true } }),
      this.db.user.count({ where: { userType: 'LANDLORD', isActive: true } }),
      this.db.verificationDocument.count({ where: { status: 'PENDING' } }),
      this.db.property.count({ where: { isActive: true } }),
    ]);

    return {
      totalUsers,
      totalTenants,
      totalLandlords,
      pendingVerifications,
      totalProperties,
    };
  }

  /**
   * Get all users (admin only)
   */
  async findAll(page: number = 1, limit: number = 10): Promise<{ users: User[]; total: number }> {
    const skip = (page - 1) * limit;
    
    const [users, total] = await Promise.all([
      this.db.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.user.count(),
    ]);

    return { users, total };
  }
}