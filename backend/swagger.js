
import swaggerAutogen from 'swagger-autogen';

const swagger = swaggerAutogen({
  openapi: '3.0.0'
});

const doc = {
  info: {
    title: 'Lost and Found API',
    version: '1.0.0',
    description: 'Documentation automatique des API Lost and Found.'
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
};

const outputFile = './swagger-output.json';

// Point d'entrée Express : les routes sont centralisées dans app.js
const routes = ['./src/app.js'];

swagger(outputFile, routes, doc).then(() => {
  console.log('Documentation Swagger générée avec succès.');
}).catch((error) => {
  console.error('Erreur lors de la génération Swagger :', error);
  process.exit(1);
});
