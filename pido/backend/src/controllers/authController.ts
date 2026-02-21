/**
 * PIDO - Controlador de Autenticación
 * ====================================
 * Maneja las peticiones relacionadas con autenticación
 */

import { Request, Response } from 'express';
import * as authService from '@services/authService';
import { RegisterRequest, LoginRequest } from '@types';
import { sendSuccess, sendError } from '@utils/response';
import { asyncHandler } from '@middleware/errorHandler';
import logger from '@utils/logger';

/**
 * POST /api/auth/register
 * Registra un nuevo usuario
 */
export const register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userData: RegisterRequest = req.body;

  const result = await authService.register(userData);

  sendSuccess(res, result, 'Usuario registrado exitosamente', undefined, 201);
});

/**
 * POST /api/auth/login
 * Inicia sesión de un usuario
 */
export const login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const credentials: LoginRequest = req.body;

  const result = await authService.login(credentials);

  sendSuccess(res, result, 'Inicio de sesión exitoso');
});

/**
 * POST /api/auth/refresh
 * Refresca el token de acceso
 */
export const refreshToken = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    sendError(res, { code: 'REFRESH_TOKEN_REQUIRED', message: 'Refresh token es requerido' }, 400);
    return;
  }

  const result = await authService.refreshToken(refreshToken);

  sendSuccess(res, result, 'Token refrescado exitosamente');
});

/**
 * GET /api/auth/profile
 * Obtiene el perfil del usuario autenticado
 */
export const getProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const profile = await authService.getProfile(userId);

  sendSuccess(res, profile, 'Perfil obtenido exitosamente');
});

/**
 * PUT /api/auth/profile
 * Actualiza el perfil del usuario autenticado
 */
export const updateProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { first_name, last_name, phone } = req.body;

  const { updateUser } = await import('@models/User');
  const updatedUser = await updateUser(userId, { first_name, last_name, phone });

  sendSuccess(res, updatedUser, 'Perfil actualizado exitosamente');
});

/**
 * POST /api/auth/change-password
 * Cambia la contraseña del usuario
 */
export const changePassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { currentPassword, newPassword } = req.body;

  await authService.updatePassword(userId, currentPassword, newPassword);

  sendSuccess(res, null, 'Contraseña cambiada exitosamente');
});

/**
 * POST /api/auth/logout
 * Cierra la sesión del usuario
 */
export const logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const token = req.headers.authorization?.split(' ')[1];

  await authService.logout(userId, token);

  sendSuccess(res, null, 'Sesión cerrada exitosamente');
});

/**
 * GET /api/auth/verify
 * Verifica si el token es válido
 */
export const verifyToken = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // Si llega aquí, el middleware de auth ya verificó el token
  sendSuccess(res, {
    valid: true,
    user: {
      id: req.user!.userId,
      email: req.user!.email,
      role: req.user!.role,
    },
  }, 'Token válido');
});

export default {
  register,
  login,
  refreshToken,
  getProfile,
  updateProfile,
  changePassword,
  logout,
  verifyToken,
};
