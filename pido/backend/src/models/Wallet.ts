/**
 * PIDO - Modelo de Billetera
 * ==========================
 * Operaciones CRUD para wallets y wallet_balances
 */

import { query, withTransaction } from '@config/database';
import { Wallet, WalletBalance, Currency } from '@types';
import logger from '@utils/logger';

/**
 * Busca una billetera por ID
 * @param walletId - ID de la billetera
 * @returns Billetera o null
 */
export const findWalletById = async (walletId: number): Promise<Wallet | null> => {
  const result = await query<Wallet>(
    `SELECT w.*, u.email as user_email, u.first_name || ' ' || u.last_name as user_full_name
     FROM wallets w
     JOIN users u ON w.user_id = u.id
     WHERE w.id = $1`,
    [walletId]
  );

  return result.rows[0] || null;
};

/**
 * Busca una billetera por número de billetera
 * @param walletNumber - Número de billetera
 * @returns Billetera o null
 */
export const findWalletByNumber = async (walletNumber: string): Promise<Wallet | null> => {
  const result = await query<Wallet>(
    `SELECT w.*, u.email as user_email, u.first_name || ' ' || u.last_name as user_full_name
     FROM wallets w
     JOIN users u ON w.user_id = u.id
     WHERE w.wallet_number = $1`,
    [walletNumber]
  );

  return result.rows[0] || null;
};

/**
 * Busca una billetera por ID incluyendo el usuario
 * @param walletId - ID de la billetera
 * @returns Billetera con datos del usuario o null
 */
export const findWalletWithUser = async (walletId: number): Promise<(Wallet & { user_email: string; user_name: string }) | null> => {
  const result = await query(
    `SELECT w.*, u.email as user_email, u.first_name || ' ' || u.last_name as user_name
     FROM wallets w
     JOIN users u ON w.user_id = u.id
     WHERE w.id = $1`,
    [walletId]
  );

  return result.rows[0] || null;
};

/**
 * Lista las billeteras de un usuario
 * @param userId - ID del usuario
 * @returns Lista de billeteras
 */
export const findWalletsByUserId = async (userId: number): Promise<Wallet[]> => {
  const result = await query<Wallet>(
    `SELECT w.*
     FROM wallets w
     WHERE w.user_id = $1 AND w.is_active = true
     ORDER BY w.is_primary DESC, w.created_at DESC`,
    [userId]
  );

  return result.rows;
};

/**
 * Obtiene la billetera principal de un usuario
 * @param userId - ID del usuario
 * @returns Billetera principal o null
 */
export const findPrimaryWallet = async (userId: number): Promise<Wallet | null> => {
  const result = await query<Wallet>(
    `SELECT w.*
     FROM wallets w
     WHERE w.user_id = $1 AND w.is_primary = true AND w.is_active = true`,
    [userId]
  );

  return result.rows[0] || null;
};

/**
 * Obtiene los saldos de una billetera
 * @param walletId - ID de la billetera
 * @returns Lista de saldos con información de divisa
 */
export const getWalletBalances = async (walletId: number): Promise<(WalletBalance & Currency)[]> => {
  const result = await query(
    `SELECT wb.*, c.code, c.name, c.symbol, c.flag_emoji, c.decimal_places
     FROM wallet_balances wb
     JOIN currencies c ON wb.currency_id = c.id
     WHERE wb.wallet_id = $1 AND c.is_active = true
     ORDER BY c.is_base_currency DESC, c.code`,
    [walletId]
  );

  return result.rows;
};

/**
 * Obtiene el saldo de una billetera en una divisa específica
 * @param walletId - ID de la billetera
 * @param currencyId - ID de la divisa
 * @returns Saldo o null
 */
export const getWalletBalanceByCurrency = async (
  walletId: number,
  currencyId: number
): Promise<(WalletBalance & { currency_code: string }) | null> => {
  const result = await query(
    `SELECT wb.*, c.code as currency_code
     FROM wallet_balances wb
     JOIN currencies c ON wb.currency_id = c.id
     WHERE wb.wallet_id = $1 AND wb.currency_id = $2`,
    [walletId, currencyId]
  );

  return result.rows[0] || null;
};

/**
 * Obtiene el saldo de una billetera por código de divisa
 * @param walletId - ID de la billetera
 * @param currencyCode - Código de la divisa (USD, EUR, etc.)
 * @returns Saldo o null
 */
export const getWalletBalanceByCurrencyCode = async (
  walletId: number,
  currencyCode: string
): Promise<(WalletBalance & { currency_code: string }) | null> => {
  const result = await query(
    `SELECT wb.*, c.code as currency_code
     FROM wallet_balances wb
     JOIN currencies c ON wb.currency_id = c.id
     WHERE wb.wallet_id = $1 AND c.code = $2`,
    [walletId, currencyCode.toUpperCase()]
  );

  return result.rows[0] || null;
};

/**
 * Crea una nueva billetera para un usuario
 * @param userId - ID del usuario
 * @param name - Nombre de la billetera
 * @param isPrimary - Si es la billetera principal
 * @returns Billetera creada
 */
export const createWallet = async (
  userId: number,
  name: string = 'Mi Billetera',
  isPrimary: boolean = false
): Promise<Wallet> => {
  return withTransaction(async (client) => {
    // Si es primaria, desmarcar las otras
    if (isPrimary) {
      await client.query(
        `UPDATE wallets SET is_primary = false WHERE user_id = $1`,
        [userId]
      );
    }

    const result = await client.query<Wallet>(
      `INSERT INTO wallets (user_id, name, is_primary)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, name, isPrimary]
    );

    const wallet = result.rows[0];

    logger.info('Billetera creada', { walletId: wallet.id, userId });

    return wallet;
  });
};

/**
 * Actualiza el saldo de una billetera
 * @param walletId - ID de la billetera
 * @param currencyId - ID de la divisa
 * @param amount - Cantidad a agregar (positiva) o restar (negativa)
 * @param client - Cliente de transacción (opcional)
 * @returns Saldo actualizado
 */
export const updateBalance = async (
  walletId: number,
  currencyId: number,
  amount: number,
  client?: any
): Promise<WalletBalance> => {
  const executor = client || { query };

  const result = await executor.query(
    `UPDATE wallet_balances 
     SET balance = balance + $1,
         available_balance = available_balance + $1,
         last_transaction_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE wallet_id = $2 AND currency_id = $3
     RETURNING *`,
    [amount, walletId, currencyId]
  );

  if (result.rows.length === 0) {
    throw new Error('Balance not found');
  }

  return result.rows[0];
};

/**
 * Verifica si hay saldo suficiente
 * @param walletId - ID de la billetera
 * @param currencyId - ID de la divisa
 * @param amount - Cantidad requerida
 * @returns true si hay saldo suficiente
 */
export const hasSufficientBalance = async (
  walletId: number,
  currencyId: number,
  amount: number
): Promise<boolean> => {
  const result = await query(
    `SELECT available_balance 
     FROM wallet_balances 
     WHERE wallet_id = $1 AND currency_id = $2`,
    [walletId, currencyId]
  );

  if (result.rows.length === 0) {
    return false;
  }

  return parseFloat(result.rows[0].available_balance) >= amount;
};

/**
 * Retiene saldo (para transacciones pendientes)
 * @param walletId - ID de la billetera
 * @param currencyId - ID de la divisa
 * @param amount - Cantidad a retener
 */
export const holdBalance = async (
  walletId: number,
  currencyId: number,
  amount: number
): Promise<void> => {
  await query(
    `UPDATE wallet_balances 
     SET available_balance = available_balance - $1,
         held_balance = held_balance + $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE wallet_id = $2 AND currency_id = $3 AND available_balance >= $1`,
    [amount, walletId, currencyId]
  );
};

/**
 * Libera saldo retenido
 * @param walletId - ID de la billetera
 * @param currencyId - ID de la divisa
 * @param amount - Cantidad a liberar
 */
export const releaseHeldBalance = async (
  walletId: number,
  currencyId: number,
  amount: number
): Promise<void> => {
  await query(
    `UPDATE wallet_balances 
     SET available_balance = available_balance + $1,
         held_balance = held_balance - $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE wallet_id = $2 AND currency_id = $3 AND held_balance >= $1`,
    [amount, walletId, currencyId]
  );
};

/**
 * Actualiza el nombre de una billetera
 * @param walletId - ID de la billetera
 * @param name - Nuevo nombre
 */
export const updateWalletName = async (walletId: number, name: string): Promise<void> => {
  await query(
    `UPDATE wallets 
     SET name = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [name, walletId]
  );

  logger.info('Nombre de billetera actualizado', { walletId, name });
};

/**
 * Establece una billetera como principal
 * @param walletId - ID de la billetera
 * @param userId - ID del usuario (para seguridad)
 */
export const setPrimaryWallet = async (walletId: number, userId: number): Promise<void> => {
  await withTransaction(async (client) => {
    // Desmarcar todas las billeteras del usuario
    await client.query(
      `UPDATE wallets SET is_primary = false WHERE user_id = $1`,
      [userId]
    );

    // Marcar la seleccionada como principal
    await client.query(
      `UPDATE wallets SET is_primary = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [walletId]
    );
  });

  logger.info('Billetera principal actualizada', { walletId, userId });
};

/**
 * Desactiva una billetera
 * @param walletId - ID de la billetera
 */
export const deactivateWallet = async (walletId: number): Promise<void> => {
  await query(
    `UPDATE wallets 
     SET is_active = false, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [walletId]
  );

  logger.info('Billetera desactivada', { walletId });
};

/**
 * Obtiene el resumen de saldos de un usuario en todas sus billeteras
 * @param userId - ID del usuario
 * @returns Resumen de saldos por divisa
 */
export const getUserBalanceSummary = async (
  userId: number
): Promise<{ currency_code: string; total_balance: number; symbol: string }[]> => {
  const result = await query(
    `SELECT c.code as currency_code, c.symbol, SUM(wb.balance) as total_balance
     FROM wallet_balances wb
     JOIN wallets w ON wb.wallet_id = w.id
     JOIN currencies c ON wb.currency_id = c.id
     WHERE w.user_id = $1 AND w.is_active = true AND c.is_active = true
     GROUP BY c.code, c.symbol
     HAVING SUM(wb.balance) > 0
     ORDER BY total_balance DESC`,
    [userId]
  );

  return result.rows.map(row => ({
    currency_code: row.currency_code,
    symbol: row.symbol,
    total_balance: parseFloat(row.total_balance),
  }));
};

export default {
  findWalletById,
  findWalletByNumber,
  findWalletWithUser,
  findWalletsByUserId,
  findPrimaryWallet,
  getWalletBalances,
  getWalletBalanceByCurrency,
  getWalletBalanceByCurrencyCode,
  createWallet,
  updateBalance,
  hasSufficientBalance,
  holdBalance,
  releaseHeldBalance,
  updateWalletName,
  setPrimaryWallet,
  deactivateWallet,
  getUserBalanceSummary,
};
