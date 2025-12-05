import swaggerJsdoc from 'swagger-jsdoc';

const baseDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'AI Screener Backend API',
    version: '0.1.0',
    description:
      'Express + MongoDB gateway for the AI Screener platform. All business logic will be layered on top of this skeleton.'
  },
  tags: [
    {
      name: 'Health',
      description: 'Service uptime probes'
    },
    {
      name: 'Auth',
      description: 'Authentication and authorization endpoints'
    },
    {
      name: 'Resume',
      description: 'Candidate resume management APIs'
    },
    {
      name: 'HR Jobs',
      description: 'Job description CRUD and matching for HR users'
    },
    {
      name: 'Applications',
      description: 'Candidate-side application submission and tracking'
    },
    {
      name: 'HR Workflows',
      description: 'Review queues, comments, and audit trail for HR teams'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  }
};

const swaggerOptions = {
  apis: ['./src/routes/**/*.js']
};

const buildSwaggerSpec = (serverUrl = 'http://localhost:5000') => {
  return swaggerJsdoc({
    ...swaggerOptions,
    definition: {
      ...baseDefinition,
      servers: [{ url: serverUrl }]
    }
  });
};

export default buildSwaggerSpec;

