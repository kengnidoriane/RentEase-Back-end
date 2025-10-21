# RentEase Backend API

A secure and scalable backend API for RentEase - a platform connecting verified tenants with verified landlords.

## Features

- 🔐 JWT-based authentication with refresh tokens
- 👥 User management with role-based access control
- 🏠 Property listing and management
- 💬 Real-time messaging system
- ❤️ Favorites and user preferences
- 🔔 Notification system
- 📱 Admin dashboard
- 🧪 Comprehensive testing suite
- 🐳 Docker containerization
- 📚 API documentation with Swagger

## Tech Stack

- **Runtime:** Node.js 18+ with TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL with Prisma ORM
- **Cache:** Redis
- **Authentication:** JWT with Passport.js
- **Testing:** Jest + Supertest
- **Code Quality:** ESLint + Prettier + Husky

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (optional)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd rent-ease-backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database:
```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed the database
npm run db:seed
```

### Development

#### Using Docker (Recommended)

```bash
# Start all services (PostgreSQL, Redis, API)
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

#### Manual Setup

1. Start PostgreSQL and Redis services
2. Run the development server:
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Production Deployment

```bash
# Build the application
npm run build

# Start production server
npm start

# Or using Docker
docker-compose -f docker-compose.prod.yml up -d
```

## API Documentation

Once the server is running, visit:
- Health check: `http://localhost:3000/health`
- API documentation: `http://localhost:3000/api/docs` (coming soon)

## Project Structure

```
src/
├── controllers/     # Request handlers
├── services/        # Business logic
├── repositories/    # Data access layer
├── middleware/      # Express middleware
├── routes/          # API routes
├── utils/           # Utility functions
├── config/          # Configuration files
├── types/           # TypeScript definitions
└── __tests__/       # Test files
```

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with sample data

## Contributing

1. Follow the existing code style
2. Write tests for new features
3. Ensure all tests pass
4. Use conventional commit messages
5. Update documentation as needed

## License

MIT License - see LICENSE file for details