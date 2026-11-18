import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import swaggerUi from 'swagger-ui-express';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { usersRouter } from './routes/users.js';
import { documentsRouter } from './routes/documents.js';
import { getDb } from './db/database.js';
import { openApiSpec } from './openapi.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  getDb(); // Ensure DB schema and seed data exist

  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: true,
      allowedHeaders: ['Content-Type', 'x-user-id']
    })
  );

  app.use(express.json({ limit: '5mb' }));

  // OpenAPI JSON spec & Interactive Swagger UI
  app.get('/api/openapi.json', (_req, res) => {
    res.json(openApiSpec);
  });

  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      customSiteTitle: 'Ajaia Docs API — Swagger UI',
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'list'
      }
    })
  );

  app.get('/docs', (_req, res) => {
    res.redirect('/api/docs');
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'ajaia-docs-backend', timestamp: new Date().toISOString() });
  });

  app.use('/api/users', authMiddleware, usersRouter);
  app.use('/api/documents', authMiddleware, documentsRouter);

  // Serve built frontend static bundle if present (for single-service deployment)
  const frontendDist = path.resolve(__dirname, '../../Frontend/dist');
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  app.use(errorHandler);

  return app;
}
