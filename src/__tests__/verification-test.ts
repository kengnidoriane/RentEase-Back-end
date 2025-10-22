import { UserService } from '../services/user.service';
import { UserRepository } from '../repositories/user.repository';

// Mock the UserRepository
jest.mock('../repositories/user.repository');

describe('Landlord Verification System', () => {
  let userService: UserService;
  let mockUserRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockUserRepository = new UserRepository() as jest.Mocked<UserRepository>;
    userService = new UserService();
    (userService as any).userRepository = mockUserRepository;
  });

  describe('Document Upload', () => {
    const mockUser = {
      id: 'user-1',
      email: 'landlord@test.com',
      firstName: 'John',
      lastName: 'Doe',
      userType: 'LANDLORD' as const,
      isActive: true,
      isVerified: true,
      phone: '+1234567890',
      password: 'hashedpassword',
      profilePicture: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockDocument = {
      id: 'doc-1',
      userId: 'user-1',
      documentType: 'ID' as const,
      documentUrl: 'https://example.com/doc.pdf',
      status: 'PENDING' as const,
      rejectionReason: null,
      uploadedAt: new Date(),
      reviewedAt: null,
    };

    it('should allow landlord to upload property ownership document', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.createVerificationDocument.mockResolvedValue(mockDocument);

      const result = await userService.uploadVerificationDocument(
        'user-1',
        'PROPERTY_OWNERSHIP',
        'https://example.com/property-doc.pdf'
      );

      expect(result).toBeDefined();
      expect(mockUserRepository.createVerificationDocument).toHaveBeenCalledWith({
        userId: 'user-1',
        documentType: 'PROPERTY_OWNERSHIP',
        documentUrl: 'https://example.com/property-doc.pdf',
      });
    });

    it('should prevent tenant from uploading property ownership document', async () => {
      const tenantUser = { ...mockUser, userType: 'TENANT' as const };
      mockUserRepository.findById.mockResolvedValue(tenantUser);

      await expect(
        userService.uploadVerificationDocument(
          'user-1',
          'PROPERTY_OWNERSHIP',
          'https://example.com/property-doc.pdf'
        )
      ).rejects.toThrow('Only landlords can upload property ownership documents');
    });

    it('should allow any user to upload ID document', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.createVerificationDocument.mockResolvedValue(mockDocument);

      const result = await userService.uploadVerificationDocument(
        'user-1',
        'ID',
        'https://example.com/id.pdf'
      );

      expect(result).toBeDefined();
      expect(mockUserRepository.createVerificationDocument).toHaveBeenCalledWith({
        userId: 'user-1',
        documentType: 'ID',
        documentUrl: 'https://example.com/id.pdf',
      });
    });
  });

  describe('Verification Status', () => {
    const mockUser = {
      id: 'user-1',
      email: 'landlord@test.com',
      firstName: 'John',
      lastName: 'Doe',
      userType: 'LANDLORD' as const,
      isActive: true,
      isVerified: true,
      phone: '+1234567890',
      password: 'hashedpassword',
      profilePicture: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return correct verification status for landlord', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          userId: 'user-1',
          documentType: 'ID' as const,
          documentUrl: 'https://example.com/id.pdf',
          status: 'APPROVED' as const,
          rejectionReason: null,
          uploadedAt: new Date(),
          reviewedAt: new Date(),
        },
        {
          id: 'doc-2',
          userId: 'user-1',
          documentType: 'PROPERTY_OWNERSHIP' as const,
          documentUrl: 'https://example.com/property.pdf',
          status: 'APPROVED' as const,
          rejectionReason: null,
          uploadedAt: new Date(),
          reviewedAt: new Date(),
        },
      ];

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.getVerificationDocuments.mockResolvedValue(mockDocuments);

      const status = await userService.getVerificationStatus('user-1');

      expect(status).toEqual({
        isEmailVerified: true,
        isDocumentVerified: true,
        requiredDocuments: ['ID', 'PROPERTY_OWNERSHIP'],
        uploadedDocuments: mockDocuments,
      });
    });

    it('should return correct verification status for tenant', async () => {
      const tenantUser = { ...mockUser, userType: 'TENANT' as const };
      const mockDocuments = [
        {
          id: 'doc-1',
          userId: 'user-1',
          documentType: 'ID' as const,
          documentUrl: 'https://example.com/id.pdf',
          status: 'APPROVED' as const,
          rejectionReason: null,
          uploadedAt: new Date(),
          reviewedAt: new Date(),
        },
      ];

      mockUserRepository.findById.mockResolvedValue(tenantUser);
      mockUserRepository.getVerificationDocuments.mockResolvedValue(mockDocuments);

      const status = await userService.getVerificationStatus('user-1');

      expect(status).toEqual({
        isEmailVerified: true,
        isDocumentVerified: true,
        requiredDocuments: ['ID'],
        uploadedDocuments: mockDocuments,
      });
    });
  });
});