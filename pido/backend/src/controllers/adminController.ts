/**
 * PIDO - Controlador de Administrador
 * ====================================
 * Maneja las peticiones administrativas
 */

import { Request, Response } from 'express';
import * as adminService from '@services/adminService';
import { sendSuccess } from '@utils/response';
import { asyncHandler } from '@middleware/errorHandler';
import logger from '@utils/logger';

/**
 * GET /api/admin/dashboard
 * Obtiene el dashboard de administrador
 */
export const getDashboard = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const dashboard = await adminService.getDashboard();

  sendSuccess(res, dashboard, 'Dashboard obtenido exitosamente');
});

/**
 * GET /api/admin/users
 * Lista todos los usuarios
 */
export const getUsers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const result = await adminService.getAllUsers(page, limit);

  sendSuccess(res, result.users, 'Usuarios obtenidos exitosamente', {
    page: result.total_pages > 0 ? page : 1,
    limit,
    total: result.total,
    total_pages: result.total_pages,
    has_next: page < result.total_pages,
    has_prev: page > 1,
  });
});

/**
 * GET /api/admin/users/:userId
 * Obtiene detalles de un usuario
 */
export const getUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);

  const user = await adminService.getUserDetails(userId);

  sendSuccess(res, user, 'Usuario obtenido exitosamente');
});

/**
 * PATCH /api/admin/users/:userId/deactivate
 * Desactiva un usuario
 */
export const deactivateUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);

  await adminService.deactivateUserAccount(userId);

  sendSuccess(res, null, 'Usuario desactivado exitosamente');
});

/**
 * GET /api/admin/transactions
 * Lista todas las transacciones con filtros
 */
export const getTransactions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const { status, type, fromDate, toDate } = req.query;

  const result = await adminService.getAllTransactions(
    {
      status: status as any,
      type: type as any,
      fromDate: fromDate ? new Date(fromDate as string) : undefined,
      toDate: toDate ? new Date(toDate as string) : undefined,
    },
    page,
    limit
  );

  sendSuccess(res, result.transactions, 'Transacciones obtenidas exitosamente', {
    page: result.total_pages > 0 ? page : 1,
    limit,
    total: result.total,
    total_pages: result.total_pages,
  });
});

/**
 * GET /api/admin/currencies
 * Obtiene todas las divisas
 */
export const getCurrencies = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const currencies = await adminService.getCurrencies();

  sendSuccess(res, currencies, 'Divisas obtenidas exitosamente');
});

/**
 * PUT /api/admin/exchange-rates/:from/:to
 * Actualiza una tasa de cambio
 */
export const updateExchangeRate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { from: fromCode, to: toCode } = req.params;
  const { rate, spreadPercentage } = req.body;

  await adminService.updateRate(fromCode, toCode, rate, spreadPercentage);

  sendSuccess(res, null, 'Tasa de cambio actualizada exitosamente');
});

/**
 * POST /api/admin/exchange-rates/refresh
 * Actualiza todas las tasas desde fuente externa
 */
export const refreshExchangeRates = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const updatedCount = await adminService.refreshAllExchangeRates();

  sendSuccess(res, { updated_count: updatedCount }, 'Tasas de cambio actualizadas exitosamente');
});

/**
 * GET /api/admin/exchange-rates
 * Obtiene el resumen de tasas de cambio
 */
export const getExchangeRates = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const rates = await adminService.getRatesSummary();

  sendSuccess(res, rates, 'Tasas de cambio obtenidas exitosamente');
});

/**
 * GET /api/admin/stats
 * Obtiene estadísticas del sistema
 */
export const getSystemStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const stats = await adminService.getSystemStats();

  sendSuccess(res, stats, 'Estadísticas obtenidas exitosamente');
});

export default {
  getDashboard,
  getUsers,
  getUser,
  deactivateUser,
  getTransactions,
  getCurrencies,
  updateExchangeRate,
  refreshExchangeRates,
  getExchangeRates,
  getSystemStats,
};
