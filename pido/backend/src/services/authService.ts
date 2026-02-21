/**
 * PIDO - Servicio de Autenticación
 * =================================
 * Lógica de negocio para autenticación y gestión de usuarios
 */

import {
  createUser,
  findUserByEmailWithPassword,
  findUserById,
  updateLastLogin,
  incrementFailedLoginAttempts,
  isAccountLocked,
  emailExists,
  changePassword,
} from '@models/User';
import { generateTokenPair, verifyRefreshToken } from '@utils/jwt';
import { verifyPassword } from '@utils/bcrypt';
import { RegisterRequest, LoginRequest, AuthResponse, UserResponse } from '@types';
import {
  AuthenticationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@middleware/errorHandler';
import logger from '@utils/logger';

/**
 * Registra un nuevo usuario
 * @param userData - Datos del usuario
 * @returns Respuesta con usuario y tokens
 */
export const register = async (userData: RegisterRequest): Promise<AuthResponse> => {
  // Verificar si el email ya existe
  const exists = await emailExists(userData.email);
  
  if (exists) {
    throw new ConflictError('El email ya está registrado');
  }

  // Crear usuario
  const user = await createUser(userData);

  // Generar tokens
  const tokens = generateTokenPair({
    userId: user.id,
    email: user.email,
    role: 'user',
  });

  // Actualizar último login
  await updateLastLogin(user.id);

  logger.info('Usuario registrado exitosamente', { userId: user.id, email: user.email });

  return {
    user: mapToUserResponse(user),
    token: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
};

/**
 * Inicia sesión de un usuario
 * @param credentials - Credenciales de login
 * @returns Respuesta con usuario y tokens
 */
export const login = async (credentials: LoginRequest): Promise<AuthResponse> => {
  // Buscar usuario por email (con password hash)
  const user = await findUserByEmailWithPassword(credentials.email);

  if (!user) {
    throw new AuthenticationError('Credenciales inválidas');
  }

  // Verificar si la cuenta está bloqueada
  const locked = await isAccountLocked(user.id);
  
  if (locked) {
    throw new AuthenticationError(
      'Cuenta bloqueada temporalmente por seguridad. Intente más tarde.',
      'AUTH_USER_LOCKED'
    );
  }

  // Verificar contraseña
  const isValidPassword = await verifyPassword(credentials.password, user.password_hash);

  if (!isValidPassword) {
    // Incrementar intentos fallidos
    await incrementFailedLoginAttempts(user.id);
    throw new AuthenticationError('Credenciales inválidas');
  }

  // Verificar que la cuenta esté activa
  if (!user.is_active) {
    throw new AuthenticationError('Cuenta desactivada', 'AUTH_USER_INACTIVE');
  }

  // Generar tokens
  const tokens = generateTokenPair({
    userId: user.id,
    email: user.email,
    role: user.role_id === 1 ? 'admin' : 'user',
  });

  // Actualizar último login
  await updateLastLogin(user.id);

  logger.info('Usuario autenticado exitosamente', { userId: user.id, email: user.email });

  return {
    user: mapToUserResponse(user),
    token: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
};

/**
 * Refresca el token de acceso
 * @param refreshToken - Refresh token
 * @returns Nuevo par de tokens
 */
export const refreshToken = async (refreshToken: string): Promise<{ token: string; refreshToken: string }> => {
  try {
    // Verificar refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Buscar usuario
    const user = await findUserById(decoded.userId);

    if (!user) {
      throw new AuthenticationError('Usuario no encontrado');
    }

    if (!user.is_active) {
      throw new AuthenticationError('Cuenta desactivada', 'AUTH_USER_INACTIVE');
    }

    // Generar nuevos tokens
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role_id === 1 ? 'admin' : 'user',
    });

    logger.info('Token refrescado', { userId: user.id });

    return {
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'REFRESH_TOKEN_EXPIRED') {
      throw new AuthenticationError('Sesión expirada', 'AUTH_REFRESH_TOKEN_INVALID');
    }
    throw new AuthenticationError('Token inválido', 'AUTH_REFRESH_TOKEN_INVALID');
  }
};

/**
 * Obtiene el perfil de un usuario
 * @param userId - ID del usuario
 * @returns Perfil del usuario
 */
export const getProfile = async (userId: number): Promise<UserResponse> => {
  const user = await findUserById(userId);

  if (!user) {
    throw new NotFoundError('Usuario');
  }

  return mapToUserResponse(user);
};

/**
 * Cambia la contraseña de un usuario
 * @param userId - ID del usuario
 * @param currentPassword - Contraseña actual
 * @param newPassword - Nueva contraseña
 */
export const updatePassword = async (
  userId: number,
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  // Buscar usuario con password
  const userWithPassword = await findUserByEmailWithPassword(
    (await findUserById(userId))?.email || ''
  );

  if (!userWithPassword) {
    throw new NotFoundError('Usuario');
  }

  // Verificar contraseña actual
  const isValid = await verifyPassword(currentPassword, userWithPassword.password_hash);

  if (!isValid) {
    throw new ValidationError('La contraseña actual es incorrecta');
  }

  // Verificar que la nueva contraseña sea diferente
  const isSamePassword = await verifyPassword(newPassword, userWithPassword.password_hash);
  
  if (isSamePassword) {
    throw new ValidationError('La nueva contraseña debe ser diferente a la actual');
  }

  // Cambiar contraseña
  await changePassword(userId, newPassword);

  logger.info('Contraseña cambiada exitosamente', { userId });
};

/**
 * Cierra la sesión de un usuario (revoca tokens)
 * @param userId - ID del usuario
 * @param token - Token a revocar (opcional)
 */
export const logout = async (userId: number, token?: string): Promise<void> => {
  // Aquí se podría implementar la revocación de tokens
  // Por ahora solo registramos el logout
  logger.info('Usuario cerró sesión', { userId });
};

/**
 * Mapea un usuario de base de datos a UserResponse
 * @param user - Usuario de base de datos
 * @returns UserResponse
 */
const mapToUserResponse = (user: any): UserResponse => ({
  id: user.id,
  email: user.email,
  first_name: user.first_name,
  last_name: user.last_name,
  phone: user.phone,
  role: user.role_name || (user.role_id === 1 ? 'admin' : 'user'),
  is_verified: user.is_verified,
  created_at: user.created_at,
});

export default {
  register,
  login,
  refreshToken,
  getProfile,
  updatePassword,
  logout,
};
