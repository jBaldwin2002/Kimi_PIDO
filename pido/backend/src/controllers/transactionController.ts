/**
 * PIDO - Controlador de Transacciones
 * ====================================
 * Maneja las peticiones relacionadas con transacciones
 */

import { Request, Response } from 'express';
import * as transactionService from '@services/transactionService';
import { TransferRequest, ExchangeRequest } from '@types';
import { sendSuccess } from '@utils/response';
import { asyncHandler } from '@middleware/errorHandler';
import logger from '@utils/logger';

/**
 * POST /api/transactions/transfer
 * Realiza una transferencia entre billeteras
 */
export const transfer = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const transferData: TransferRequest = req.body;

  const transaction = await transactionService.transfer(userId, transferData);

  sendSuccess(res, transaction, 'Transferencia realizada exitosamente', undefined, 201);
});

/**
 * GET /api/transactions/exchange/preview
 * Obtiene una vista previa del intercambio
 */
export const getExchangePreview = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { from, to, amount } = req.query;

  const preview = await transactionService.getExchangePreview({
    from_currency_code: from as string,
    to_currency_code: to as string,
    amount: parseFloat(amount as string),
  });

  sendSuccess(res, preview, 'Vista previa del intercambio obtenida');
});

/**
 * POST /api/transactions/exchange
 * Realiza un intercambio de divisas
 */
export const exchange = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const exchangeData: ExchangeRequest = req.body;

  const transaction = await transactionService.exchange(userId, exchangeData);

  sendSuccess(res, transaction, 'Intercambio realizado exitosamente', undefined, 201);
});

/**
 * GET /api/transactions
 * Obtiene el historial de transacciones del usuario
 */
export const getMyTransactions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const result = await transactionService.getUserTransactions(userId, page, limit);

  sendSuccess(res, result.transactions, 'Transacciones obtenidas exitosamente', {
    page: result.total_pages > 0 ? page : 1,
    limit,
    total: result.total,
    total_pages: result.total_pages,
    has_next: page < result.total_pages,
    has_prev: page > 1,
  });
});

/**
 * GET /api/transactions/wallet/:walletId
 * Obtiene las transacciones de una billetera específica
 */
export const getWalletTransactions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const walletId = parseInt(req.params.walletId, 10);
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const result = await transactionService.getWalletTransactions(walletId, userId, page, limit);

  sendSuccess(res, result.transactions, 'Transacciones obtenidas exitosamente', {
    page,
    limit,
    total: result.total,
    total_pages: Math.ceil(result.total / limit),
  });
});

/**
 * GET /api/transactions/:transactionId
 * Obtiene el detalle de una transacción
 */
export const getTransaction = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const transactionId = parseInt(req.params.transactionId, 10);

  const transaction = await transactionService.getTransactionById(transactionId, userId);

  sendSuccess(res, transaction, 'Transacción obtenida exitosamente');
});

/**
 * GET /api/transactions/stats/summary
 * Obtiene estadísticas de transacciones del usuario
 */
export const getTransactionStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const stats = await transactionService.getUserTransactionStats(userId);

  sendSuccess(res, stats, 'Estadísticas obtenidas exitosamente');
});

/**
 * GET /api/transactions/recent
 * Obtiene las transacciones recientes del usuario
 */
export const getRecentTransactions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const limit = parseInt(req.query.limit as string) || 5;

  const transactions = await transactionService.getRecentUserTransactions(userId, limit);

  sendSuccess(res, transactions, 'Transacciones recientes obtenidas exitosamente');
});

export default {
  transfer,
  getExchangePreview,
  exchange,
  getMyTransactions,
  getWalletTransactions,
  getTransaction,
  getTransactionStats,
  getRecentTransactions,
};
