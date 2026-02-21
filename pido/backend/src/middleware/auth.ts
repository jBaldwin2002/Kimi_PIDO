/**
 * PIDO - Middleware de Autenticación
 * ===================================
 * Middleware para verificar JWT y autorizar accesos
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, extractTokenFromHeader } from '@utils/jwt';
import { findUserById } from '@models/User';
import { sendUnauthorized, sendForbidden, sendServerError } from '@utils/response';
import { ErrorCodes } from '@utils/response';
import { JWTPayload } from '@types';
import logger from '@utils/logger';

// Extender la interfaz Request de Express para incluir el usuario
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload & { first_name: string; last_name: string };
    }
  }
}

/**
 * Middleware para verificar el token JWT
 * Agrega el usuario decodificado al request
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extraer token del header
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      sendUnauthorized(res, 'Token no proporcionado', ErrorCodes.AUTH_TOKEN_INVALID);
      return;
    }

    // Verificar token
    let decoded: JWTPayload;
    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      const errorMessage = (error as Error).message;
      
      if (errorMessage === 'TOKEN_EXPIRED') {
        sendUnauthorized(res, 'Token expirado', ErrorCodes.AUTH_TOKEN_EXPIRED);
        return;
      }
      
      sendUnauthorized(res, 'Token inválido', ErrorCodes.AUTH_TOKEN_INVALID);
      return;
    }

    // Verificar que el usuario existe y está activo
    const user = await findUserById(decoded.userId);

    if (!user) {
      sendUnauthorized(res, 'Usuario no encontrado', ErrorCodes.USER_NOT_FOUND);
      return;
    }

    if (!user.is_active) {
      sendForbidden(res, 'Cuenta desactivada', ErrorCodes.AUTH_USER_INACTIVE);
      return;
    }

    // Agregar usuario al request
    req.user = {
      ...decoded,
      first_name: user.first_name,
      last_name: user.last_name,
    };

    next();
  } catch (error) {
    logger.error('Error en autenticación', { error: (error as Error).message });
    sendServerError(res);
  }
};

/**
 * Middleware opcional de autenticación
 * Si hay token, lo verifica y agrega el usuario
 * Si no hay token, permite continuar sin usuario
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      next();
      return;
    }

    try {
      const decoded = verifyAccessToken(token);
      const user = await findUserById(decoded.userId);

      if (user && user.is_active) {
        req.user = {
          ...decoded,
          first_name: user.first_name,
          last_name: user.last_name,
        };
      }
    } catch (error) {
      // Ignorar errores de token en auth opcional
    }

    next();
  } catch (error) {
    next();
  }
};

/**
 * Middleware para autorizar roles específicos
 * @param allowedRoles - Roles permitidos
 */
export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendUnauthorized(res, 'No autenticado');
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendForbidden(
        res,
        'No tiene permisos para acceder a este recurso',
        ErrorCodes.FORBIDDEN
      );
      return;
    }

    next();
  };
};

/**
 * Middleware para verificar que el usuario es administrador
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    sendUnauthorized(res, 'No autenticado');
    return;
  }

  if (req.user.role !== 'admin') {
    sendForbidden(
      res,
      'Se requieren permisos de administrador',
      ErrorCodes.FORBIDDEN
    );
    return;
  }

  next();
};

/**
 * Middleware para verificar propiedad del recurso
 * El usuario solo puede acceder a sus propios recursos (a menos que sea admin)
 * @param paramName - Nombre del parámetro que contiene el userId
 */
export const requireOwnership = (paramName: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendUnauthorized(res, 'No autenticado');
      return;
    }

    // Los administradores pueden acceder a cualquier recurso
    if (req.user.role === 'admin') {
      next();
      return;
    }

    const resourceUserId = parseInt(req.params[paramName], 10);

    if (isNaN(resourceUserId)) {
      sendForbidden(res, 'ID de usuario inválido');
      return;
    }

    if (req.user.userId !== resourceUserId) {
      sendForbidden(
        res,
        'No tiene permisos para acceder a este recurso',
        ErrorCodes.FORBIDDEN
      );
      return;
    }

    next();
  };
};

/**
 * Middleware para verificar que la cuenta no está bloqueada
 */
export const checkAccountNotLocked = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      next();
      return;
    }

    const { isAccountLocked } = await import('@models/User');
    const isLocked = await isAccountLocked(req.user.userId);

    if (isLocked) {
      sendForbidden(
        res,
        'Cuenta bloqueada temporalmente por seguridad. Intente más tarde.',
        ErrorCodes.AUTH_USER_LOCKED
      );
      return;
    }

    next();
  } catch (error) {
    logger.error('Error verificando bloqueo de cuenta', { error: (error as Error).message });
    sendServerError(res);
  }
};

export default {
  authenticate,
  optionalAuth,
  authorize,
  requireAdmin,
  requireOwnership,
  checkAccountNotLocked,
};
