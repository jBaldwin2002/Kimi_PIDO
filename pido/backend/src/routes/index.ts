/**
 * PIDO - Rutas Principales
 * =========================
 * Configura y exporta todas las rutas de la API
 */

import { Router } from 'express';
import authRoutes from './authRoutes';
import walletRoutes from './walletRoutes';
import transactionRoutes from './transactionRoutes';
import adminRoutes from './adminRoutes';

const router = Router();

// Prefijo para todas las rutas de la API
const API_PREFIX = '/api';

// =====================================================
// RUTAS DE AUTENTICACIÓN
// =====================================================
router.use(`${API_PREFIX}/auth`, authRoutes);

// =====================================================
// RUTAS DE BILLETERAS
// =====================================================
router.use(`${API_PREFIX}/wallets`, walletRoutes);

// =====================================================
// RUTAS DE TRANSACCIONES
// =====================================================
router.use(`${API_PREFIX}/transactions`, transactionRoutes);

// =====================================================
// RUTAS DE ADMINISTRADOR
// =====================================================
router.use(`${API_PREFIX}/admin`, adminRoutes);

// =====================================================
// RUTA DE SALUD
// =====================================================
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'pido-api',
    version: '1.0.0',
  });
});

// =====================================================
// RUTA RAÍZ
// =====================================================
router.get('/', (req, res) => {
  res.json({
    message: 'Bienvenido a PIDO API',
    description: 'Digital Wallet & Currency Exchange System',
    version: '1.0.0',
    documentation: '/api/docs',
    health: '/health',
  });
});

export default router;
