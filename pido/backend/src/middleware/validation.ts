/**
 * PIDO - Middleware de Validación
 * ================================
 * Validaciones de datos usando express-validator
 */

import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult, ValidationChain } from 'express-validator';
import { sendValidationError } from '@utils/response';

/**
 * Middleware para manejar errores de validación
 */
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorDetails: Record<string, string> = {};
    
    errors.array().forEach((error) => {
      if ('param' in error) {
        errorDetails[error.param] = error.msg;
      }
    });

    sendValidationError(
      res,
      'Error de validación en los datos enviados',
      errorDetails
    );
    return;
  }

  next();
};

// =====================================================
// VALIDACIONES DE AUTENTICACIÓN
// =====================================================

export const validateRegister: ValidationChain[] = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('El email no es válido'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/[A-Z]/)
    .withMessage('La contraseña debe contener al menos una mayúscula')
    .matches(/[a-z]/)
    .withMessage('La contraseña debe contener al menos una minúscula')
    .matches(/\d/)
    .withMessage('La contraseña debe contener al menos un número')
    .matches(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/)
    .withMessage('La contraseña debe contener al menos un símbolo especial'),
  body('first_name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('El nombre solo puede contener letras'),
  body('last_name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('El apellido debe tener entre 2 y 100 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('El apellido solo puede contener letras'),
  body('phone')
    .optional()
    .trim()
    .matches(/^[+]?[\d\s-()]+$/)
    .withMessage('El teléfono no es válido'),
  handleValidationErrors,
];

export const validateLogin: ValidationChain[] = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('El email no es válido'),
  body('password')
    .notEmpty()
    .withMessage('La contraseña es requerida'),
  handleValidationErrors,
];

export const validateChangePassword: ValidationChain[] = [
  body('currentPassword')
    .notEmpty()
    .withMessage('La contraseña actual es requerida'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('La nueva contraseña debe tener al menos 8 caracteres')
    .matches(/[A-Z]/)
    .withMessage('La nueva contraseña debe contener al menos una mayúscula')
    .matches(/[a-z]/)
    .withMessage('La nueva contraseña debe contener al menos una minúscula')
    .matches(/\d/)
    .withMessage('La nueva contraseña debe contener al menos un número')
    .matches(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/)
    .withMessage('La nueva contraseña debe contener al menos un símbolo especial'),
  handleValidationErrors,
];

// =====================================================
// VALIDACIONES DE BILLETERA
// =====================================================

export const validateCreateWallet: ValidationChain[] = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('El nombre debe tener entre 1 y 100 caracteres'),
  handleValidationErrors,
];

export const validateUpdateWallet: ValidationChain[] = [
  param('walletId')
    .isInt({ min: 1 })
    .withMessage('ID de billetera inválido'),
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('El nombre debe tener entre 1 y 100 caracteres'),
  handleValidationErrors,
];

// =====================================================
// VALIDACIONES DE TRANSFERENCIA
// =====================================================

export const validateTransfer: ValidationChain[] = [
  body('to_wallet_number')
    .trim()
    .isLength({ min: 10, max: 20 })
    .withMessage('Número de billetera inválido')
    .matches(/^[\d]+$/)
    .withMessage('El número de billetera solo puede contener dígitos'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('El monto debe ser mayor a 0'),
  body('currency_code')
    .trim()
    .isLength({ min: 3, max: 3 })
    .withMessage('Código de divisa inválido')
    .matches(/^[A-Z]{3}$/)
    .withMessage('El código de divisa debe ser de 3 letras mayúsculas'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('La descripción no puede exceder 255 caracteres'),
  handleValidationErrors,
];

// =====================================================
// VALIDACIONES DE INTERCAMBIO
// =====================================================

export const validateExchange: ValidationChain[] = [
  body('from_currency_code')
    .trim()
    .isLength({ min: 3, max: 3 })
    .withMessage('Código de divisa origen inválido')
    .matches(/^[A-Z]{3}$/)
    .withMessage('El código de divisa debe ser de 3 letras mayúsculas'),
  body('to_currency_code')
    .trim()
    .isLength({ min: 3, max: 3 })
    .withMessage('Código de divisa destino inválido')
    .matches(/^[A-Z]{3}$/)
    .withMessage('El código de divisa debe ser de 3 letras mayúsculas'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('El monto debe ser mayor a 0'),
  handleValidationErrors,
];

export const validateExchangePreview: ValidationChain[] = [
  query('from')
    .trim()
    .isLength({ min: 3, max: 3 })
    .withMessage('Código de divisa origen inválido'),
  query('to')
    .trim()
    .isLength({ min: 3, max: 3 })
    .withMessage('Código de divisa destino inválido'),
  query('amount')
    .isFloat({ min: 0.01 })
    .withMessage('El monto debe ser mayor a 0'),
  handleValidationErrors,
];

// =====================================================
// VALIDACIONES DE TRANSACCIONES
// =====================================================

export const validateTransactionList: ValidationChain[] = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La página debe ser un número entero positivo'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('El límite debe ser entre 1 y 100'),
  handleValidationErrors,
];

export const validateTransactionFilter: ValidationChain[] = [
  query('status')
    .optional()
    .isIn(['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'])
    .withMessage('Estado de transacción inválido'),
  query('type')
    .optional()
    .isIn(['deposit', 'withdrawal', 'transfer_sent', 'transfer_received', 'exchange', 'fee', 'refund', 'adjustment'])
    .withMessage('Tipo de transacción inválido'),
  query('fromDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha inicial inválida'),
  query('toDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha final inválida'),
  handleValidationErrors,
];

// =====================================================
// VALIDACIONES DE USUARIO
// =====================================================

export const validateUpdateUser: ValidationChain[] = [
  body('first_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  body('last_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('El apellido debe tener entre 2 y 100 caracteres'),
  body('phone')
    .optional({ nullable: true })
    .trim()
    .matches(/^[+]?[\d\s-()]+$/)
    .withMessage('El teléfono no es válido'),
  handleValidationErrors,
];

// =====================================================
// VALIDACIONES ADMIN
// =====================================================

export const validateUpdateExchangeRate: ValidationChain[] = [
  body('rate')
    .isFloat({ min: 0.00000001 })
    .withMessage('La tasa debe ser un número positivo'),
  body('spreadPercentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('El spread debe ser entre 0 y 100'),
  handleValidationErrors,
];

export const validateCreateCurrency: ValidationChain[] = [
  body('code')
    .trim()
    .isLength({ min: 3, max: 3 })
    .withMessage('El código debe ser de 3 caracteres')
    .matches(/^[A-Z]{3}$/)
    .withMessage('El código debe ser de 3 letras mayúsculas'),
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('El nombre es requerido'),
  body('symbol')
    .trim()
    .isLength({ min: 1, max: 10 })
    .withMessage('El símbolo es requerido'),
  body('decimal_places')
    .optional()
    .isInt({ min: 0, max: 8 })
    .withMessage('Los decimales deben ser entre 0 y 8'),
  handleValidationErrors,
];

export default {
  handleValidationErrors,
  validateRegister,
  validateLogin,
  validateChangePassword,
  validateCreateWallet,
  validateUpdateWallet,
  validateTransfer,
  validateExchange,
  validateExchangePreview,
  validateTransactionList,
  validateTransactionFilter,
  validateUpdateUser,
  validateUpdateExchangeRate,
  validateCreateCurrency,
};
