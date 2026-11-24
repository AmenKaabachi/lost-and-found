
import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',

    info: {
      title: 'Lost and Found API',
      version: '1.0.0',
      description: 'Documentation des API de la plateforme Lost and Found.'
    },

    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Serveur local'
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
    },

    security: [
      {
        bearerAuth: []
      }
    ]
  },

  apis: ['./src/routes/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
