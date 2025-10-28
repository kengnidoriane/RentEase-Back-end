import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';
import swaggerUi from 'swagger-ui-express';
import { connectDatabase, disconnectDatabase } from '@/config/database';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { swaggerSpec } from '@/config/swagger';
import { logger } from '@/utils/logger';
import { errorHandler } from '@/middleware/error.middleware';
import { WebSocketService } from '@/services/websocket.service';
import { RateLimitConfigs, addRateLimitHeaders } from '@/middleware/rate-limit.middleware';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize WebSocket service
let webSocketService: WebSocketService;

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for Swagger UI
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
      },
    },
  })
);

// CORS configuration
app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'production'
        ? process.env.FRONTEND_URL
        : ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
  })
);

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting middleware
app.use('/api', RateLimitConfigs.general.middleware());
app.use('/api/auth/login', RateLimitConfigs.auth.middleware());
app.use('/api/auth/register', RateLimitConfigs.auth.middleware());
app.use('/api/auth/forgot-password', RateLimitConfigs.passwordReset.middleware());
app.use('/api/auth/reset-password', RateLimitConfigs.passwordReset.middleware());
app.use('/api/properties/search', RateLimitConfigs.search.middleware());
app.use('/api/messages/send', RateLimitConfigs.messaging.middleware());
app.use('/api/admin', RateLimitConfigs.admin.middleware());

// Add rate limit headers to responses
app.use(addRateLimitHeaders);

// Swagger UI setup
const swaggerUiOptions = {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'RentEase API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
  },
};

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// Swagger JSON endpoint
app.get('/api/docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'RentEase API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Import routes
import authRoutes from '@/routes/auth.routes';
import userRoutes from '@/routes/user.routes';
import adminRoutes from '@/routes/admin.routes';
import propertyRoutes from '@/routes/property.routes';
import messageRoutes from '@/routes/message.routes';
import favoriteRoutes from '@/routes/favorite.routes';
import { notificationRoutes } from '@/routes/notification.routes';

// API routes
app.get('/api', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to RentEase API',
    version: '1.0.0',
  });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/notifications', notificationRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    },
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    await disconnectDatabase();
    await disconnectRedis();
    logger.info('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    // Connect to database and Redis
    await connectDatabase();
    await connectRedis();

    // Initialize WebSocket service
    webSocketService = new WebSocketService(server);

    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📚 Health check: http://localhost:${PORT}/health`);
      logger.info(`🔗 API endpoint: http://localhost:${PORT}/api`);
      logger.info(`📖 API Documentation: http://localhost:${PORT}/api/docs`);
      logger.info(`📄 Swagger JSON: http://localhost:${PORT}/api/docs.json`);
      logger.info(`🔌 WebSocket server initialized`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server only if this file is run directly
if (require.main === module) {
  startServer();
}

export default app;
