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
import jobRouter from './routes/jobRoutes.js';
import hrWorkflowRouter from './routes/hrWorkflowRoutes.js';
import applicationRouter from './routes/applicationRoutes.js';
import adminRouter from './routes/adminRoutes.js';
import matchingRouter from './routes/matchingRoutes.js';
import buildSwaggerSpec from './swagger.js';

dotenv.config();

const app = express();
app.set('etag', false); // prevent 304 responses when testing via Swagger
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
app.use('/applications', applicationRouter);
app.use('/hr', jobRouter);
app.use('/hr', hrWorkflowRouter);
app.use('/admin', adminRouter);
app.use('/matching', matchingRouter);

// Swagger docs
const serverUrl = process.env.API_BASE_URL || `http://localhost:${PORT}`;
const swaggerSpec = buildSwaggerSpec(serverUrl);
const swaggerUiOptions = {
  explorer: true,
  swaggerOptions: {
    displayRequestDuration: true,
    docExpansion: 'list',
    persistAuthorization: true,
    defaultModelRendering: 'model',
    syntaxHighlight: {
      activate: true,
      theme: 'agate'
    }
  }
};
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
console.log(`📄 Swagger docs available at ${serverUrl}/api-docs`);

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

