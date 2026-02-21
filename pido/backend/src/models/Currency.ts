/**
 * PIDO - Modelo de Divisas y Tasas de Cambio
 * ===========================================
 * Operaciones CRUD para currencies y exchange_rates
 */

import { query, withTransaction } from '@config/database';
import { Currency, ExchangeRate } from '@types';
import logger from '@utils/logger';

// =====================================================
// OPERACIONES DE DIVISAS
// =====================================================

/**
 * Obtiene todas las divisas activas
 * @returns Lista de divisas
 */
export const getAllCurrencies = async (): Promise<Currency[]> => {
  const result = await query<Currency>(
    `SELECT * FROM currencies 
     WHERE is_active = true 
     ORDER BY is_base_currency DESC, code`
  );

  return result.rows;
};

/**
 * Busca una divisa por ID
 * @param currencyId - ID de la divisa
 * @returns Divisa o null
 */
export const findCurrencyById = async (currencyId: number): Promise<Currency | null> => {
  const result = await query<Currency>(
    `SELECT * FROM currencies WHERE id = $1`,
    [currencyId]
  );

  return result.rows[0] || null;
};

/**
 * Busca una divisa por código
 * @param code - Código de la divisa (USD, EUR, etc.)
 * @returns Divisa o null
 */
export const findCurrencyByCode = async (code: string): Promise<Currency | null> => {
  const result = await query<Currency>(
    `SELECT * FROM currencies WHERE code = $1 AND is_active = true`,
    [code.toUpperCase()]
  );

  return result.rows[0] || null;
};

/**
 * Obtiene la divisa base del sistema
 * @returns Divisa base o null
 */
export const getBaseCurrency = async (): Promise<Currency | null> => {
  const result = await query<Currency>(
    `SELECT * FROM currencies WHERE is_base_currency = true LIMIT 1`
  );

  return result.rows[0] || null;
};

// =====================================================
// OPERACIONES DE TASAS DE CAMBIO
// =====================================================

/**
 * Obtiene la tasa de cambio entre dos divisas
 * @param fromCurrencyId - ID divisa origen
 * @param toCurrencyId - ID divisa destino
 * @returns Tasa de cambio o null
 */
export const getExchangeRate = async (
  fromCurrencyId: number,
  toCurrencyId: number
): Promise<ExchangeRate | null> => {
  const result = await query<ExchangeRate>(
    `SELECT er.*, fc.code as from_currency_code, fc.name as from_currency_name,
            tc.code as to_currency_code, tc.name as to_currency_name
     FROM exchange_rates er
     JOIN currencies fc ON er.from_currency_id = fc.id
     JOIN currencies tc ON er.to_currency_id = tc.id
     WHERE er.from_currency_id = $1 
       AND er.to_currency_id = $2 
       AND er.is_active = true
       AND (er.valid_until IS NULL OR er.valid_until > CURRENT_TIMESTAMP)`,
    [fromCurrencyId, toCurrencyId]
  );

  return result.rows[0] || null;
};

/**
 * Obtiene la tasa de cambio por códigos de divisa
 * @param fromCode - Código divisa origen
 * @param toCode - Código divisa destino
 * @returns Tasa de cambio o null
 */
export const getExchangeRateByCodes = async (
  fromCode: string,
  toCode: string
): Promise<(ExchangeRate & { from_currency_code: string; to_currency_code: string }) | null> => {
  const result = await query(
    `SELECT er.*, fc.code as from_currency_code, tc.code as to_currency_code
     FROM exchange_rates er
     JOIN currencies fc ON er.from_currency_id = fc.id
     JOIN currencies tc ON er.to_currency_id = tc.id
     WHERE fc.code = $1 
       AND tc.code = $2 
       AND er.is_active = true
       AND (er.valid_until IS NULL OR er.valid_until > CURRENT_TIMESTAMP)`,
    [fromCode.toUpperCase(), toCode.toUpperCase()]
  );

  return result.rows[0] || null;
};

/**
 * Obtiene todas las tasas de cambio disponibles para una divisa
 * @param currencyCode - Código de la divisa base
 * @returns Lista de tasas de cambio
 */
export const getExchangeRatesFromCurrency = async (
  currencyCode: string
): Promise<(ExchangeRate & { to_currency_code: string; to_currency_name: string; to_symbol: string })[]> => {
  const result = await query(
    `SELECT er.*, tc.code as to_currency_code, tc.name as to_currency_name, tc.symbol as to_symbol
     FROM exchange_rates er
     JOIN currencies fc ON er.from_currency_id = fc.id
     JOIN currencies tc ON er.to_currency_id = tc.id
     WHERE fc.code = $1 
       AND er.is_active = true
       AND (er.valid_until IS NULL OR er.valid_until > CURRENT_TIMESTAMP)
     ORDER BY tc.code`,
    [currencyCode.toUpperCase()]
  );

  return result.rows;
};

/**
 * Calcula el monto convertido usando la tasa de cambio
 * @param fromCurrencyId - ID divisa origen
 * @param toCurrencyId - ID divisa destino
 * @param amount - Monto a convertir
 * @returns Resultado de la conversión o null
 */
export const calculateExchange = async (
  fromCurrencyId: number,
  toCurrencyId: number,
  amount: number
): Promise<{
  from_amount: number;
  to_amount: number;
  exchange_rate: number;
  final_rate: number;
  spread_percentage: number;
  fee_amount: number;
} | null> => {
  // Si son la misma divisa, no hay conversión
  if (fromCurrencyId === toCurrencyId) {
    return {
      from_amount: amount,
      to_amount: amount,
      exchange_rate: 1,
      final_rate: 1,
      spread_percentage: 0,
      fee_amount: 0,
    };
  }

  const rateData = await getExchangeRate(fromCurrencyId, toCurrencyId);

  if (!rateData) {
    return null;
  }

  const toAmount = amount * rateData.final_rate;
  const feeAmount = amount * (rateData.spread_percentage / 100);

  return {
    from_amount: amount,
    to_amount: parseFloat(toAmount.toFixed(8)),
    exchange_rate: parseFloat(rateData.rate.toFixed(8)),
    final_rate: parseFloat(rateData.final_rate.toFixed(8)),
    spread_percentage: parseFloat(rateData.spread_percentage.toFixed(2)),
    fee_amount: parseFloat(feeAmount.toFixed(8)),
  };
};

/**
 * Actualiza o crea una tasa de cambio (solo admin)
 * @param fromCurrencyId - ID divisa origen
 * @param toCurrencyId - ID divisa destino
 * @param rate - Tasa de cambio
 * @param spreadPercentage - Porcentaje de spread
 * @returns Tasa de cambio actualizada
 */
export const updateExchangeRate = async (
  fromCurrencyId: number,
  toCurrencyId: number,
  rate: number,
  spreadPercentage: number = 0
): Promise<ExchangeRate> => {
  const finalRate = rate * (1 - spreadPercentage / 100);
  const inverseRate = 1 / rate;

  return withTransaction(async (client) => {
    // Desactivar tasa anterior si existe
    await client.query(
      `UPDATE exchange_rates 
       SET is_active = false, valid_until = CURRENT_TIMESTAMP
       WHERE from_currency_id = $1 AND to_currency_id = $2 AND is_active = true`,
      [fromCurrencyId, toCurrencyId]
    );

    // Crear nueva tasa
    const result = await client.query<ExchangeRate>(
      `INSERT INTO exchange_rates (
        from_currency_id, to_currency_id, rate, inverse_rate, 
        spread_percentage, final_rate, source, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, 'manual', true)
      RETURNING *`,
      [fromCurrencyId, toCurrencyId, rate, inverseRate, spreadPercentage, finalRate]
    );

    logger.info('Tasa de cambio actualizada', {
      fromCurrencyId,
      toCurrencyId,
      rate,
      spreadPercentage,
    });

    return result.rows[0];
  });
};

/**
 * Simula la obtención de tasas de cambio desde una API externa
 * En producción, esto se conectaría a una API real como Fixer, OpenExchangeRates, etc.
 * @returns Tasas actualizadas
 */
export const fetchExternalExchangeRates = async (): Promise<
  { from: string; to: string; rate: number }[]
> => {
  // Simulación de tasas actualizadas
  // En producción, aquí se haría la llamada a la API externa
  const simulatedRates = [
    { from: 'USD', to: 'EUR', rate: 0.92 },
    { from: 'USD', to: 'MXN', rate: 17.05 },
    { from: 'USD', to: 'GBP', rate: 0.79 },
    { from: 'USD', to: 'COP', rate: 3925.00 },
    { from: 'USD', to: 'ARS', rate: 875.50 },
    { from: 'USD', to: 'BRL', rate: 4.95 },
    { from: 'USD', to: 'CLP', rate: 905.00 },
    { from: 'USD', to: 'PEN', rate: 3.72 },
    { from: 'EUR', to: 'USD', rate: 1.09 },
    { from: 'MXN', to: 'USD', rate: 0.0587 },
    { from: 'GBP', to: 'USD', rate: 1.27 },
    { from: 'COP', to: 'USD', rate: 0.000255 },
    { from: 'ARS', to: 'USD', rate: 0.00114 },
    { from: 'BRL', to: 'USD', rate: 0.202 },
    { from: 'CLP', to: 'USD', rate: 0.0011 },
    { from: 'PEN', to: 'USD', rate: 0.269 },
  ];

  // Agregar variación aleatoria para simular cambios en tiempo real
  return simulatedRates.map((rate) => ({
    ...rate,
    rate: rate.rate * (1 + (Math.random() - 0.5) * 0.02), // ±1% de variación
  }));
};

/**
 * Actualiza todas las tasas de cambio desde fuente externa
 * @returns Número de tasas actualizadas
 */
export const updateAllExchangeRatesFromExternal = async (): Promise<number> => {
  try {
    const externalRates = await fetchExternalExchangeRates();
    let updatedCount = 0;

    for (const rateData of externalRates) {
      const fromCurrency = await findCurrencyByCode(rateData.from);
      const toCurrency = await findCurrencyByCode(rateData.to);

      if (fromCurrency && toCurrency) {
        // Obtener spread actual si existe
        const currentRate = await getExchangeRate(fromCurrency.id, toCurrency.id);
        const spread = currentRate?.spread_percentage || 1.5;

        await updateExchangeRate(fromCurrency.id, toCurrency.id, rateData.rate, spread);
        updatedCount++;
      }
    }

    logger.info('Tasas de cambio actualizadas desde fuente externa', {
      updatedCount,
    });

    return updatedCount;
  } catch (error) {
    logger.error('Error actualizando tasas desde fuente externa', {
      error: (error as Error).message,
    });
    throw error;
  }
};

/**
 * Obtiene el resumen de tasas de cambio para el dashboard
 * @returns Lista de tasas con información de divisas
 */
export const getExchangeRatesSummary = async (): Promise<
  {
    from_code: string;
    from_name: string;
    from_flag: string;
    to_code: string;
    to_name: string;
    to_flag: string;
    rate: number;
    final_rate: number;
    spread: number;
    updated_at: Date;
  }[]
> => {
  const result = await query(
    `SELECT 
      fc.code as from_code, fc.name as from_name, fc.flag_emoji as from_flag,
      tc.code as to_code, tc.name as to_name, tc.flag_emoji as to_flag,
      er.rate, er.final_rate, er.spread_percentage as spread, er.updated_at
     FROM exchange_rates er
     JOIN currencies fc ON er.from_currency_id = fc.id
     JOIN currencies tc ON er.to_currency_id = tc.id
     WHERE er.is_active = true
       AND fc.is_base_currency = true
     ORDER BY fc.code, tc.code`
  );

  return result.rows;
};

export default {
  getAllCurrencies,
  findCurrencyById,
  findCurrencyByCode,
  getBaseCurrency,
  getExchangeRate,
  getExchangeRateByCodes,
  getExchangeRatesFromCurrency,
  calculateExchange,
  updateExchangeRate,
  fetchExternalExchangeRates,
  updateAllExchangeRatesFromExternal,
  getExchangeRatesSummary,
};
