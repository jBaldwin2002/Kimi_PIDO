/**
 * PIDO - Servicio de Billeteras
 * ==============================
 * Lógica de negocio para gestión de billeteras y saldos
 */

import {
  findWalletById,
  findWalletByNumber,
  findWalletsByUserId,
  findPrimaryWallet,
  getWalletBalances,
  getWalletBalanceByCurrencyCode,
  createWallet,
  updateBalance,
  hasSufficientBalance,
  updateWalletName,
  setPrimaryWallet,
  deactivateWallet,
  getUserBalanceSummary,
} from '@models/Wallet';
import { findCurrencyByCode } from '@models/Currency';
import { WalletResponse, WalletBalanceResponse } from '@types';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
  InsufficientBalanceError,
  WalletNotFoundError,
  AuthorizationError,
} from '@middleware/errorHandler';
import logger from '@utils/logger';

/**
 * Obtiene las billeteras de un usuario
 * @param userId - ID del usuario
 * @returns Lista de billeteras con saldos
 */
export const getUserWallets = async (userId: number): Promise<WalletResponse[]> => {
  const wallets = await findWalletsByUserId(userId);

  const walletsWithBalances = await Promise.all(
    wallets.map(async (wallet) => {
      const balances = await getWalletBalances(wallet.id);
      
      return {
        id: wallet.id,
        wallet_number: wallet.wallet_number,
        name: wallet.name,
        is_primary: wallet.is_primary,
        balances: balances.map(mapToBalanceResponse),
      };
    })
  );

  return walletsWithBalances;
};

/**
 * Obtiene una billetera por ID con verificación de propiedad
 * @param walletId - ID de la billetera
 * @param userId - ID del usuario (para verificar propiedad)
 * @returns Billetera con saldos
 */
export const getWalletById = async (
  walletId: number,
  userId: number
): Promise<WalletResponse> => {
  const wallet = await findWalletById(walletId);

  if (!wallet) {
    throw new WalletNotFoundError();
  }

  // Verificar que la billetera pertenezca al usuario
  if (wallet.user_id !== userId) {
    throw new AuthorizationError();
  }

  const balances = await getWalletBalances(walletId);

  return {
    id: wallet.id,
    wallet_number: wallet.wallet_number,
    name: wallet.name,
    is_primary: wallet.is_primary,
    balances: balances.map(mapToBalanceResponse),
  };
};

/**
 * Obtiene una billetera por número
 * @param walletNumber - Número de billetera
 * @returns Billetera básica (sin saldos detallados)
 */
export const getWalletByNumber = async (
  walletNumber: string
): Promise<{ id: number; wallet_number: string; user_id: number; user_name: string } | null> => {
  const wallet = await findWalletByNumber(walletNumber);

  if (!wallet) {
    return null;
  }

  return {
    id: wallet.id,
    wallet_number: wallet.wallet_number,
    user_id: wallet.user_id,
    user_name: (wallet as any).user_full_name || '',
  };
};

/**
 * Crea una nueva billetera para un usuario
 * @param userId - ID del usuario
 * @param name - Nombre de la billetera
 * @returns Billetera creada
 */
export const createUserWallet = async (
  userId: number,
  name?: string
): Promise<WalletResponse> => {
  // Verificar límite de billeteras (máximo 5 por usuario)
  const existingWallets = await findWalletsByUserId(userId);
  
  if (existingWallets.length >= 5) {
    throw new ValidationError('Límite de billeteras alcanzado (máximo 5)');
  }

  // Si no hay billeteras, la nueva será primaria
  const isPrimary = existingWallets.length === 0;

  const wallet = await createWallet(userId, name, isPrimary);
  const balances = await getWalletBalances(wallet.id);

  logger.info('Billetera creada', { walletId: wallet.id, userId });

  return {
    id: wallet.id,
    wallet_number: wallet.wallet_number,
    name: wallet.name,
    is_primary: wallet.is_primary,
    balances: balances.map(mapToBalanceResponse),
  };
};

/**
 * Actualiza el nombre de una billetera
 * @param walletId - ID de la billetera
 * @param userId - ID del usuario
 * @param name - Nuevo nombre
 */
export const updateWallet = async (
  walletId: number,
  userId: number,
  name: string
): Promise<void> => {
  const wallet = await findWalletById(walletId);

  if (!wallet) {
    throw new WalletNotFoundError();
  }

  if (wallet.user_id !== userId) {
    throw new AuthorizationError();
  }

  await updateWalletName(walletId, name);
};

/**
 * Establece una billetera como principal
 * @param walletId - ID de la billetera
 * @param userId - ID del usuario
 */
export const setWalletAsPrimary = async (
  walletId: number,
  userId: number
): Promise<void> => {
  const wallet = await findWalletById(walletId);

  if (!wallet) {
    throw new WalletNotFoundError();
  }

  if (wallet.user_id !== userId) {
    throw new AuthorizationError();
  }

  await setPrimaryWallet(walletId, userId);
};

/**
 * Elimina (desactiva) una billetera
 * @param walletId - ID de la billetera
 * @param userId - ID del usuario
 */
export const deleteWallet = async (
  walletId: number,
  userId: number
): Promise<void> => {
  const wallet = await findWalletById(walletId);

  if (!wallet) {
    throw new WalletNotFoundError();
  }

  if (wallet.user_id !== userId) {
    throw new AuthorizationError();
  }

  // No permitir eliminar la billetera principal si es la única
  if (wallet.is_primary) {
    const wallets = await findWalletsByUserId(userId);
    if (wallets.length === 1) {
      throw new ValidationError('No puede eliminar su única billetera');
    }
  }

  // Verificar que no tenga saldo
  const balances = await getWalletBalances(walletId);
  const hasBalance = balances.some((b) => parseFloat(b.balance as any) > 0);

  if (hasBalance) {
    throw new ValidationError('No puede eliminar una billetera con saldo');
  }

  await deactivateWallet(walletId);

  logger.info('Billetera eliminada', { walletId, userId });
};

/**
 * Obtiene el saldo de una billetera en una divisa específica
 * @param walletId - ID de la billetera
 * @param currencyCode - Código de la divisa
 * @returns Saldo
 */
export const getWalletBalance = async (
  walletId: number,
  currencyCode: string
): Promise<{ balance: number; available_balance: number; currency_code: string }> => {
  const balance = await getWalletBalanceByCurrencyCode(walletId, currencyCode);

  if (!balance) {
    throw new NotFoundError('Balance');
  }

  return {
    balance: parseFloat(balance.balance as any),
    available_balance: parseFloat(balance.available_balance as any),
    currency_code: balance.currency_code,
  };
};

/**
 * Verifica si hay saldo suficiente para una operación
 * @param walletId - ID de la billetera
 * @param currencyCode - Código de la divisa
 * @param amount - Monto requerido
 * @returns true si hay saldo suficiente
 */
export const checkBalance = async (
  walletId: number,
  currencyCode: string,
  amount: number
): Promise<boolean> => {
  const currency = await findCurrencyByCode(currencyCode);

  if (!currency) {
    throw new NotFoundError('Divisa');
  }

  return hasSufficientBalance(walletId, currency.id, amount);
};

/**
 * Obtiene el resumen de saldos de un usuario
 * @param userId - ID del usuario
 * @returns Resumen de saldos
 */
export const getBalanceSummary = async (
  userId: number
): Promise<{ currency_code: string; total_balance: number; symbol: string }[]> => {
  return getUserBalanceSummary(userId);
};

/**
 * Obtiene la billetera principal de un usuario
 * @param userId - ID del usuario
 * @returns Billetera principal o null
 */
export const getPrimaryWallet = async (
  userId: number
): Promise<WalletResponse | null> => {
  const wallet = await findPrimaryWallet(userId);

  if (!wallet) {
    return null;
  }

  const balances = await getWalletBalances(wallet.id);

  return {
    id: wallet.id,
    wallet_number: wallet.wallet_number,
    name: wallet.name,
    is_primary: wallet.is_primary,
    balances: balances.map(mapToBalanceResponse),
  };
};

/**
 * Mapea un balance de base de datos a WalletBalanceResponse
 */
const mapToBalanceResponse = (balance: any): WalletBalanceResponse => ({
  currency_code: balance.code,
  currency_name: balance.name,
  symbol: balance.symbol,
  balance: parseFloat(balance.balance),
  available_balance: parseFloat(balance.available_balance),
  flag_emoji: balance.flag_emoji,
});

export default {
  getUserWallets,
  getWalletById,
  getWalletByNumber,
  createUserWallet,
  updateWallet,
  setWalletAsPrimary,
  deleteWallet,
  getWalletBalance,
  checkBalance,
  getBalanceSummary,
  getPrimaryWallet,
};
