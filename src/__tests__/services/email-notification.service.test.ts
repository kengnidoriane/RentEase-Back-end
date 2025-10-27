import nodemailer from 'nodemailer';
import { EmailNotificationService } from '../../services/email-notification.service';
import { NotificationType, NotificationChannel } from '../../types/notification.types';
import { logger } from '../../utils/logger';

// Mock nodemailer
jest.mock('nodemailer');
jest.mock('../../utils/logger');

describe('EmailNotificationService', () => {
  let emailService: EmailNotificationService;
  let mockTransporter: jest.Mocked<nodemailer.Transporter>;

  beforeEach(() => {
    mockTransporter = {
      sendMail: jest.fn(),
      verify: jest.fn(),
    } as any;

    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);
    
    emailService = new EmailNotificationService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create transporter with environment configuration', () => {
      process.env.SMTP_HOST = 'smtp.test.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_SECURE = 'false';
      process.env.SMTP_USER = 'test@example.com';
      process.env.SMTP_PASS = 'password';

      new EmailNotificationService();

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@example.com',
          pass: 'password',
        },
      });
    });

    it('should use default values when environment variables are not set', () => {
      const originalHost = process.env.SMTP_HOST;
      const originalPort = process.env.SMTP_PORT;
      const originalSecure = process.env.SMTP_SECURE;
      const originalUser = process.env.SMTP_USER;
      const originalPass = process.env.SMTP_PASS;
      
      delete (process.env as any).SMTP_HOST;
      delete (process.env as any).SMTP_PORT;
      delete (process.env as any).SMTP_SECURE;
      delete (process.env as any).SMTP_USER;
      delete (process.env as any).SMTP_PASS;

      new EmailNotificationService();

      expect(nodemailer.createTransport).toHaveBeenLastCalledWith({
        host: 'localhost',
        port: 587,
        secure: false,
        auth: {
          user: undefined,
          pass: undefined,
        },
      });

      // Restore original values
      process.env.SMTP_HOST = originalHost;
      process.env.SMTP_PORT = originalPort;
      process.env.SMTP_SECURE = originalSecure;
      process.env.SMTP_USER = originalUser;
      process.env.SMTP_PASS = originalPass;
    });
  });

  describe('sendEmail', () => {
    const mockEmailData = {
      userId: 'user-1',
      type: NotificationType.NEW_MESSAGE,
      title: 'New Message',
      message: 'You have a new message',
      channel: NotificationChannel.EMAIL as const,
      recipientEmail: 'test@example.com',
      data: {
        senderName: 'John Doe',
        propertyTitle: 'Nice Apartment',
        messageContent: 'Is this still available?',
      },
    };

    it('should send email successfully', async () => {
      const mockResult = { messageId: 'test-message-id' };
      mockTransporter.sendMail.mockResolvedValue(mockResult);

      const result = await emailService.sendEmail(mockEmailData);

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: process.env.SMTP_FROM || 'noreply@rentease.com',
        to: 'test@example.com',
        subject: 'New Message',
        html: expect.stringContaining('New Message on RentEase'),
        text: expect.stringContaining('New Message on RentEase'),
      });
      expect(logger.info).toHaveBeenCalledWith('Email sent successfully', {
        messageId: 'test-message-id',
        recipient: 'test@example.com',
        type: NotificationType.NEW_MESSAGE,
      });
    });

    it('should handle email sending failure', async () => {
      const error = new Error('SMTP connection failed');
      mockTransporter.sendMail.mockRejectedValue(error);

      const result = await emailService.sendEmail(mockEmailData);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('Failed to send email', {
        error: 'SMTP connection failed',
        recipient: 'test@example.com',
        type: NotificationType.NEW_MESSAGE,
      });
    });

    it('should use custom SMTP_FROM when provided', async () => {
      process.env.SMTP_FROM = 'custom@rentease.com';
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test' });

      await emailService.sendEmail(mockEmailData);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'custom@rentease.com',
        })
      );
    });
  });

  describe('email content generation', () => {
    const baseEmailData = {
      userId: 'user-1',
      channel: NotificationChannel.EMAIL as const,
      recipientEmail: 'test@example.com',
    };

    beforeEach(() => {
      process.env.FRONTEND_URL = 'https://rentease.com';
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test' });
    });

    it('should generate new message email content', async () => {
      const emailData = {
        ...baseEmailData,
        type: NotificationType.NEW_MESSAGE,
        title: 'New Message',
        message: 'John sent you a message',
        data: {
          senderName: 'John Doe',
          propertyTitle: 'Nice Apartment',
          messageContent: 'Is this available?',
        },
      };

      await emailService.sendEmail(emailData);

      const sentEmail = mockTransporter.sendMail.mock.calls[0]![0];
      expect(sentEmail.html).toContain('New Message on RentEase');
      expect(sentEmail.html).toContain('John Doe');
      expect(sentEmail.html).toContain('Nice Apartment');
      expect(sentEmail.html).toContain('https://rentease.com/messages');
      expect(sentEmail.text).toContain('John Doe sent you a message about Nice Apartment');
    });

    it('should generate favorite unavailable email content', async () => {
      const emailData = {
        ...baseEmailData,
        type: NotificationType.FAVORITE_UNAVAILABLE,
        title: 'Property No Longer Available',
        message: 'Property unavailable',
        data: {
          propertyTitle: 'Nice Apartment',
        },
      };

      await emailService.sendEmail(emailData);

      const sentEmail = mockTransporter.sendMail.mock.calls[0]![0];
      expect(sentEmail.html).toContain('Property No Longer Available');
      expect(sentEmail.html).toContain('Nice Apartment');
      expect(sentEmail.html).toContain('https://rentease.com/search');
      expect(sentEmail.text).toContain('Nice Apartment is no longer available');
    });

    it('should generate property verified email content', async () => {
      const emailData = {
        ...baseEmailData,
        type: NotificationType.PROPERTY_VERIFIED,
        title: 'Property Verified',
        message: 'Property verified',
        data: {
          propertyTitle: 'Nice Apartment',
          propertyId: 'prop-123',
        },
      };

      await emailService.sendEmail(emailData);

      const sentEmail = mockTransporter.sendMail.mock.calls[0]![0];
      expect(sentEmail.html).toContain('Property Verified Successfully');
      expect(sentEmail.html).toContain('Nice Apartment');
      expect(sentEmail.html).toContain('https://rentease.com/properties/prop-123');
      expect(sentEmail.text).toContain('Nice Apartment has been verified');
    });

    it('should generate property approved email content', async () => {
      const emailData = {
        ...baseEmailData,
        type: NotificationType.PROPERTY_APPROVED,
        title: 'Property Approved',
        message: 'Property approved',
        data: {
          propertyTitle: 'Nice Apartment',
          propertyId: 'prop-123',
        },
      };

      await emailService.sendEmail(emailData);

      const sentEmail = mockTransporter.sendMail.mock.calls[0]![0];
      expect(sentEmail.html).toContain('Property Approved!');
      expect(sentEmail.html).toContain('Nice Apartment');
      expect(sentEmail.html).toContain('https://rentease.com/properties/prop-123');
    });

    it('should generate property rejected email content', async () => {
      const emailData = {
        ...baseEmailData,
        type: NotificationType.PROPERTY_REJECTED,
        title: 'Property Needs Review',
        message: 'Property rejected',
        data: {
          propertyTitle: 'Nice Apartment',
          propertyId: 'prop-123',
          rejectionReason: 'Missing required photos',
        },
      };

      await emailService.sendEmail(emailData);

      const sentEmail = mockTransporter.sendMail.mock.calls[0]![0];
      expect(sentEmail.html).toContain('Property Needs Review');
      expect(sentEmail.html).toContain('Nice Apartment');
      expect(sentEmail.html).toContain('Missing required photos');
      expect(sentEmail.html).toContain('https://rentease.com/properties/edit/prop-123');
    });

    it('should generate new listing match email content', async () => {
      const emailData = {
        ...baseEmailData,
        type: NotificationType.NEW_LISTING_MATCH,
        title: 'New Properties Match',
        message: 'New matches found',
        data: {
          matchCount: 3,
          location: 'Paris',
        },
      };

      await emailService.sendEmail(emailData);

      const sentEmail = mockTransporter.sendMail.mock.calls[0]![0];
      expect(sentEmail.html).toContain('New Properties Match Your Criteria');
      expect(sentEmail.html).toContain('3 new properties');
      expect(sentEmail.html).toContain('Paris');
      expect(sentEmail.text).toContain('3 new properties in Paris');
    });

    it('should generate inactive user reminder email content', async () => {
      const emailData = {
        ...baseEmailData,
        type: NotificationType.REMINDER_INACTIVE,
        title: 'We Miss You',
        message: 'Come back',
        data: {
          newListingsCount: 15,
        },
      };

      await emailService.sendEmail(emailData);

      const sentEmail = mockTransporter.sendMail.mock.calls[0]![0];
      expect(sentEmail.html).toContain('We Miss You on RentEase!');
      expect(sentEmail.html).toContain('15 new properties');
      expect(sentEmail.text).toContain('15 new properties available');
    });

    it('should generate generic email content for unknown types', async () => {
      const emailData = {
        ...baseEmailData,
        type: 'UNKNOWN_TYPE' as any,
        title: 'Generic Notification',
        message: 'This is a generic message',
      };

      await emailService.sendEmail(emailData);

      const sentEmail = mockTransporter.sendMail.mock.calls[0]![0];
      expect(sentEmail.html).toContain('Generic Notification');
      expect(sentEmail.html).toContain('This is a generic message');
      expect(sentEmail.html).toContain('https://rentease.com');
    });

    it('should handle missing data gracefully', async () => {
      const emailData = {
        ...baseEmailData,
        type: NotificationType.NEW_MESSAGE,
        title: 'New Message',
        message: 'You have a message',
        data: {}, // Empty data
      };

      await emailService.sendEmail(emailData);

      const sentEmail = mockTransporter.sendMail.mock.calls[0]![0];
      expect(sentEmail.html).toContain('Someone</strong> sent you a message about <strong>a property');
      expect(sentEmail.text).toContain('Someone sent you a message about a property');
    });

    it('should use default frontend URL when not configured', async () => {
      const originalUrl = process.env.FRONTEND_URL;
      delete (process.env as any).FRONTEND_URL;

      const emailData = {
        ...baseEmailData,
        type: NotificationType.NEW_MESSAGE,
        title: 'New Message',
        message: 'Test',
        data: {},
      };

      await emailService.sendEmail(emailData);

      const sentEmail = mockTransporter.sendMail.mock.calls[0]![0];
      expect(sentEmail.html).toContain('http://localhost:3000/messages');

      // Restore original value
      process.env.FRONTEND_URL = originalUrl;
    });
  });

  describe('testConnection', () => {
    it('should return true when connection is successful', async () => {
      mockTransporter.verify.mockResolvedValue(true);

      const result = await emailService.testConnection();

      expect(result).toBe(true);
      expect(mockTransporter.verify).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Email service connection verified');
    });

    it('should return false when connection fails', async () => {
      const error = new Error('Connection failed');
      mockTransporter.verify.mockRejectedValue(error);

      const result = await emailService.testConnection();

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('Email service connection failed', {
        error: 'Connection failed',
      });
    });

    it('should handle unknown error types', async () => {
      mockTransporter.verify.mockRejectedValue('String error');

      const result = await emailService.testConnection();

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('Email service connection failed', {
        error: 'Unknown error',
      });
    });
  });
});