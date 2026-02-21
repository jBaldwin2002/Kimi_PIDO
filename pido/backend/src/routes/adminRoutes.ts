/**
 * PIDO - Rutas de Administrador
 * ==============================
 * Define las rutas para funciones administrativas
 */

import { Router } from 'express';
import * as adminController from '@controllers/adminController';
import { authenticate, requireAdmin } from '@middleware/auth';
import {
  validateTransactionFilter,
  validateUpdateExchangeRate,
} from '@middleware/validation';

const router = Router();

// Todas las rutas requieren autenticación y ser administrador
router.use(authenticate, requireAdmin);

/**
 * @route   GET /api/admin/dashboard
 * @desc    Obtiene el dashboard de administrador
 * @access  Admin
 */
router.get('/dashboard', adminController.getDashboard);

/**
 * @route   GET /api/admin/stats
 * @desc    Obtiene estadísticas del sistema
 * @access  Admin
 */
router.get('/stats', adminController.getSystemStats);

// =====================================================
// RUTAS DE USUARIOS
// =====================================================

/**
 * @route   GET /api/admin/users
 * @desc    Lista todos los usuarios
 * @access  Admin
 */
router.get('/users', adminController.getUsers);

/**
 * @route   GET /api/admin/users/:userId
 * @desc    Obtiene detalles de un usuario
 * @access  Admin
 */
router.get('/users/:userId', adminController.getUser);

/**
 * @route   PATCH /api/admin/users/:userId/deactivate
 * @desc    Desactiva un usuario
 * @access  Admin
 */
router.patch('/users/:userId/deactivate', adminController.deactivateUser);

// =====================================================
// RUTAS DE TRANSACCIONES
// =====================================================

/**
 * @route   GET /api/admin/transactions
 * @desc    Lista todas las transacciones con filtros
 * @access  Admin
 */
router.get('/transactions', ...validateTransactionFilter, adminController.getTransactions);

// =====================================================
// RUTAS DE DIVISAS Y TASAS
// =====================================================

/**
 * @route   GET /api/admin/currencies
 * @desc    Obtiene todas las divisas
 * @access  Admin
 */
router.get('/currencies', adminController.getCurrencies);

/**
 * @route   GET /api/admin/exchange-rates
 * @desc    Obtiene el resumen de tasas de cambio
 * @access  Admin
 */
router.get('/exchange-rates', adminController.getExchangeRates);

/**
 * @route   PUT /api/admin/exchange-rates/:from/:to
 * @desc    Actualiza una tasa de cambio
 * @access  Admin
 */
router.put('/exchange-rates/:from/:to', ...validateUpdateExchangeRate, adminController.updateExchangeRate);

/**
 * @route   POST /api/admin/exchange-rates/refresh
 * @desc    Actualiza todas las tasas desde fuente externa
 * @access  Admin
 */
router.post('/exchange-rates/refresh', adminController.refreshExchangeRates);

export default router;
