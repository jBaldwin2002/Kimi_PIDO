/**
 * PIDO - Rutas de Billeteras
 * ===========================
 * Define las rutas para gestión de billeteras
 */

import { Router } from 'express';
import * as walletController from '@controllers/walletController';
import { authenticate } from '@middleware/auth';
import {
  validateCreateWallet,
  validateUpdateWallet,
} from '@middleware/validation';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

/**
 * @route   GET /api/wallets
 * @desc    Obtiene las billeteras del usuario
 * @access  Privado
 */
router.get('/', walletController.getMyWallets);

/**
 * @route   GET /api/wallets/primary
 * @desc    Obtiene la billetera principal
 * @access  Privado
 */
router.get('/primary', walletController.getPrimaryWallet);

/**
 * @route   GET /api/wallets/summary
 * @desc    Obtiene el resumen de saldos
 * @access  Privado
 */
router.get('/summary', walletController.getBalanceSummary);

/**
 * @route   GET /api/wallets/lookup/:walletNumber
 * @desc    Busca una billetera por número
 * @access  Privado
 */
router.get('/lookup/:walletNumber', walletController.lookupWallet);

/**
 * @route   POST /api/wallets
 * @desc    Crea una nueva billetera
 * @access  Privado
 */
router.post('/', ...validateCreateWallet, walletController.createWallet);

/**
 * @route   GET /api/wallets/:walletId
 * @desc    Obtiene una billetera específica
 * @access  Privado
 */
router.get('/:walletId', walletController.getWallet);

/**
 * @route   PUT /api/wallets/:walletId
 * @desc    Actualiza el nombre de una billetera
 * @access  Privado
 */
router.put('/:walletId', ...validateUpdateWallet, walletController.updateWallet);

/**
 * @route   PATCH /api/wallets/:walletId/primary
 * @desc    Establece una billetera como principal
 * @access  Privado
 */
router.patch('/:walletId/primary', walletController.setPrimary);

/**
 * @route   DELETE /api/wallets/:walletId
 * @desc    Elimina (desactiva) una billetera
 * @access  Privado
 */
router.delete('/:walletId', walletController.deleteWallet);

/**
 * @route   GET /api/wallets/:walletId/balance/:currencyCode
 * @desc    Obtiene el saldo en una divisa específica
 * @access  Privado
 */
router.get('/:walletId/balance/:currencyCode', walletController.getBalance);

export default router;
