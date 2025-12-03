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
    }
  ]
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

