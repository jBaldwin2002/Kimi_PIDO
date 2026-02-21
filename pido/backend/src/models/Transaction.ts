/**
 * PIDO - Modelo de Transacciones
 * ================================
 * Operaciones CRUD para transactions y transaction_logs
 */

import { query, withTransaction } from '@config/database';
import { Transaction, TransactionType, TransactionStatus, TransactionLog } from '@types';
import logger from '@utils/logger';

/**
 * Crea una nueva transacción
 * @param transactionData - Datos de la transacción
 * @returns Transacción creada
 */
export const createTransaction = async (
  transactionData: Partial<Transaction>
): Promise<Transaction> => {
  const result = await query<Transaction>(
    `INSERT INTO transactions (
      transaction_type, status, from_wallet_id, to_wallet_id,
      from_user_id, to_user_id, from_currency_id, to_currency_id,
      from_amount, to_amount, exchange_rate, fee_amount, fee_currency_id,
      description, reference_code, external_reference, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING *`,
    [
      transactionData.transaction_type,
      transactionData.status || TransactionStatus.PENDING,
      transactionData.from_wallet_id,
      transactionData.to_wallet_id,
      transactionData.from_user_id,
      transactionData.to_user_id,
      transactionData.from_currency_id,
      transactionData.to_currency_id,
      transactionData.from_amount,
      transactionData.to_amount,
      transactionData.exchange_rate,
      transactionData.fee_amount || 0,
      transactionData.fee_currency_id,
      transactionData.description,
      transactionData.reference_code,
      transactionData.external_reference,
      JSON.stringify(transactionData.metadata || {}),
    ]
  );

  logger.info('Transacción creada', {
    transactionId: result.rows[0].id,
    type: result.rows[0].transaction_type,
  });

  return result.rows[0];
};

/**
 * Busca una transacción por ID
 * @param transactionId - ID de la transacción
 * @returns Transacción o null
 */
export const findTransactionById = async (transactionId: number): Promise<Transaction | null> => {
  const result = await query<Transaction>(
    `SELECT t.*
     FROM transactions t
     WHERE t.id = $1`,
    [transactionId]
  );

  return result.rows[0] || null;
};

/**
 * Busca una transacción por número
 * @param transactionNumber - Número de transacción
 * @returns Transacción o null
 */
export const findTransactionByNumber = async (
  transactionNumber: string
): Promise<Transaction | null> => {
  const result = await query<Transaction>(
    `SELECT t.*
     FROM transactions t
     WHERE t.transaction_number = $1`,
    [transactionNumber]
  );

  return result.rows[0] || null;
};

/**
 * Lista transacciones de un usuario (como remitente o destinatario)
 * @param userId - ID del usuario
 * @param page - Página
 * @param limit - Límite por página
 * @returns Transacciones y total
 */
export const findTransactionsByUser = async (
  userId: number,
  page: number = 1,
  limit: number = 20
): Promise<{ transactions: Transaction[]; total: number }> => {
  const offset = (page - 1) * limit;

  const [transactionsResult, countResult] = await Promise.all([
    query<Transaction>(
      `SELECT t.*
       FROM transactions t
       WHERE t.from_user_id = $1 OR t.to_user_id = $1
       ORDER BY t.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    ),
    query(
      `SELECT COUNT(*) as total 
       FROM transactions 
       WHERE from_user_id = $1 OR to_user_id = $1`,
      [userId]
    ),
  ]);

  return {
    transactions: transactionsResult.rows,
    total: parseInt(countResult.rows[0].total, 10),
  };
};

/**
 * Lista transacciones de una billetera específica
 * @param walletId - ID de la billetera
 * @param page - Página
 * @param limit - Límite por página
 * @returns Transacciones y total
 */
export const findTransactionsByWallet = async (
  walletId: number,
  page: number = 1,
  limit: number = 20
): Promise<{ transactions: Transaction[]; total: number }> => {
  const offset = (page - 1) * limit;

  const [transactionsResult, countResult] = await Promise.all([
    query<Transaction>(
      `SELECT t.*
       FROM transactions t
       WHERE t.from_wallet_id = $1 OR t.to_wallet_id = $1
       ORDER BY t.created_at DESC
       LIMIT $2 OFFSET $3`,
      [walletId, limit, offset]
    ),
    query(
      `SELECT COUNT(*) as total 
       FROM transactions 
       WHERE from_wallet_id = $1 OR to_wallet_id = $1`,
      [walletId]
    ),
  ]);

  return {
    transactions: transactionsResult.rows,
    total: parseInt(countResult.rows[0].total, 10),
  };
};

/**
 * Actualiza el estado de una transacción
 * @param transactionId - ID de la transacción
 * @param status - Nuevo estado
 * @param metadata - Metadatos adicionales (opcional)
 * @returns Transacción actualizada
 */
export const updateTransactionStatus = async (
  transactionId: number,
  status: TransactionStatus,
  metadata?: Record<string, any>
): Promise<Transaction> => {
  const updates: string[] = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
  const values: any[] = [status];
  let paramIndex = 2;

  if (status === TransactionStatus.COMPLETED) {
    updates.push(`completed_at = CURRENT_TIMESTAMP`);
  }

  if (metadata) {
    updates.push(`metadata = metadata || $${paramIndex}`);
    values.push(JSON.stringify(metadata));
    paramIndex++;
  }

  values.push(transactionId);

  const result = await query<Transaction>(
    `UPDATE transactions 
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  logger.info('Estado de transacción actualizado', {
    transactionId,
    newStatus: status,
  });

  return result.rows[0];
};

/**
 * Obtiene el historial de logs de una transacción
 * @param transactionId - ID de la transacción
 * @returns Lista de logs
 */
export const getTransactionLogs = async (transactionId: number): Promise<TransactionLog[]> => {
  const result = await query<TransactionLog>(
    `SELECT tl.*, u.email as performed_by_email
     FROM transaction_logs tl
     LEFT JOIN users u ON tl.performed_by = u.id
     WHERE tl.transaction_id = $1
     ORDER BY tl.created_at DESC`,
    [transactionId]
  );

  return result.rows;
};

/**
 * Lista todas las transacciones (para admin)
 * @param filters - Filtros opcionales
 * @param page - Página
 * @param limit - Límite por página
 * @returns Transacciones y total
 */
export const listAllTransactions = async (
  filters: {
    status?: TransactionStatus;
    type?: TransactionType;
    fromDate?: Date;
    toDate?: Date;
  } = {},
  page: number = 1,
  limit: number = 20
): Promise<{ transactions: Transaction[]; total: number }> => {
  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (filters.status) {
    conditions.push(`status = $${paramIndex}`);
    values.push(filters.status);
    paramIndex++;
  }

  if (filters.type) {
    conditions.push(`transaction_type = $${paramIndex}`);
    values.push(filters.type);
    paramIndex++;
  }

  if (filters.fromDate) {
    conditions.push(`created_at >= $${paramIndex}`);
    values.push(filters.fromDate);
    paramIndex++;
  }

  if (filters.toDate) {
    conditions.push(`created_at <= $${paramIndex}`);
    values.push(filters.toDate);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [transactionsResult, countResult] = await Promise.all([
    query<Transaction>(
      `SELECT t.*
       FROM transactions t
       ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    ),
    query(
      `SELECT COUNT(*) as total 
       FROM transactions 
       ${whereClause}`,
      values
    ),
  ]);

  return {
    transactions: transactionsResult.rows,
    total: parseInt(countResult.rows[0].total, 10),
  };
};

/**
 * Obtiene estadísticas de transacciones de un usuario
 * @param userId - ID del usuario
 * @returns Estadísticas
 */
export const getTransactionStats = async (userId: number): Promise<{
  total_sent: number;
  total_received: number;
  total_exchanged: number;
  transaction_count: number;
}> => {
  const result = await query(
    `SELECT 
      COALESCE(SUM(CASE WHEN from_user_id = $1 THEN from_amount ELSE 0 END), 0) as total_sent,
      COALESCE(SUM(CASE WHEN to_user_id = $1 THEN to_amount ELSE 0 END), 0) as total_received,
      COALESCE(SUM(CASE WHEN transaction_type = 'exchange' AND from_user_id = $1 THEN from_amount ELSE 0 END), 0) as total_exchanged,
      COUNT(*) as transaction_count
     FROM transactions
     WHERE (from_user_id = $1 OR to_user_id = $1) AND status = 'completed'`,
    [userId]
  );

  return {
    total_sent: parseFloat(result.rows[0].total_sent),
    total_received: parseFloat(result.rows[0].total_received),
    total_exchanged: parseFloat(result.rows[0].total_exchanged),
    transaction_count: parseInt(result.rows[0].transaction_count, 10),
  };
};

/**
 * Obtiene transacciones recientes de un usuario
 * @param userId - ID del usuario
 * @param limit - Número de transacciones a retornar
 * @returns Lista de transacciones
 */
export const getRecentTransactions = async (
  userId: number,
  limit: number = 5
): Promise<Transaction[]> => {
  const result = await query<Transaction>(
    `SELECT t.*
     FROM transactions t
     WHERE (t.from_user_id = $1 OR t.to_user_id = $1) 
       AND t.status = 'completed'
     ORDER BY t.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows;
};

export default {
  createTransaction,
  findTransactionById,
  findTransactionByNumber,
  findTransactionsByUser,
  findTransactionsByWallet,
  updateTransactionStatus,
  getTransactionLogs,
  listAllTransactions,
  getTransactionStats,
  getRecentTransactions,
};
