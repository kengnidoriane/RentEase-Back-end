# Swagger API Documentation Implementation

## Overview

This document describes the implementation of comprehensive API documentation and validation for the RentEase API using Swagger/OpenAPI 3.0.

## Implementation Details

### 1. Swagger Configuration (`src/config/swagger.ts`)

- **OpenAPI 3.0 specification** with comprehensive schemas
- **Security schemes** for JWT Bearer authentication
- **Common response schemas** for consistent API responses
- **Validation error schemas** for detailed error reporting
- **All entity schemas** (User, Property, Message, Favorite, Notification)
- **Comprehensive tags** for endpoint organization

### 2. Enhanced Validation Middleware (`src/middleware/swagger-validation.middleware.ts`)

- **Request validation** for body, query, params, and headers
- **Response validation** for development/testing
- **Detailed error reporting** with field-level validation messages
- **Zod schema integration** for type-safe validation
- **Comprehensive error logging** for debugging

### 3. Rate Limiting Middleware (`src/middleware/rate-limit.middleware.ts`)

- **Redis-based rate limiting** with configurable windows
- **Per-user and per-IP rate limiting** strategies
- **Predefined configurations** for different endpoint types:
  - General API: 1000 requests per 15 minutes
  - Authentication: 10 attempts per 15 minutes
  - Password reset: 3 requests per hour
  - File upload: 10 uploads per minute
  - Search: 100 searches per minute
  - Messaging: 30 messages per minute
  - Admin: 2000 requests per 15 minutes
- **Rate limit headers** in responses
- **Graceful degradation** when Redis is unavailable

### 4. Validation Schemas (`src/utils/swagger-schemas.ts`)

- **Comprehensive Zod schemas** for all API endpoints
- **Request validation schemas** for body, query, and params
- **Response validation schemas** for type safety
- **Reusable schema components** for consistency
- **Transform functions** for query parameter parsing

### 5. API Route Documentation

Enhanced all route files with comprehensive Swagger documentation:

#### Authentication Routes (`src/routes/auth.routes.ts`)
- Complete documentation for all auth endpoints
- Request/response schemas with examples
- Security requirements specification
- Error response documentation

#### Property Routes (`src/routes/property.routes.ts`)
- Search endpoint with comprehensive filter documentation
- Property CRUD operations with detailed schemas
- Admin verification endpoints
- File upload documentation

#### Message Routes (`src/routes/message.routes.ts`)
- Real-time messaging endpoint documentation
- Conversation management schemas
- Pagination support documentation
- WebSocket integration notes

#### Favorites Routes (`src/routes/favorite.routes.ts`)
- Favorites management documentation
- Batch operations support
- Status checking endpoints
- Availability notifications

### 6. Server Integration (`src/server.ts`)

- **Swagger UI setup** at `/api/docs`
- **Swagger JSON endpoint** at `/api/docs.json`
- **Rate limiting integration** with endpoint-specific configurations
- **Security headers** configuration for Swagger UI
- **Development vs production** server configuration

## API Documentation Features

### 1. Interactive Testing Interface
- **Swagger UI** with "Try it out" functionality enabled
- **Authentication support** with JWT token configuration
- **Request/response examples** for all endpoints
- **Schema validation** in real-time

### 2. Comprehensive Schema Documentation
- **Request schemas** with validation rules
- **Response schemas** with examples
- **Error schemas** with detailed error codes
- **Pagination schemas** for list endpoints
- **File upload schemas** for media endpoints

### 3. Security Documentation
- **JWT Bearer authentication** configuration
- **Rate limiting** information in headers
- **CORS policy** documentation
- **Input sanitization** requirements

### 4. Validation Features
- **Request validation** with detailed error messages
- **Response validation** in development mode
- **Schema-driven validation** using Zod
- **Type-safe validation** with TypeScript integration

## Usage

### Accessing API Documentation
1. Start the development server: `npm run dev`
2. Navigate to `http://localhost:3000/api/docs`
3. Use the interactive interface to test endpoints
4. Configure authentication using the "Authorize" button

### JSON Schema Access
- Raw OpenAPI specification: `http://localhost:3000/api/docs.json`
- Can be imported into other tools (Postman, Insomnia, etc.)

### Rate Limiting
- Rate limit information is included in response headers:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Remaining requests in window
  - `X-RateLimit-Reset`: Window reset timestamp
  - `X-RateLimit-Window`: Window duration in milliseconds

## Benefits

1. **Developer Experience**: Interactive documentation with testing capabilities
2. **API Consistency**: Standardized request/response formats
3. **Type Safety**: Schema-driven validation with TypeScript
4. **Security**: Rate limiting and input validation
5. **Maintainability**: Auto-generated documentation from code
6. **Testing**: Built-in API testing interface
7. **Integration**: Easy integration with external tools

## Requirements Fulfilled

This implementation fulfills all requirements from task 8:

- ✅ **Set up Swagger/OpenAPI documentation**
- ✅ **Document all API endpoints with examples**
- ✅ **Implement request/response validation middleware**
- ✅ **Create API testing interface in Swagger UI**
- ✅ **Add authentication configuration for Swagger**
- ✅ **Rate limiting and security enhancements**
- ✅ **Comprehensive error handling and validation**

## Next Steps

1. **Frontend Integration**: Use the OpenAPI spec to generate TypeScript client types
2. **CI/CD Integration**: Add API documentation validation to the build process
3. **Performance Monitoring**: Add API performance metrics to Swagger documentation
4. **Version Management**: Implement API versioning strategy with Swagger