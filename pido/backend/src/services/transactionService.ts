/**
 * PIDO - Servicio de Transacciones
 * =================================
 * Lógica de negocio para transferencias e intercambios
 */

import { withTransaction } from '@config/database';
import {
  createTransaction,
  findTransactionById,
  findTransactionsByUser,
  findTransactionsByWallet,
  updateTransactionStatus,
  listAllTransactions,
  getTransactionStats,
  getRecentTransactions,
} from '@models/Transaction';
import {
  findWalletById,
  findWalletByNumber,
  getWalletBalanceByCurrency,
  updateBalance,
  hasSufficientBalance,
} from '@models/Wallet';
import { findCurrencyByCode, getExchangeRateByCodes, calculateExchange } from '@models/Currency';
import { TransactionType, TransactionStatus, TransferRequest, ExchangeRequest, ExchangePreview, TransactionResponse } from '@types';
import {
  NotFoundError,
  ValidationError,
  InsufficientBalanceError,
  WalletNotFoundError,
  CurrencyNotFoundError,
  ExchangeRateNotFoundError,
  TransactionError,
  AuthorizationError,
} from '@middleware/errorHandler';
import logger from '@utils/logger';

/**
 * Realiza una transferencia entre billeteras
 * @param fromUserId - ID del usuario remitente
 * @param transferData - Datos de la transferencia
 * @returns Transacción creada
 */
export const transfer = async (
  fromUserId: number,
  transferData: TransferRequest
): Promise<TransactionResponse> => {
  return withTransaction(async (client) => {
    // Buscar billetera origen (principal del usuario)
    const fromWallet = await findWalletById(
      (await findWalletByNumber((await getPrimaryWallet(fromUserId))?.wallet_number || ''))?.id || 0
    );

    if (!fromWallet) {
      throw new WalletNotFoundError('Billetera origen no encontrada');
    }

    if (fromWallet.user_id !== fromUserId) {
      throw new AuthorizationError();
    }

    // Buscar billetera destino
    const toWallet = await findWalletByNumber(transferData.to_wallet_number);

    if (!toWallet) {
      throw new WalletNotFoundError('Billetera destino no encontrada');
    }

    // No permitir transferir a la misma billetera
    if (fromWallet.id === toWallet.id) {
      throw new ValidationError('No puede transferir a su propia billetera');
    }

    // Buscar divisa
    const currency = await findCurrencyByCode(transferData.currency_code);

    if (!currency) {
      throw new CurrencyNotFoundError();
    }

    // Verificar saldo suficiente
    const hasBalance = await hasSufficientBalance(
      fromWallet.id,
      currency.id,
      transferData.amount
    );

    if (!hasBalance) {
      throw new InsufficientBalanceError();
    }

    // Crear transacción
    const transaction = await createTransaction({
      transaction_type: TransactionType.TRANSFER_SENT,
      status: TransactionStatus.PENDING,
      from_wallet_id: fromWallet.id,
      to_wallet_id: toWallet.id,
      from_user_id: fromUserId,
      to_user_id: toWallet.user_id,
      from_currency_id: currency.id,
      to_currency_id: currency.id,
      from_amount: transferData.amount,
      to_amount: transferData.amount,
      fee_amount: 0,
      description: transferData.description || `Transferencia a ${toWallet.wallet_number}`,
    });

    // Actualizar saldos
    await updateBalance(fromWallet.id, currency.id, -transferData.amount, client);
    await updateBalance(toWallet.id, currency.id, transferData.amount, client);

    // Actualizar estado de la transacción
    const completedTransaction = await updateTransactionStatus(
      transaction.id,
      TransactionStatus.COMPLETED,
      { completed_at: new Date().toISOString() }
    );

    // Crear transacción recibida para el destinatario
    await createTransaction({
      transaction_type: TransactionType.TRANSFER_RECEIVED,
      status: TransactionStatus.COMPLETED,
      from_wallet_id: fromWallet.id,
      to_wallet_id: toWallet.id,
      from_user_id: fromUserId,
      to_user_id: toWallet.user_id,
      from_currency_id: currency.id,
      to_currency_id: currency.id,
      from_amount: transferData.amount,
      to_amount: transferData.amount,
      fee_amount: 0,
      description: transferData.description || `Transferencia recibida de ${fromWallet.wallet_number}`,
      metadata: { related_transaction_id: transaction.id },
    });

    logger.info('Transferencia completada', {
      transactionId: transaction.id,
      fromWallet: fromWallet.wallet_number,
      toWallet: toWallet.wallet_number,
      amount: transferData.amount,
      currency: currency.code,
    });

    return mapToTransactionResponse(completedTransaction);
  });
};

/**
 * Obtiene una vista previa del intercambio de divisas
 * @param exchangeData - Datos del intercambio
 * @returns Vista previa del intercambio
 */
export const getExchangePreview = async (
  exchangeData: ExchangeRequest
): Promise<ExchangePreview> => {
  const { from_currency_code, to_currency_code, amount } = exchangeData;

  // Buscar divisas
  const fromCurrency = await findCurrencyByCode(from_currency_code);
  const toCurrency = await findCurrencyByCode(to_currency_code);

  if (!fromCurrency) {
    throw new CurrencyNotFoundError(`Divisa ${from_currency_code} no encontrada`);
  }

  if (!toCurrency) {
    throw new CurrencyNotFoundError(`Divisa ${to_currency_code} no encontrada`);
  }

  // Calcular intercambio
  const exchangeResult = await calculateExchange(fromCurrency.id, toCurrency.id, amount);

  if (!exchangeResult) {
    throw new ExchangeRateNotFoundError(`Par de divisas ${from_currency_code}/${to_currency_code} no soportado`);
  }

  return {
    from_currency: fromCurrency,
    to_currency: toCurrency,
    amount: amount,
    exchange_rate: exchangeResult.exchange_rate,
    final_rate: exchangeResult.final_rate,
    spread_percentage: exchangeResult.spread_percentage,
    to_amount: exchangeResult.to_amount,
    fee_amount: exchangeResult.fee_amount,
    total_deduction: exchangeResult.from_amount + exchangeResult.fee_amount,
  };
};

/**
 * Realiza un intercambio de divisas
 * @param userId - ID del usuario
 * @param exchangeData - Datos del intercambio
 * @returns Transacción creada
 */
export const exchange = async (
  userId: number,
  exchangeData: ExchangeRequest
): Promise<TransactionResponse> => {
  return withTransaction(async (client) => {
    // Obtener vista previa
    const preview = await getExchangePreview(exchangeData);

    // Buscar billetera del usuario
    const wallet = await getPrimaryWallet(userId);

    if (!wallet) {
      throw new WalletNotFoundError();
    }

    // Verificar saldo suficiente
    const hasBalance = await hasSufficientBalance(
      wallet.id,
      preview.from_currency.id,
      preview.total_deduction
    );

    if (!hasBalance) {
      throw new InsufficientBalanceError();
    }

    // Crear transacción
    const transaction = await createTransaction({
      transaction_type: TransactionType.EXCHANGE,
      status: TransactionStatus.PENDING,
      from_wallet_id: wallet.id,
      to_wallet_id: wallet.id,
      from_user_id: userId,
      to_user_id: userId,
      from_currency_id: preview.from_currency.id,
      to_currency_id: preview.to_currency.id,
      from_amount: preview.amount,
      to_amount: preview.to_amount,
      exchange_rate: preview.final_rate,
      fee_amount: preview.fee_amount,
      fee_currency_id: preview.from_currency.id,
      description: `Intercambio de ${preview.from_currency.code} a ${preview.to_currency.code}`,
    });

    // Actualizar saldos
    await updateBalance(wallet.id, preview.from_currency.id, -preview.total_deduction, client);
    await updateBalance(wallet.id, preview.to_currency.id, preview.to_amount, client);

    // Actualizar estado
    const completedTransaction = await updateTransactionStatus(
      transaction.id,
      TransactionStatus.COMPLETED,
      { completed_at: new Date().toISOString() }
    );

    logger.info('Intercambio completado', {
      transactionId: transaction.id,
      wallet: wallet.wallet_number,
      from: preview.from_currency.code,
      to: preview.to_currency.code,
      amount: preview.amount,
    });

    return mapToTransactionResponse(completedTransaction);
  });
};

/**
 * Obtiene el historial de transacciones de un usuario
 * @param userId - ID del usuario
 * @param page - Página
 * @param limit - Límite por página
 * @returns Lista de transacciones
 */
export const getUserTransactions = async (
  userId: number,
  page: number = 1,
  limit: number = 20
): Promise<{ transactions: TransactionResponse[]; total: number; total_pages: number }> => {
  const { transactions, total } = await findTransactionsByUser(userId, page, limit);

  return {
    transactions: transactions.map(mapToTransactionResponse),
    total,
    total_pages: Math.ceil(total / limit),
  };
};

/**
 * Obtiene el historial de transacciones de una billetera
 * @param walletId - ID de la billetera
 * @param userId - ID del usuario (para verificación)
 * @param page - Página
 * @param limit - Límite por página
 * @returns Lista de transacciones
 */
export const getWalletTransactions = async (
  walletId: number,
  userId: number,
  page: number = 1,
  limit: number = 20
): Promise<{ transactions: TransactionResponse[]; total: number }> => {
  // Verificar que la billetera pertenezca al usuario
  const wallet = await findWalletById(walletId);

  if (!wallet) {
    throw new WalletNotFoundError();
  }

  if (wallet.user_id !== userId) {
    throw new AuthorizationError();
  }

  const { transactions, total } = await findTransactionsByWallet(walletId, page, limit);

  return {
    transactions: transactions.map(mapToTransactionResponse),
    total,
  };
};

/**
 * Obtiene una transacción por ID
 * @param transactionId - ID de la transacción
 * @param userId - ID del usuario (para verificación)
 * @returns Transacción
 */
export const getTransactionById = async (
  transactionId: number,
  userId: number
): Promise<TransactionResponse> => {
  const transaction = await findTransactionById(transactionId);

  if (!transaction) {
    throw new NotFoundError('Transacción');
  }

  // Verificar que el usuario sea parte de la transacción
  if (transaction.from_user_id !== userId && transaction.to_user_id !== userId) {
    throw new AuthorizationError();
  }

  return mapToTransactionResponse(transaction);
};

/**
 * Obtiene estadísticas de transacciones de un usuario
 * @param userId - ID del usuario
 * @returns Estadísticas
 */
export const getUserTransactionStats = async (
  userId: number
): Promise<{
  total_sent: number;
  total_received: number;
  total_exchanged: number;
  transaction_count: number;
}> => {
  return getTransactionStats(userId);
};

/**
 * Obtiene transacciones recientes de un usuario
 * @param userId - ID del usuario
 * @param limit - Número de transacciones
 * @returns Lista de transacciones
 */
export const getRecentUserTransactions = async (
  userId: number,
  limit: number = 5
): Promise<TransactionResponse[]> => {
  const transactions = await getRecentTransactions(userId, limit);
  return transactions.map(mapToTransactionResponse);
};

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

/**
 * Obtiene la billetera principal de un usuario
 * @param userId - ID del usuario
 * @returns Billetera o null
 */
const getPrimaryWallet = async (userId: number) => {
  const { findPrimaryWallet } = await import('@models/Wallet');
  return findPrimaryWallet(userId);
};

/**
 * Mapea una transacción de base de datos a TransactionResponse
 */
const mapToTransactionResponse = (tx: any): TransactionResponse => ({
  id: tx.id,
  transaction_number: tx.transaction_number,
  transaction_type: tx.transaction_type,
  status: tx.status,
  from_amount: parseFloat(tx.from_amount),
  to_amount: tx.to_amount ? parseFloat(tx.to_amount) : null,
  exchange_rate: tx.exchange_rate ? parseFloat(tx.exchange_rate) : null,
  fee_amount: parseFloat(tx.fee_amount),
  description: tx.description,
  created_at: tx.created_at,
  from_wallet_number: tx.from_wallet_number || null,
  to_wallet_number: tx.to_wallet_number || null,
  from_user_name: tx.from_user_name || null,
  to_user_name: tx.to_user_name || null,
  from_currency_code: tx.from_currency_code || null,
  to_currency_code: tx.to_currency_code || null,
});

export default {
  transfer,
  getExchangePreview,
  exchange,
  getUserTransactions,
  getWalletTransactions,
  getTransactionById,
  getUserTransactionStats,
  getRecentUserTransactions,
};
