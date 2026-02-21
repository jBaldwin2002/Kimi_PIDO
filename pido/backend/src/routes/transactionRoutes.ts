/**
 * PIDO - Rutas de Transacciones
 * ==============================
 * Define las rutas para transacciones y operaciones financieras
 */

import { Router } from 'express';
import * as transactionController from '@controllers/transactionController';
import { authenticate } from '@middleware/auth';
import {
  validateTransfer,
  validateExchange,
  validateExchangePreview,
  validateTransactionList,
} from '@middleware/validation';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

/**
 * @route   POST /api/transactions/transfer
 * @desc    Realiza una transferencia entre billeteras
 * @access  Privado
 */
router.post('/transfer', ...validateTransfer, transactionController.transfer);

/**
 * @route   GET /api/transactions/exchange/preview
 * @desc    Obtiene vista previa de un intercambio
 * @access  Privado
 */
router.get('/exchange/preview', ...validateExchangePreview, transactionController.getExchangePreview);

/**
 * @route   POST /api/transactions/exchange
 * @desc    Realiza un intercambio de divisas
 * @access  Privado
 */
router.post('/exchange', ...validateExchange, transactionController.exchange);

/**
 * @route   GET /api/transactions
 * @desc    Obtiene el historial de transacciones del usuario
 * @access  Privado
 */
router.get('/', ...validateTransactionList, transactionController.getMyTransactions);

/**
 * @route   GET /api/transactions/recent
 * @desc    Obtiene las transacciones recientes
 * @access  Privado
 */
router.get('/recent', transactionController.getRecentTransactions);

/**
 * @route   GET /api/transactions/stats/summary
 * @desc    Obtiene estadísticas de transacciones
 * @access  Privado
 */
router.get('/stats/summary', transactionController.getTransactionStats);

/**
 * @route   GET /api/transactions/wallet/:walletId
 * @desc    Obtiene transacciones de una billetera específica
 * @access  Privado
 */
router.get('/wallet/:walletId', ...validateTransactionList, transactionController.getWalletTransactions);

/**
 * @route   GET /api/transactions/:transactionId
 * @desc    Obtiene el detalle de una transacción
 * @access  Privado
 */
router.get('/:transactionId', transactionController.getTransaction);

export default router;
