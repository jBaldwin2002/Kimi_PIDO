/**
 * PIDO - Middleware de Manejo de Errores
 * =======================================
 * Captura y maneja todos los errores de la aplicación
 */

import { Request, Response, NextFunction } from 'express';
import { sendError, sendServerError } from '@utils/response';
import { ErrorCodes } from '@utils/response';
import logger from '@utils/logger';

/**
 * Clase personalizada para errores de la API
 */
export class ApiError extends Error {
  public statusCode: number;
  public code: string;
  public details?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number = 400,
    code: string = ErrorCodes.INTERNAL_ERROR,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    
    // Mantener el stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Errores específicos del dominio
 */
export class ValidationError extends ApiError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 422, ErrorCodes.VALIDATION_ERROR, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'No autorizado', code: string = ErrorCodes.AUTH_INVALID_CREDENTIALS) {
    super(message, 401, code);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends ApiError {
  constructor(message: string = 'Acceso denegado') {
    super(message, 403, ErrorCodes.FORBIDDEN);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string = 'Recurso') {
    super(`${resource} no encontrado`, 404, ErrorCodes.NOT_FOUND);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(message, 409, ErrorCodes.CONFLICT);
    this.name = 'ConflictError';
  }
}

export class InsufficientBalanceError extends ApiError {
  constructor(message: string = 'Saldo insuficiente') {
    super(message, 400, ErrorCodes.WALLET_INSUFFICIENT_BALANCE);
    this.name = 'InsufficientBalanceError';
  }
}

export class WalletNotFoundError extends ApiError {
  constructor(message: string = 'Billetera no encontrada') {
    super(message, 404, ErrorCodes.WALLET_NOT_FOUND);
    this.name = 'WalletNotFoundError';
  }
}

export class CurrencyNotFoundError extends ApiError {
  constructor(message: string = 'Divisa no encontrada') {
    super(message, 404, ErrorCodes.CURRENCY_NOT_FOUND);
    this.name = 'CurrencyNotFoundError';
  }
}

export class ExchangeRateNotFoundError extends ApiError {
  constructor(message: string = 'Tasa de cambio no encontrada') {
    super(message, 404, ErrorCodes.EXCHANGE_RATE_NOT_FOUND);
    this.name = 'ExchangeRateNotFoundError';
  }
}

export class TransactionError extends ApiError {
  constructor(message: string) {
    super(message, 400, ErrorCodes.TRANSACTION_FAILED);
    this.name = 'TransactionError';
  }
}

/**
 * Middleware para manejar errores asíncronos en controladores
 * Envuelve una función async para capturar errores y pasarlos al next()
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Middleware principal de manejo de errores
 * Debe ser el último middleware en la cadena
 */
export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log del error
  logger.error('Error en la aplicación', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  // Si es un error de nuestra API personalizada
  if (err instanceof ApiError) {
    sendError(
      res,
      {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      err.statusCode
    );
    return;
  }

  // Errores de PostgreSQL
  if (err.name === 'error' && 'code' in err) {
    const pgError = err as any;
    
    switch (pgError.code) {
      case '23505': // Unique violation
        sendError(
          res,
          {
            code: ErrorCodes.CONFLICT,
            message: 'El recurso ya existe',
            details: { constraint: pgError.constraint },
          },
          409
        );
        return;
        
      case '23503': // Foreign key violation
        sendError(
          res,
          {
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Referencia a recurso no encontrado',
            details: { constraint: pgError.constraint },
          },
          422
        );
        return;
        
      case '23502': // Not null violation
        sendError(
          res,
          {
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Campo requerido faltante',
            details: { column: pgError.column },
          },
          422
        );
        return;
        
      case '22P02': // Invalid text representation
        sendError(
          res,
          {
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Tipo de dato inválido',
          },
          422
        );
        return;
        
      case '28P01': // Invalid password
        sendError(
          res,
          {
            code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
            message: 'Credenciales de base de datos inválidas',
          },
          401
        );
        return;
        
      case '3D000': // Database does not exist
        sendError(
          res,
          {
            code: ErrorCodes.INTERNAL_ERROR,
            message: 'Base de datos no encontrada',
          },
          500
        );
        return;
        
      case 'ECONNREFUSED': // Connection refused
        sendError(
          res,
          {
            code: ErrorCodes.SERVICE_UNAVAILABLE,
            message: 'No se puede conectar a la base de datos',
          },
          503
        );
        return;
    }
  }

  // Error de JSON malformado
  if (err instanceof SyntaxError && 'body' in err) {
    sendError(
      res,
      {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'JSON malformado en el cuerpo de la solicitud',
      },
      400
    );
    return;
  }

  // Error de JWT
  if (err.name === 'JsonWebTokenError') {
    sendError(
      res,
      {
        code: ErrorCodes.AUTH_TOKEN_INVALID,
        message: 'Token inválido',
      },
      401
    );
    return;
  }

  if (err.name === 'TokenExpiredError') {
    sendError(
      res,
      {
        code: ErrorCodes.AUTH_TOKEN_EXPIRED,
        message: 'Token expirado',
      },
      401
    );
    return;
  }

  // Error por defecto (no revelar detalles en producción)
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  sendServerError(
    res,
    isDevelopment ? err.message : 'Error interno del servidor',
    ErrorCodes.INTERNAL_ERROR
  );
};

/**
 * Middleware para manejar rutas no encontradas
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  sendError(
    res,
    {
      code: ErrorCodes.NOT_FOUND,
      message: `Ruta ${req.method} ${req.path} no encontrada`,
    },
    404
  );
};

export default {
  ApiError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  InsufficientBalanceError,
  WalletNotFoundError,
  CurrencyNotFoundError,
  ExchangeRateNotFoundError,
  TransactionError,
  asyncHandler,
  errorHandler,
  notFoundHandler,
};
