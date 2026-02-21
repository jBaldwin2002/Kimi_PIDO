/**
 * PIDO - Utilidades de Respuesta HTTP
 * ====================================
 * Helpers para estandarizar respuestas de la API
 */

import { Response } from 'express';
import { ApiError } from '@types';

/**
 * Respuesta exitosa estándar
 */
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    total_pages?: number;
    timestamp?: string;
    [key: string]: any;
  };
}

/**
 * Respuesta de error estándar
 */
export interface ErrorResponse {
  success: false;
  error: ApiError;
  timestamp: string;
}

/**
 * Envía una respuesta exitosa
 * @param res - Objeto Response de Express
 * @param data - Datos a enviar
 * @param message - Mensaje opcional
 * @param meta - Metadatos adicionales (paginación, etc.)
 * @param statusCode - Código HTTP (default: 200)
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  message?: string,
  meta?: Record<string, any>,
  statusCode: number = 200
): void => {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    ...(message && { message }),
    ...(meta && {
      meta: {
        ...meta,
        timestamp: new Date().toISOString(),
      },
    }),
  };

  res.status(statusCode).json(response);
};

/**
 * Envía una respuesta de error
 * @param res - Objeto Response de Express
 * @param error - Error a enviar
 * @param statusCode - Código HTTP (default: 400)
 */
export const sendError = (
  res: Response,
  error: ApiError,
  statusCode: number = 400
): void => {
  const response: ErrorResponse = {
    success: false,
    error,
    timestamp: new Date().toISOString(),
  };

  res.status(statusCode).json(response);
};

/**
 * Envía una respuesta de error 400 - Bad Request
 */
export const sendBadRequest = (
  res: Response,
  message: string,
  code: string = 'BAD_REQUEST',
  details?: Record<string, any>
): void => {
  sendError(res, { code, message, details }, 400);
};

/**
 * Envía una respuesta de error 401 - Unauthorized
 */
export const sendUnauthorized = (
  res: Response,
  message: string = 'No autorizado',
  code: string = 'UNAUTHORIZED'
): void => {
  sendError(res, { code, message }, 401);
};

/**
 * Envía una respuesta de error 403 - Forbidden
 */
export const sendForbidden = (
  res: Response,
  message: string = 'Acceso denegado',
  code: string = 'FORBIDDEN'
): void => {
  sendError(res, { code, message }, 403);
};

/**
 * Envía una respuesta de error 404 - Not Found
 */
export const sendNotFound = (
  res: Response,
  message: string = 'Recurso no encontrado',
  code: string = 'NOT_FOUND'
): void => {
  sendError(res, { code, message }, 404);
};

/**
 * Envía una respuesta de error 409 - Conflict
 */
export const sendConflict = (
  res: Response,
  message: string,
  code: string = 'CONFLICT'
): void => {
  sendError(res, { code, message }, 409);
};

/**
 * Envía una respuesta de error 422 - Unprocessable Entity
 */
export const sendValidationError = (
  res: Response,
  message: string,
  details: Record<string, any>,
  code: string = 'VALIDATION_ERROR'
): void => {
  sendError(res, { code, message, details }, 422);
};

/**
 * Envía una respuesta de error 429 - Too Many Requests
 */
export const sendTooManyRequests = (
  res: Response,
  message: string = 'Demasiadas solicitudes',
  code: string = 'TOO_MANY_REQUESTS'
): void => {
  sendError(res, { code, message }, 429);
};

/**
 * Envía una respuesta de error 500 - Internal Server Error
 */
export const sendServerError = (
  res: Response,
  message: string = 'Error interno del servidor',
  code: string = 'INTERNAL_ERROR'
): void => {
  sendError(res, { code, message }, 500);
};

/**
 * Códigos de error predefinidos
 */
export const ErrorCodes = {
  // Errores de autenticación
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_REFRESH_TOKEN_INVALID: 'AUTH_REFRESH_TOKEN_INVALID',
  AUTH_USER_INACTIVE: 'AUTH_USER_INACTIVE',
  AUTH_USER_LOCKED: 'AUTH_USER_LOCKED',
  AUTH_EMAIL_NOT_VERIFIED: 'AUTH_EMAIL_NOT_VERIFIED',
  
  // Errores de usuario
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  USER_EMAIL_EXISTS: 'USER_EMAIL_EXISTS',
  USER_PHONE_EXISTS: 'USER_PHONE_EXISTS',
  
  // Errores de billetera
  WALLET_NOT_FOUND: 'WALLET_NOT_FOUND',
  WALLET_INSUFFICIENT_BALANCE: 'WALLET_INSUFFICIENT_BALANCE',
  WALLET_INVALID_NUMBER: 'WALLET_INVALID_NUMBER',
  WALLET_SELF_TRANSFER: 'WALLET_SELF_TRANSFER',
  WALLET_LIMIT_EXCEEDED: 'WALLET_LIMIT_EXCEEDED',
  WALLET_INACTIVE: 'WALLET_INACTIVE',
  
  // Errores de transacción
  TRANSACTION_NOT_FOUND: 'TRANSACTION_NOT_FOUND',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  TRANSACTION_CANCELLED: 'TRANSACTION_CANCELLED',
  TRANSACTION_ALREADY_PROCESSED: 'TRANSACTION_ALREADY_PROCESSED',
  
  // Errores de divisa
  CURRENCY_NOT_FOUND: 'CURRENCY_NOT_FOUND',
  CURRENCY_NOT_SUPPORTED: 'CURRENCY_NOT_SUPPORTED',
  CURRENCY_PAIR_NOT_SUPPORTED: 'CURRENCY_PAIR_NOT_SUPPORTED',
  
  // Errores de exchange
  EXCHANGE_RATE_NOT_FOUND: 'EXCHANGE_RATE_NOT_FOUND',
  EXCHANGE_RATE_EXPIRED: 'EXCHANGE_RATE_EXPIRED',
  EXCHANGE_AMOUNT_TOO_SMALL: 'EXCHANGE_AMOUNT_TOO_SMALL',
  EXCHANGE_AMOUNT_TOO_LARGE: 'EXCHANGE_AMOUNT_TOO_LARGE',
  
  // Errores generales
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;
