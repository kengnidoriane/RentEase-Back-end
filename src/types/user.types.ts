export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  userType: 'TENANT' | 'LANDLORD' | 'ADMIN';
  profilePicture?: string;
  isVerified: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface VerificationDocument {
  id: string;
  documentType: 'ID' | 'PROPERTY_OWNERSHIP' | 'PROOF_OF_ADDRESS';
  documentUrl: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  uploadedAt: Date;
  reviewedAt?: Date;
}

export interface UploadDocumentRequest {
  documentType: 'ID' | 'PROPERTY_OWNERSHIP' | 'PROOF_OF_ADDRESS';
}