/**
 * PIDO - Utilidades JWT
 * =====================
 * Funciones para manejo de tokens JWT
 */

import jwt from 'jsonwebtoken';
import { JWTPayload, TokenPair } from '@types';
import logger from './logger';

// Configuración de JWT desde variables de entorno
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Genera un par de tokens (access + refresh)
 * @param payload - Datos a incluir en el token
 * @returns Par de tokens
 */
export const generateTokenPair = (payload: Omit<JWTPayload, 'iat' | 'exp'>): TokenPair => {
  try {
    // Generar access token
    const accessToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    // Generar refresh token
    const refreshToken = jwt.sign(
      { userId: payload.userId },
      JWT_REFRESH_SECRET,
      { expiresIn: JWT_REFRESH_EXPIRES_IN }
    );

    // Calcular tiempo de expiración en segundos
    const expiresIn = parseExpirationTime(JWT_EXPIRES_IN);

    logger.debug('Tokens generados exitosamente', { userId: payload.userId });

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  } catch (error) {
    logger.error('Error generando tokens', { error: (error as Error).message });
    throw error;
  }
};

/**
 * Verifica un access token
 * @param token - Token a verificar
 * @returns Payload decodificado
 */
export const verifyAccessToken = (token: string): JWTPayload => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Token expirado');
      throw new Error('TOKEN_EXPIRED');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Token inválido', { error: error.message });
      throw new Error('TOKEN_INVALID');
    }
    throw error;
  }
};

/**
 * Verifica un refresh token
 * @param token - Refresh token a verificar
 * @returns Payload decodificado
 */
export const verifyRefreshToken = (token: string): { userId: number } => {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as { userId: number };
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Refresh token expirado');
      throw new Error('REFRESH_TOKEN_EXPIRED');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Refresh token inválido', { error: error.message });
      throw new Error('REFRESH_TOKEN_INVALID');
    }
    throw error;
  }
};

/**
 * Decodifica un token sin verificar la firma
 * @param token - Token a decodificar
 * @returns Payload decodificado o null
 */
export const decodeToken = (token: string): JWTPayload | null => {
  try {
    const decoded = jwt.decode(token) as JWTPayload;
    return decoded;
  } catch (error) {
    logger.error('Error decodificando token', { error: (error as Error).message });
    return null;
  }
};

/**
 * Refresca un access token usando un refresh token válido
 * @param refreshToken - Refresh token
 * @returns Nuevo par de tokens
 */
export const refreshAccessToken = (
  refreshToken: string,
  userData: { userId: number; email: string; role: string }
): TokenPair => {
  try {
    // Verificar refresh token
    verifyRefreshToken(refreshToken);

    // Generar nuevo par de tokens
    return generateTokenPair({
      userId: userData.userId,
      email: userData.email,
      role: userData.role,
    });
  } catch (error) {
    logger.error('Error refrescando token', { error: (error as Error).message });
    throw error;
  }
};

/**
 * Extrae el token del header Authorization
 * @param authHeader - Header Authorization
 * @returns Token limpio o null
 */
export const extractTokenFromHeader = (authHeader: string | undefined): string | null => {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
};

/**
 * Calcula el tiempo de expiración en segundos desde una cadena
 * @param expiration - Cadena de expiración (ej: '1h', '7d')
 * @returns Tiempo en segundos
 */
const parseExpirationTime = (expiration: string): number => {
  const match = expiration.match(/^(\d+)([smhd])$/);
  
  if (!match) {
    return 3600; // Default 1 hora
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };

  return value * (multipliers[unit] || 3600);
};

export default {
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  refreshAccessToken,
  extractTokenFromHeader,
};
