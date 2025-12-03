import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';

import connectDB from './config/db.js';
import errorHandler from './middlewares/errorHandler.js';
import healthRouter from './routes/healthRoutes.js';
import authRouter from './routes/authRoutes.js';
import aiRouter from './routes/aiRoutes.js';
import resumeRouter from './routes/resumeRoutes.js';
import buildSwaggerSpec from './swagger.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Core middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/', healthRouter);
app.use('/auth', authRouter);
app.use('/ai', aiRouter);
app.use('/resume', resumeRouter);

// Swagger docs
const serverUrl = process.env.API_BASE_URL || `http://localhost:${PORT}`;
const swaggerSpec = buildSwaggerSpec(serverUrl);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Error handler (keep last)
app.use(errorHandler);

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Backend listening on ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

export default app;

