/**
 * PIDO - Rutas de Autenticación
 * ==============================
 * Define las rutas para autenticación y gestión de usuarios
 */

import { Router } from 'express';
import * as authController from '@controllers/authController';
import { authenticate } from '@middleware/auth';
import {
  validateRegister,
  validateLogin,
  validateChangePassword,
  validateUpdateUser,
} from '@middleware/validation';

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Registra un nuevo usuario
 * @access  Público
 */
router.post('/register', ...validateRegister, authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Inicia sesión de un usuario
 * @access  Público
 */
router.post('/login', ...validateLogin, authController.login);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresca el token de acceso
 * @access  Público
 */
router.post('/refresh', authController.refreshToken);

/**
 * @route   GET /api/auth/profile
 * @desc    Obtiene el perfil del usuario autenticado
 * @access  Privado
 */
router.get('/profile', authenticate, authController.getProfile);

/**
 * @route   PUT /api/auth/profile
 * @desc    Actualiza el perfil del usuario
 * @access  Privado
 */
router.put('/profile', authenticate, ...validateUpdateUser, authController.updateProfile);

/**
 * @route   POST /api/auth/change-password
 * @desc    Cambia la contraseña del usuario
 * @access  Privado
 */
router.post('/change-password', authenticate, ...validateChangePassword, authController.changePassword);

/**
 * @route   POST /api/auth/logout
 * @desc    Cierra la sesión del usuario
 * @access  Privado
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @route   GET /api/auth/verify
 * @desc    Verifica si el token es válido
 * @access  Privado
 */
router.get('/verify', authenticate, authController.verifyToken);

export default router;
