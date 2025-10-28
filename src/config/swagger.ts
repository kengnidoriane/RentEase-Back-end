import swaggerJsdoc from 'swagger-jsdoc';
import { SwaggerDefinition } from 'swagger-jsdoc';

const swaggerDefinition: SwaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'RentEase API',
    version: '1.0.0',
    description: 'A comprehensive API for RentEase - connecting verified tenants with verified landlords',
    contact: {
      name: 'RentEase Team',
      email: 'support@rentease.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: process.env.NODE_ENV === 'production' 
        ? process.env.API_URL || 'https://api.rentease.com'
        : `http://localhost:${process.env.PORT || 3000}`,
      description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token obtained from login endpoint',
      },
    },
    schemas: {
      // Common response schemas
      ApiResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            description: 'Indicates if the request was successful',
          },
          data: {
            type: 'object',
            description: 'Response data (present on success)',
          },
          error: {
            type: 'object',
            description: 'Error details (present on failure)',
            properties: {
              code: {
                type: 'string',
                description: 'Error code',
              },
              message: {
                type: 'string',
                description: 'Error message',
              },
              details: {
                type: 'object',
                description: 'Additional error details',
              },
              timestamp: {
                type: 'string',
                format: 'date-time',
                description: 'Error timestamp',
              },
              path: {
                type: 'string',
                description: 'Request path where error occurred',
              },
            },
          },
          meta: {
            type: 'object',
            description: 'Additional metadata (e.g., pagination)',
            properties: {
              pagination: {
                type: 'object',
                properties: {
                  page: {
                    type: 'integer',
                    description: 'Current page number',
                  },
                  limit: {
                    type: 'integer',
                    description: 'Items per page',
                  },
                  total: {
                    type: 'integer',
                    description: 'Total number of items',
                  },
                  totalPages: {
                    type: 'integer',
                    description: 'Total number of pages',
                  },
                },
              },
            },
          },
        },
      },
      // User schemas
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique user identifier',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address',
          },
          firstName: {
            type: 'string',
            description: 'User first name',
          },
          lastName: {
            type: 'string',
            description: 'User last name',
          },
          phone: {
            type: 'string',
            description: 'User phone number',
          },
          userType: {
            type: 'string',
            enum: ['TENANT', 'LANDLORD', 'ADMIN'],
            description: 'Type of user account',
          },
          profilePicture: {
            type: 'string',
            nullable: true,
            description: 'URL to user profile picture',
          },
          isVerified: {
            type: 'boolean',
            description: 'Whether user email is verified',
          },
          isActive: {
            type: 'boolean',
            description: 'Whether user account is active',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Account creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp',
          },
        },
      },
      // Property schemas
      Property: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique property identifier',
          },
          title: {
            type: 'string',
            description: 'Property title',
          },
          description: {
            type: 'string',
            description: 'Property description',
          },
          price: {
            type: 'number',
            description: 'Property price',
          },
          currency: {
            type: 'string',
            default: 'EUR',
            description: 'Price currency',
          },
          propertyType: {
            type: 'string',
            enum: ['APARTMENT', 'ROOM', 'HOUSE', 'STUDIO'],
            description: 'Type of property',
          },
          bedrooms: {
            type: 'integer',
            description: 'Number of bedrooms',
          },
          bathrooms: {
            type: 'integer',
            description: 'Number of bathrooms',
          },
          area: {
            type: 'number',
            description: 'Property area in square meters',
          },
          address: {
            type: 'string',
            description: 'Property address',
          },
          city: {
            type: 'string',
            description: 'Property city',
          },
          latitude: {
            type: 'number',
            description: 'Property latitude coordinate',
          },
          longitude: {
            type: 'number',
            description: 'Property longitude coordinate',
          },
          isVerified: {
            type: 'boolean',
            description: 'Whether property is verified',
          },
          isActive: {
            type: 'boolean',
            description: 'Whether property is active',
          },
          verificationStatus: {
            type: 'string',
            enum: ['PENDING', 'APPROVED', 'REJECTED'],
            description: 'Property verification status',
          },
          rejectionReason: {
            type: 'string',
            nullable: true,
            description: 'Reason for rejection if applicable',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Property creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp',
          },
          landlordId: {
            type: 'string',
            description: 'ID of the property landlord',
          },
          images: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/PropertyImage',
            },
            description: 'Property images',
          },
        },
      },
      PropertyImage: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique image identifier',
          },
          url: {
            type: 'string',
            description: 'Image URL',
          },
          altText: {
            type: 'string',
            description: 'Image alt text for accessibility',
          },
          order: {
            type: 'integer',
            description: 'Display order of the image',
          },
        },
      },
      // Message schemas
      Message: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique message identifier',
          },
          content: {
            type: 'string',
            description: 'Message content',
          },
          isRead: {
            type: 'boolean',
            description: 'Whether message has been read',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Message creation timestamp',
          },
          conversationId: {
            type: 'string',
            description: 'Conversation identifier',
          },
          senderId: {
            type: 'string',
            description: 'ID of message sender',
          },
          receiverId: {
            type: 'string',
            description: 'ID of message receiver',
          },
          propertyId: {
            type: 'string',
            description: 'ID of related property',
          },
        },
      },
      // Favorite schemas
      Favorite: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique favorite identifier',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Favorite creation timestamp',
          },
          userId: {
            type: 'string',
            description: 'ID of user who favorited',
          },
          propertyId: {
            type: 'string',
            description: 'ID of favorited property',
          },
          property: {
            $ref: '#/components/schemas/Property',
            description: 'Favorited property details',
          },
        },
      },
      // Notification schemas
      Notification: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique notification identifier',
          },
          type: {
            type: 'string',
            enum: ['NEW_MESSAGE', 'PROPERTY_APPROVED', 'PROPERTY_REJECTED', 'NEW_PROPERTY_MATCH', 'FAVORITE_AVAILABLE'],
            description: 'Type of notification',
          },
          title: {
            type: 'string',
            description: 'Notification title',
          },
          message: {
            type: 'string',
            description: 'Notification message',
          },
          isRead: {
            type: 'boolean',
            description: 'Whether notification has been read',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Notification creation timestamp',
          },
          userId: {
            type: 'string',
            description: 'ID of notification recipient',
          },
          relatedEntityId: {
            type: 'string',
            nullable: true,
            description: 'ID of related entity (property, message, etc.)',
          },
          relatedEntityType: {
            type: 'string',
            nullable: true,
            description: 'Type of related entity',
          },
        },
      },
      // Validation error schema
      ValidationError: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          error: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                example: 'VALIDATION_ERROR',
              },
              message: {
                type: 'string',
                example: 'Validation failed',
              },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: {
                      type: 'string',
                      description: 'Field that failed validation',
                    },
                    message: {
                      type: 'string',
                      description: 'Validation error message',
                    },
                  },
                },
              },
              timestamp: {
                type: 'string',
                format: 'date-time',
              },
              path: {
                type: 'string',
              },
            },
          },
        },
      },
    },
  },
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication and authorization endpoints',
    },
    {
      name: 'Users',
      description: 'User management endpoints',
    },
    {
      name: 'Properties',
      description: 'Property listing and management endpoints',
    },
    {
      name: 'Messages',
      description: 'Messaging system endpoints',
    },
    {
      name: 'Favorites',
      description: 'User favorites management endpoints',
    },
    {
      name: 'Notifications',
      description: 'Notification system endpoints',
    },
    {
      name: 'Admin',
      description: 'Administrative endpoints',
    },
  ],
};

const options = {
  definition: swaggerDefinition,
  apis: [
    './src/routes/*.ts', // Path to the API routes
    './src/controllers/*.ts', // Path to controllers for additional documentation
  ],
};

export const swaggerSpec = swaggerJsdoc(options);