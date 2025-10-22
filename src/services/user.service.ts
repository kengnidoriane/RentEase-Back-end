import { User, VerificationDocument } from '@prisma/client';
import { UserRepository } from '@/repositories/user.repository';
import { AuthUtils } from '@/utils/auth';
import { logger } from '@/utils/logger';
import { UpdateProfileRequest, ChangePasswordRequest } from '@/types/user.types';

export class UserService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string): Promise<Omit<User, 'password'>> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.isActive) {
      throw new Error('Account has been deactivated');
    }

    // Remove password from response
    const { password, ...userProfile } = user;
    return userProfile;
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: UpdateProfileRequest): Promise<Omit<User, 'password'>> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.isActive) {
      throw new Error('Account has been deactivated');
    }

    const updatedUser = await this.userRepository.update(userId, {
      ...data,
      updatedAt: new Date(),
    });

    logger.info(`Profile updated for user: ${userId}`);

    // Remove password from response
    const { password, ...userProfile } = updatedUser;
    return userProfile;
  }

  /**
   * Update profile picture
   */
  async updateProfilePicture(userId: string, profilePictureUrl: string): Promise<Omit<User, 'password'>> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.isActive) {
      throw new Error('Account has been deactivated');
    }

    const updatedUser = await this.userRepository.update(userId, {
      profilePicture: profilePictureUrl,
      updatedAt: new Date(),
    });

    logger.info(`Profile picture updated for user: ${userId}`);

    // Remove password from response
    const { password, ...userProfile } = updatedUser;
    return userProfile;
  }

  /**
   * Change password
   */
  async changePassword(userId: string, data: ChangePasswordRequest): Promise<{ message: string }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.isActive) {
      throw new Error('Account has been deactivated');
    }

    // Verify current password
    const isCurrentPasswordValid = await AuthUtils.comparePassword(data.currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Check if new password is different from current
    const isSamePassword = await AuthUtils.comparePassword(data.newPassword, user.password);
    if (isSamePassword) {
      throw new Error('New password must be different from current password');
    }

    // Hash new password and update
    const hashedPassword = await AuthUtils.hashPassword(data.newPassword);
    await this.userRepository.updatePassword(userId, hashedPassword);

    logger.info(`Password changed for user: ${userId}`);

    return { message: 'Password changed successfully' };
  }

  /**
   * Upload verification document
   */
  async uploadVerificationDocument(
    userId: string,
    documentType: 'ID' | 'PROPERTY_OWNERSHIP' | 'PROOF_OF_ADDRESS',
    documentUrl: string
  ): Promise<VerificationDocument> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.isActive) {
      throw new Error('Account has been deactivated');
    }

    // Only landlords can upload property ownership documents
    if (documentType === 'PROPERTY_OWNERSHIP' && user.userType !== 'LANDLORD') {
      throw new Error('Only landlords can upload property ownership documents');
    }

    const document = await this.userRepository.createVerificationDocument({
      userId,
      documentType,
      documentUrl,
    });

    logger.info(`Verification document uploaded for user: ${userId}, type: ${documentType}`);

    return document;
  }

  /**
   * Get verification documents
   */
  async getVerificationDocuments(userId: string): Promise<VerificationDocument[]> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.isActive) {
      throw new Error('Account has been deactivated');
    }

    return this.userRepository.getVerificationDocuments(userId);
  }

  /**
   * Get verification status
   */
  async getVerificationStatus(userId: string): Promise<{
    isEmailVerified: boolean;
    isDocumentVerified: boolean;
    requiredDocuments: string[];
    uploadedDocuments: VerificationDocument[];
  }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.isActive) {
      throw new Error('Account has been deactivated');
    }

    const documents = await this.userRepository.getVerificationDocuments(userId);
    
    // Define required documents based on user type
    const requiredDocuments = user.userType === 'LANDLORD' 
      ? ['ID', 'PROPERTY_OWNERSHIP'] 
      : ['ID'];

    // Check if all required documents are approved
    const approvedDocuments = documents.filter(doc => doc.status === 'APPROVED');
    const approvedDocumentTypes = approvedDocuments.map(doc => doc.documentType);
    const isDocumentVerified = requiredDocuments.every(type => 
      approvedDocumentTypes.includes(type as any)
    );

    return {
      isEmailVerified: user.isVerified,
      isDocumentVerified,
      requiredDocuments,
      uploadedDocuments: documents,
    };
  }

  /**
   * Delete user account (soft delete)
   */
  async deleteAccount(userId: string): Promise<{ message: string }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    await this.userRepository.softDelete(userId);

    logger.info(`User account deleted: ${userId}`);

    return { message: 'Account deleted successfully' };
  }

  /**
   * Generate new avatar (if user wants to change from uploaded picture back to generated)
   */
  async generateNewAvatar(userId: string): Promise<Omit<User, 'password'>> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.isActive) {
      throw new Error('Account has been deactivated');
    }

    const newAvatarUrl = AuthUtils.generateAvatarUrl(user.firstName);
    
    const updatedUser = await this.userRepository.update(userId, {
      profilePicture: newAvatarUrl,
      updatedAt: new Date(),
    });

    logger.info(`New avatar generated for user: ${userId}`);

    // Remove password from response
    const { password, ...userProfile } = updatedUser;
    return userProfile;
  }
}