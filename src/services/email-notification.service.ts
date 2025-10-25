import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';
import { EmailNotificationData, NotificationType } from '../types/notification.types';

export class EmailNotificationService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail(data: EmailNotificationData): Promise<boolean> {
    try {
      const emailContent = this.generateEmailContent(data);
      
      const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@rentease.com',
        to: data.recipientEmail,
        subject: data.title,
        html: emailContent.html,
        text: emailContent.text,
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info('Email sent successfully', {
        messageId: result.messageId,
        recipient: data.recipientEmail,
        type: data.type,
      });

      return true;
    } catch (error) {
      logger.error('Failed to send email', {
        error: error instanceof Error ? error.message : 'Unknown error',
        recipient: data.recipientEmail,
        type: data.type,
      });
      return false;
    }
  }

  private generateEmailContent(data: EmailNotificationData): { html: string; text: string } {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    switch (data.type) {
      case NotificationType.NEW_MESSAGE:
        return this.generateNewMessageEmail(data, baseUrl);
      
      case NotificationType.FAVORITE_UNAVAILABLE:
        return this.generateFavoriteUnavailableEmail(data, baseUrl);
      
      case NotificationType.PROPERTY_VERIFIED:
        return this.generatePropertyVerifiedEmail(data, baseUrl);
      
      case NotificationType.NEW_LISTING_MATCH:
        return this.generateNewListingMatchEmail(data, baseUrl);
      
      case NotificationType.REMINDER_INACTIVE:
        return this.generateInactiveReminderEmail(data, baseUrl);
      
      case NotificationType.PROPERTY_APPROVED:
        return this.generatePropertyApprovedEmail(data, baseUrl);
      
      case NotificationType.PROPERTY_REJECTED:
        return this.generatePropertyRejectedEmail(data, baseUrl);
      
      default:
        return this.generateGenericEmail(data, baseUrl);
    }
  }

  private generateNewMessageEmail(data: EmailNotificationData, baseUrl: string): { html: string; text: string } {
    const propertyTitle = data.data?.propertyTitle || 'a property';
    const senderName = data.data?.senderName || 'Someone';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Message on RentEase</h2>
        <p>Hi there!</p>
        <p><strong>${senderName}</strong> sent you a message about <strong>${propertyTitle}</strong>.</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-style: italic;">"${data.message}"</p>
        </div>
        <a href="${baseUrl}/messages" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Message
        </a>
        <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
          Best regards,<br>
          The RentEase Team
        </p>
      </div>
    `;

    const text = `
      New Message on RentEase
      
      Hi there!
      
      ${senderName} sent you a message about ${propertyTitle}.
      
      Message: "${data.message}"
      
      View your messages at: ${baseUrl}/messages
      
      Best regards,
      The RentEase Team
    `;

    return { html, text };
  }

  private generateFavoriteUnavailableEmail(data: EmailNotificationData, baseUrl: string): { html: string; text: string } {
    const propertyTitle = data.data?.propertyTitle || 'One of your favorite properties';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Property No Longer Available</h2>
        <p>Hi there!</p>
        <p>We wanted to let you know that <strong>${propertyTitle}</strong> is no longer available.</p>
        <p>Don't worry! We have many other great properties that might interest you.</p>
        <a href="${baseUrl}/search" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Browse Properties
        </a>
        <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
          Best regards,<br>
          The RentEase Team
        </p>
      </div>
    `;

    const text = `
      Property No Longer Available
      
      Hi there!
      
      We wanted to let you know that ${propertyTitle} is no longer available.
      
      Don't worry! We have many other great properties that might interest you.
      
      Browse properties at: ${baseUrl}/search
      
      Best regards,
      The RentEase Team
    `;

    return { html, text };
  }

  private generatePropertyVerifiedEmail(data: EmailNotificationData, baseUrl: string): { html: string; text: string } {
    const propertyTitle = data.data?.propertyTitle || 'Your property';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Property Verified Successfully</h2>
        <p>Hi there!</p>
        <p>Great news! <strong>${propertyTitle}</strong> has been verified and is now live on RentEase.</p>
        <p>Your property is now visible to potential tenants and has a verified badge.</p>
        <a href="${baseUrl}/properties/${data.data?.propertyId}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Property
        </a>
        <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
          Best regards,<br>
          The RentEase Team
        </p>
      </div>
    `;

    const text = `
      Property Verified Successfully
      
      Hi there!
      
      Great news! ${propertyTitle} has been verified and is now live on RentEase.
      
      Your property is now visible to potential tenants and has a verified badge.
      
      View your property at: ${baseUrl}/properties/${data.data?.propertyId}
      
      Best regards,
      The RentEase Team
    `;

    return { html, text };
  }

  private generateNewListingMatchEmail(data: EmailNotificationData, baseUrl: string): { html: string; text: string } {
    const matchCount = data.data?.matchCount || 1;
    const location = data.data?.location || 'your preferred area';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Properties Match Your Criteria</h2>
        <p>Hi there!</p>
        <p>We found <strong>${matchCount} new ${matchCount === 1 ? 'property' : 'properties'}</strong> in ${location} that match your search criteria.</p>
        <p>Don't miss out on these great opportunities!</p>
        <a href="${baseUrl}/search" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View New Properties
        </a>
        <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
          Best regards,<br>
          The RentEase Team
        </p>
      </div>
    `;

    const text = `
      New Properties Match Your Criteria
      
      Hi there!
      
      We found ${matchCount} new ${matchCount === 1 ? 'property' : 'properties'} in ${location} that match your search criteria.
      
      Don't miss out on these great opportunities!
      
      View new properties at: ${baseUrl}/search
      
      Best regards,
      The RentEase Team
    `;

    return { html, text };
  }

  private generateInactiveReminderEmail(data: EmailNotificationData, baseUrl: string): { html: string; text: string } {
    const newListingsCount = data.data?.newListingsCount || 0;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">We Miss You on RentEase!</h2>
        <p>Hi there!</p>
        <p>It's been a while since your last visit. We wanted to let you know that there are <strong>${newListingsCount} new properties</strong> available that might interest you.</p>
        <p>Come back and discover your next home!</p>
        <a href="${baseUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Browse New Properties
        </a>
        <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
          Best regards,<br>
          The RentEase Team
        </p>
      </div>
    `;

    const text = `
      We Miss You on RentEase!
      
      Hi there!
      
      It's been a while since your last visit. We wanted to let you know that there are ${newListingsCount} new properties available that might interest you.
      
      Come back and discover your next home!
      
      Browse new properties at: ${baseUrl}
      
      Best regards,
      The RentEase Team
    `;

    return { html, text };
  }

  private generatePropertyApprovedEmail(data: EmailNotificationData, baseUrl: string): { html: string; text: string } {
    const propertyTitle = data.data?.propertyTitle || 'Your property';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Property Approved!</h2>
        <p>Hi there!</p>
        <p>Congratulations! <strong>${propertyTitle}</strong> has been approved by our team and is now live on RentEase.</p>
        <p>Your property is now visible to potential tenants.</p>
        <a href="${baseUrl}/properties/${data.data?.propertyId}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Property
        </a>
        <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
          Best regards,<br>
          The RentEase Team
        </p>
      </div>
    `;

    const text = `
      Property Approved!
      
      Hi there!
      
      Congratulations! ${propertyTitle} has been approved by our team and is now live on RentEase.
      
      Your property is now visible to potential tenants.
      
      View your property at: ${baseUrl}/properties/${data.data?.propertyId}
      
      Best regards,
      The RentEase Team
    `;

    return { html, text };
  }

  private generatePropertyRejectedEmail(data: EmailNotificationData, baseUrl: string): { html: string; text: string } {
    const propertyTitle = data.data?.propertyTitle || 'Your property';
    const rejectionReason = data.data?.rejectionReason || 'Please review our guidelines and try again.';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Property Needs Review</h2>
        <p>Hi there!</p>
        <p>We've reviewed <strong>${propertyTitle}</strong> and it needs some adjustments before it can go live.</p>
        <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #dc2626;"><strong>Reason:</strong> ${rejectionReason}</p>
        </div>
        <p>Please make the necessary changes and resubmit your property.</p>
        <a href="${baseUrl}/properties/edit/${data.data?.propertyId}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Edit Property
        </a>
        <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
          Best regards,<br>
          The RentEase Team
        </p>
      </div>
    `;

    const text = `
      Property Needs Review
      
      Hi there!
      
      We've reviewed ${propertyTitle} and it needs some adjustments before it can go live.
      
      Reason: ${rejectionReason}
      
      Please make the necessary changes and resubmit your property.
      
      Edit your property at: ${baseUrl}/properties/edit/${data.data?.propertyId}
      
      Best regards,
      The RentEase Team
    `;

    return { html, text };
  }

  private generateGenericEmail(data: EmailNotificationData, baseUrl: string): { html: string; text: string } {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">${data.title}</h2>
        <p>Hi there!</p>
        <p>${data.message}</p>
        <a href="${baseUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Visit RentEase
        </a>
        <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
          Best regards,<br>
          The RentEase Team
        </p>
      </div>
    `;

    const text = `
      ${data.title}
      
      Hi there!
      
      ${data.message}
      
      Visit RentEase at: ${baseUrl}
      
      Best regards,
      The RentEase Team
    `;

    return { html, text };
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('Email service connection verified');
      return true;
    } catch (error) {
      logger.error('Email service connection failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}