/**
 * PIDO - Servidor Principal
 * ==========================
 * Punto de entrada de la aplicación backend
 */

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Configurar variables de entorno
dotenv.config();

// Importar configuraciones y middleware
import { checkConnection } from '@config/database';
import routes from '@routes';
import { errorHandler, notFoundHandler } from '@middleware/errorHandler';
import { morganStream } from '@utils/logger';
import logger from '@utils/logger';

// =====================================================
// CONFIGURACIÓN DE LA APLICACIÓN
// =====================================================

const app: Application = express();
const PORT = parseInt(process.env.PORT || '3001');
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// =====================================================
// MIDDLEWARE DE SEGURIDAD
// =====================================================

// Helmet para headers de seguridad
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'), // 100 requests por ventana
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Demasiadas solicitudes, por favor intente más tarde',
    },
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Rate limiting más estricto para auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 intentos
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Demasiados intentos de autenticación, por favor intente más tarde',
    },
    timestamp: new Date().toISOString(),
  },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// =====================================================
// MIDDLEWARE DE LOGGING Y PARSING
// =====================================================

// Morgan para logging de requests HTTP
app.use(morgan(NODE_ENV === 'development' ? 'dev' : 'combined', { stream: morganStream }));

// Parsing de JSON y URL encoded
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// =====================================================
// RUTAS
// =====================================================

app.use(routes);

// =====================================================
// MANEJO DE ERRORES
// =====================================================

// Ruta no encontrada
app.use(notFoundHandler);

// Manejador de errores global
app.use(errorHandler);

// =====================================================
// INICIALIZACIÓN DEL SERVIDOR
// =====================================================

const startServer = async (): Promise<void> => {
  try {
    // Verificar conexión a base de datos
    logger.info('Verificando conexión a base de datos...');
    const dbConnected = await checkConnection();

    if (!dbConnected) {
      logger.error('No se pudo conectar a la base de datos');
      process.exit(1);
    }

    // Iniciar servidor
    app.listen(PORT, () => {
      logger.info(`========================================`);
      logger.info(`🚀 PIDO API Server iniciado`);
      logger.info(`📡 Puerto: ${PORT}`);
      logger.info(`🌍 Entorno: ${NODE_ENV}`);
      logger.info(`📊 Base de datos: Conectada`);
      logger.info(`========================================`);
    });
  } catch (error) {
    logger.error('Error iniciando el servidor:', { error: (error as Error).message });
    process.exit(1);
  }
};

// =====================================================
// MANEJO DE SEÑALES DE PROCESO
// =====================================================

// Cierre graceful
process.on('SIGTERM', async () => {
  logger.info('SIGTERM recibido, cerrando servidor...');
  const { closePool } = await import('@config/database');
  await closePool();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT recibido, cerrando servidor...');
  const { closePool } = await import('@config/database');
  await closePool();
  process.exit(0);
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  process.exit(1);
});

// Iniciar servidor
startServer();

export default app;
