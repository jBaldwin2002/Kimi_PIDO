/**
 * PIDO - Servicio de Administrador
 * =================================
 * Lógica de negocio para funciones administrativas
 */

import { listUsers, findUserById, deactivateUser } from '@models/User';
import { listAllTransactions } from '@models/Transaction';
import {
  getAllCurrencies,
  findCurrencyByCode,
  updateExchangeRate,
  updateAllExchangeRatesFromExternal,
  getExchangeRatesSummary,
} from '@models/Currency';
import { query } from '@config/database';
import { TransactionStatus, TransactionType } from '@types';
import { NotFoundError, ValidationError } from '@middleware/errorHandler';
import logger from '@utils/logger';

/**
 * Obtiene el dashboard de administrador
 * @returns Estadísticas del sistema
 */
export const getDashboard = async (): Promise<{
  total_users: number;
  total_wallets: number;
  total_transactions: number;
  total_volume: number;
  pending_transactions: number;
  active_currencies: number;
  recent_transactions: any[];
}> => {
  // Estadísticas de usuarios
  const usersResult = await query(`SELECT COUNT(*) as total FROM users WHERE is_active = true`);
  
  // Estadísticas de billeteras
  const walletsResult = await query(`SELECT COUNT(*) as total FROM wallets WHERE is_active = true`);
  
  // Estadísticas de transacciones
  const transactionsResult = await query(`SELECT COUNT(*) as total FROM transactions`);
  
  // Volumen total
  const volumeResult = await query(
    `SELECT COALESCE(SUM(from_amount), 0) as total FROM transactions WHERE status = 'completed'`
  );
  
  // Transacciones pendientes
  const pendingResult = await query(
    `SELECT COUNT(*) as total FROM transactions WHERE status = 'pending'`
  );
  
  // Divisas activas
  const currenciesResult = await query(`SELECT COUNT(*) as total FROM currencies WHERE is_active = true`);
  
  // Transacciones recientes
  const recentResult = await query(
    `SELECT t.*, u.email as user_email
     FROM transactions t
     LEFT JOIN users u ON t.from_user_id = u.id
     ORDER BY t.created_at DESC
     LIMIT 10`
  );

  return {
    total_users: parseInt(usersResult.rows[0].total, 10),
    total_wallets: parseInt(walletsResult.rows[0].total, 10),
    total_transactions: parseInt(transactionsResult.rows[0].total, 10),
    total_volume: parseFloat(volumeResult.rows[0].total),
    pending_transactions: parseInt(pendingResult.rows[0].total, 10),
    active_currencies: parseInt(currenciesResult.rows[0].total, 10),
    recent_transactions: recentResult.rows,
  };
};

/**
 * Lista todos los usuarios con paginación
 * @param page - Página
 * @param limit - Límite por página
 * @returns Lista de usuarios
 */
export const getAllUsers = async (
  page: number = 1,
  limit: number = 20
): Promise<{ users: any[]; total: number; total_pages: number }> => {
  const { users, total } = await listUsers(page, limit);

  return {
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      role: (user as any).role_name,
      is_active: user.is_active,
      is_verified: user.is_verified,
      created_at: user.created_at,
      last_login_at: user.last_login_at,
    })),
    total,
    total_pages: Math.ceil(total / limit),
  };
};

/**
 * Obtiene detalles de un usuario
 * @param userId - ID del usuario
 * @returns Detalles del usuario
 */
export const getUserDetails = async (userId: number): Promise<any> => {
  const user = await findUserById(userId);

  if (!user) {
    throw new NotFoundError('Usuario');
  }

  // Obtener billeteras del usuario
  const walletsResult = await query(
    `SELECT w.*, 
            (SELECT json_agg(json_build_object(
              'currency_code', c.code,
              'balance', wb.balance,
              'symbol', c.symbol
            ))
            FROM wallet_balances wb
            JOIN currencies c ON wb.currency_id = c.id
            WHERE wb.wallet_id = w.id AND wb.balance > 0
            ) as balances
     FROM wallets w
     WHERE w.user_id = $1`,
    [userId]
  );

  // Obtener estadísticas de transacciones
  const statsResult = await query(
    `SELECT 
      COUNT(*) as total_transactions,
      COALESCE(SUM(CASE WHEN from_user_id = $1 THEN from_amount ELSE 0 END), 0) as total_sent,
      COALESCE(SUM(CASE WHEN to_user_id = $1 THEN to_amount ELSE 0 END), 0) as total_received
     FROM transactions
     WHERE (from_user_id = $1 OR to_user_id = $1) AND status = 'completed'`,
    [userId]
  );

  return {
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      document_id: user.document_id,
      is_active: user.is_active,
      is_verified: user.is_verified,
      created_at: user.created_at,
      last_login_at: user.last_login_at,
    },
    wallets: walletsResult.rows,
    stats: statsResult.rows[0],
  };
};

/**
 * Desactiva un usuario
 * @param userId - ID del usuario
 */
export const deactivateUserAccount = async (userId: number): Promise<void> => {
  const user = await findUserById(userId);

  if (!user) {
    throw new NotFoundError('Usuario');
  }

  await deactivateUser(userId);

  logger.info('Usuario desactivado por admin', { userId });
};

/**
 * Lista todas las transacciones con filtros
 * @param filters - Filtros
 * @param page - Página
 * @param limit - Límite por página
 * @returns Lista de transacciones
 */
export const getAllTransactions = async (
  filters: {
    status?: TransactionStatus;
    type?: TransactionType;
    fromDate?: Date;
    toDate?: Date;
  },
  page: number = 1,
  limit: number = 20
): Promise<{ transactions: any[]; total: number; total_pages: number }> => {
  const { transactions, total } = await listAllTransactions(filters, page, limit);

  return {
    transactions: transactions.map((tx) => ({
      id: tx.id,
      transaction_number: tx.transaction_number,
      transaction_type: tx.transaction_type,
      status: tx.status,
      from_amount: parseFloat(tx.from_amount),
      to_amount: tx.to_amount ? parseFloat(tx.to_amount) : null,
      created_at: tx.created_at,
      from_user_id: tx.from_user_id,
      to_user_id: tx.to_user_id,
    })),
    total,
    total_pages: Math.ceil(total / limit),
  };
};

/**
 * Obtiene todas las divisas
 * @returns Lista de divisas
 */
export const getCurrencies = async (): Promise<any[]> => {
  const currencies = await getAllCurrencies();

  return currencies.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    symbol: c.symbol,
    flag_emoji: c.flag_emoji,
    is_active: c.is_active,
    is_base_currency: c.is_base_currency,
    decimal_places: c.decimal_places,
  }));
};

/**
 * Actualiza una tasa de cambio
 * @param fromCode - Código divisa origen
 * @param toCode - Código divisa destino
 * @param rate - Nueva tasa
 * @param spreadPercentage - Porcentaje de spread
 */
export const updateRate = async (
  fromCode: string,
  toCode: string,
  rate: number,
  spreadPercentage: number = 0
): Promise<void> => {
  const fromCurrency = await findCurrencyByCode(fromCode);
  const toCurrency = await findCurrencyByCode(toCode);

  if (!fromCurrency) {
    throw new NotFoundError(`Divisa ${fromCode}`);
  }

  if (!toCurrency) {
    throw new NotFoundError(`Divisa ${toCode}`);
  }

  if (fromCurrency.id === toCurrency.id) {
    throw new ValidationError('No puede actualizar la tasa de una divisa consigo misma');
  }

  await updateExchangeRate(fromCurrency.id, toCurrency.id, rate, spreadPercentage);

  logger.info('Tasa de cambio actualizada por admin', {
    from: fromCode,
    to: toCode,
    rate,
    spreadPercentage,
  });
};

/**
 * Actualiza todas las tasas desde fuente externa
 * @returns Número de tasas actualizadas
 */
export const refreshAllExchangeRates = async (): Promise<number> => {
  const updatedCount = await updateAllExchangeRatesFromExternal();
  
  logger.info('Todas las tasas actualizadas desde fuente externa', { updatedCount });
  
  return updatedCount;
};

/**
 * Obtiene el resumen de tasas de cambio
 * @returns Lista de tasas
 */
export const getRatesSummary = async (): Promise<any[]> => {
  return getExchangeRatesSummary();
};

/**
 * Obtiene estadísticas del sistema
 * @returns Estadísticas detalladas
 */
export const getSystemStats = async (): Promise<{
  users: {
    total: number;
    active: number;
    inactive: number;
    new_this_month: number;
  };
  transactions: {
    total: number;
    completed: number;
    pending: number;
    failed: number;
    volume_total: number;
  };
  wallets: {
    total: number;
    active: number;
    with_balance: number;
  };
}> => {
  // Estadísticas de usuarios
  const usersStats = await query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN is_active = true THEN 1 END) as active,
      COUNT(CASE WHEN is_active = false THEN 1 END) as inactive,
      COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as new_this_month
    FROM users
  `);

  // Estadísticas de transacciones
  const txStats = await query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN from_amount ELSE 0 END), 0) as volume_total
    FROM transactions
  `);

  // Estadísticas de billeteras
  const walletStats = await query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN is_active = true THEN 1 END) as active,
      (SELECT COUNT(DISTINCT wallet_id) FROM wallet_balances WHERE balance > 0) as with_balance
    FROM wallets
  `);

  return {
    users: {
      total: parseInt(usersStats.rows[0].total, 10),
      active: parseInt(usersStats.rows[0].active, 10),
      inactive: parseInt(usersStats.rows[0].inactive, 10),
      new_this_month: parseInt(usersStats.rows[0].new_this_month, 10),
    },
    transactions: {
      total: parseInt(txStats.rows[0].total, 10),
      completed: parseInt(txStats.rows[0].completed, 10),
      pending: parseInt(txStats.rows[0].pending, 10),
      failed: parseInt(txStats.rows[0].failed, 10),
      volume_total: parseFloat(txStats.rows[0].volume_total),
    },
    wallets: {
      total: parseInt(walletStats.rows[0].total, 10),
      active: parseInt(walletStats.rows[0].active, 10),
      with_balance: parseInt(walletStats.rows[0].with_balance, 10),
    },
  };
};

export default {
  getDashboard,
  getAllUsers,
  getUserDetails,
  deactivateUserAccount,
  getAllTransactions,
  getCurrencies,
  updateRate,
  refreshAllExchangeRates,
  getRatesSummary,
  getSystemStats,
};
