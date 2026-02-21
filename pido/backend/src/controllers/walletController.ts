/**
 * PIDO - Controlador de Billeteras
 * =================================
 * Maneja las peticiones relacionadas con billeteras
 */

import { Request, Response } from 'express';
import * as walletService from '@services/walletService';
import { sendSuccess } from '@utils/response';
import { asyncHandler } from '@middleware/errorHandler';
import logger from '@utils/logger';

/**
 * GET /api/wallets
 * Obtiene las billeteras del usuario autenticado
 */
export const getMyWallets = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const wallets = await walletService.getUserWallets(userId);

  sendSuccess(res, wallets, 'Billeteras obtenidas exitosamente');
});

/**
 * GET /api/wallets/:walletId
 * Obtiene una billetera específica
 */
export const getWallet = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const walletId = parseInt(req.params.walletId, 10);

  const wallet = await walletService.getWalletById(walletId, userId);

  sendSuccess(res, wallet, 'Billetera obtenida exitosamente');
});

/**
 * POST /api/wallets
 * Crea una nueva billetera
 */
export const createWallet = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { name } = req.body;

  const wallet = await walletService.createUserWallet(userId, name);

  sendSuccess(res, wallet, 'Billetera creada exitosamente', undefined, 201);
});

/**
 * PUT /api/wallets/:walletId
 * Actualiza el nombre de una billetera
 */
export const updateWallet = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const walletId = parseInt(req.params.walletId, 10);
  const { name } = req.body;

  await walletService.updateWallet(walletId, userId, name);

  sendSuccess(res, null, 'Billetera actualizada exitosamente');
});

/**
 * PATCH /api/wallets/:walletId/primary
 * Establece una billetera como principal
 */
export const setPrimary = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const walletId = parseInt(req.params.walletId, 10);

  await walletService.setWalletAsPrimary(walletId, userId);

  sendSuccess(res, null, 'Billetera principal actualizada exitosamente');
});

/**
 * DELETE /api/wallets/:walletId
 * Elimina (desactiva) una billetera
 */
export const deleteWallet = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const walletId = parseInt(req.params.walletId, 10);

  await walletService.deleteWallet(walletId, userId);

  sendSuccess(res, null, 'Billetera eliminada exitosamente');
});

/**
 * GET /api/wallets/:walletId/balance/:currencyCode
 * Obtiene el saldo de una billetera en una divisa específica
 */
export const getBalance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const walletId = parseInt(req.params.walletId, 10);
  const { currencyCode } = req.params;

  const balance = await walletService.getWalletBalance(walletId, currencyCode);

  sendSuccess(res, balance, 'Saldo obtenido exitosamente');
});

/**
 * GET /api/wallets/summary
 * Obtiene el resumen de saldos del usuario
 */
export const getBalanceSummary = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const summary = await walletService.getBalanceSummary(userId);

  sendSuccess(res, summary, 'Resumen de saldos obtenido exitosamente');
});

/**
 * GET /api/wallets/primary
 * Obtiene la billetera principal del usuario
 */
export const getPrimaryWallet = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const wallet = await walletService.getPrimaryWallet(userId);

  if (!wallet) {
    sendSuccess(res, null, 'No tiene billetera principal');
    return;
  }

  sendSuccess(res, wallet, 'Billetera principal obtenida exitosamente');
});

/**
 * GET /api/wallets/lookup/:walletNumber
 * Busca una billetera por número (para transferencias)
 */
export const lookupWallet = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { walletNumber } = req.params;

  const wallet = await walletService.getWalletByNumber(walletNumber);

  if (!wallet) {
    sendSuccess(res, null, 'Billetera no encontrada');
    return;
  }

  // No revelar información sensible
  sendSuccess(res, {
    wallet_number: wallet.wallet_number,
    user_name: wallet.user_name,
  }, 'Billetera encontrada');
});

export default {
  getMyWallets,
  getWallet,
  createWallet,
  updateWallet,
  setPrimary,
  deleteWallet,
  getBalance,
  getBalanceSummary,
  getPrimaryWallet,
  lookupWallet,
};
