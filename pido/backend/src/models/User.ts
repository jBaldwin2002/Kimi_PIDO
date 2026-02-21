/**
 * PIDO - Modelo de Usuario
 * =========================
 * Operaciones CRUD para la tabla users
 */

import { query, withTransaction } from '@config/database';
import { User, UserRole, RegisterRequest } from '@types';
import { hashPassword } from '@utils/bcrypt';
import logger from '@utils/logger';

/**
 * Crea un nuevo usuario
 * @param userData - Datos del usuario a crear
 * @returns Usuario creado (sin password_hash)
 */
export const createUser = async (userData: RegisterRequest): Promise<Omit<User, 'password_hash'>> => {
  return withTransaction(async (client) => {
    // Hash de la contraseña
    const passwordHash = await hashPassword(userData.password);

    // Insertar usuario con rol 'user' por defecto
    const result = await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, role_id)
       VALUES ($1, $2, $3, $4, $5, (SELECT id FROM roles WHERE name = 'user'))
       RETURNING id, email, first_name, last_name, phone, role_id, is_active, is_verified, created_at`,
      [
        userData.email.toLowerCase(),
        passwordHash,
        userData.first_name,
        userData.last_name,
        userData.phone || null,
      ]
    );

    const user = result.rows[0];

    // Crear billetera principal automáticamente
    await client.query(
      `INSERT INTO wallets (user_id, name, is_primary)
       VALUES ($1, 'Mi Billetera', true)`,
      [user.id]
    );

    logger.info('Usuario creado exitosamente', { userId: user.id, email: user.email });

    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      role_id: user.role_id,
      is_active: user.is_active,
      is_verified: user.is_verified,
      created_at: user.created_at,
      password_hash: '', // No retornar el hash
      document_id: null,
      date_of_birth: null,
      email_verified_at: null,
      last_login_at: null,
      failed_login_attempts: 0,
      locked_until: null,
      updated_at: user.created_at,
    };
  });
};

/**
 * Busca un usuario por email (incluyendo password_hash para autenticación)
 * @param email - Email del usuario
 * @returns Usuario completo o null
 */
export const findUserByEmailWithPassword = async (email: string): Promise<User | null> => {
  const result = await query<User>(
    `SELECT u.*, r.name as role_name
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.email = $1`,
    [email.toLowerCase()]
  );

  return result.rows[0] || null;
};

/**
 * Busca un usuario por email (sin password_hash)
 * @param email - Email del usuario
 * @returns Usuario sin password_hash o null
 */
export const findUserByEmail = async (email: string): Promise<Omit<User, 'password_hash'> | null> => {
  const result = await query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, 
            u.document_id, u.date_of_birth, u.role_id, u.is_active, 
            u.is_verified, u.email_verified_at, u.last_login_at, 
            u.failed_login_attempts, u.locked_until, u.created_at, u.updated_at,
            r.name as role_name
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.email = $1`,
    [email.toLowerCase()]
  );

  return result.rows[0] || null;
};

/**
 * Busca un usuario por ID
 * @param id - ID del usuario
 * @returns Usuario sin password_hash o null
 */
export const findUserById = async (id: number): Promise<Omit<User, 'password_hash'> | null> => {
  const result = await query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, 
            u.document_id, u.date_of_birth, u.role_id, u.is_active, 
            u.is_verified, u.email_verified_at, u.last_login_at, 
            u.failed_login_attempts, u.locked_until, u.created_at, u.updated_at,
            r.name as role_name
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.id = $1`,
    [id]
  );

  return result.rows[0] || null;
};

/**
 * Actualiza el último login de un usuario
 * @param userId - ID del usuario
 */
export const updateLastLogin = async (userId: number): Promise<void> => {
  await query(
    `UPDATE users 
     SET last_login_at = CURRENT_TIMESTAMP, 
         failed_login_attempts = 0,
         locked_until = NULL
     WHERE id = $1`,
    [userId]
  );

  logger.debug('Último login actualizado', { userId });
};

/**
 * Incrementa los intentos fallidos de login
 * @param userId - ID del usuario
 * @returns Número de intentos fallidos actuales
 */
export const incrementFailedLoginAttempts = async (userId: number): Promise<number> => {
  const result = await query(
    `UPDATE users 
     SET failed_login_attempts = failed_login_attempts + 1
     WHERE id = $1
     RETURNING failed_login_attempts`,
    [userId]
  );

  const attempts = result.rows[0]?.failed_login_attempts || 0;

  // Bloquear cuenta después de 5 intentos fallidos
  if (attempts >= 5) {
    await query(
      `UPDATE users 
       SET locked_until = CURRENT_TIMESTAMP + INTERVAL '30 minutes'
       WHERE id = $1`,
      [userId]
    );
    logger.warn('Cuenta bloqueada por intentos fallidos', { userId, attempts });
  }

  return attempts;
};

/**
 * Verifica si una cuenta está bloqueada
 * @param userId - ID del usuario
 * @returns true si la cuenta está bloqueada
 */
export const isAccountLocked = async (userId: number): Promise<boolean> => {
  const result = await query(
    `SELECT locked_until 
     FROM users 
     WHERE id = $1 AND locked_until > CURRENT_TIMESTAMP`,
    [userId]
  );

  return result.rows.length > 0;
};

/**
 * Actualiza los datos de un usuario
 * @param userId - ID del usuario
 * @param updateData - Datos a actualizar
 * @returns Usuario actualizado
 */
export const updateUser = async (
  userId: number,
  updateData: Partial<Pick<User, 'first_name' | 'last_name' | 'phone' | 'document_id'>>
): Promise<Omit<User, 'password_hash'> | null> => {
  const allowedFields = ['first_name', 'last_name', 'phone', 'document_id'];
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updateData)) {
    if (allowedFields.includes(key) && value !== undefined) {
      updates.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (updates.length === 0) {
    return findUserById(userId);
  }

  values.push(userId);

  const result = await query(
    `UPDATE users 
     SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
     WHERE id = $${paramIndex}
     RETURNING id, email, first_name, last_name, phone, 
               document_id, date_of_birth, role_id, is_active, 
               is_verified, email_verified_at, last_login_at, 
               failed_login_attempts, locked_until, created_at, updated_at`,
    values
  );

  logger.info('Usuario actualizado', { userId });

  return result.rows[0] || null;
};

/**
 * Cambia la contraseña de un usuario
 * @param userId - ID del usuario
 * @param newPassword - Nueva contraseña
 */
export const changePassword = async (userId: number, newPassword: string): Promise<void> => {
  const passwordHash = await hashPassword(newPassword);

  await query(
    `UPDATE users 
     SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [passwordHash, userId]
  );

  logger.info('Contraseña cambiada', { userId });
};

/**
 * Desactiva un usuario (soft delete)
 * @param userId - ID del usuario
 */
export const deactivateUser = async (userId: number): Promise<void> => {
  await query(
    `UPDATE users 
     SET is_active = false, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [userId]
  );

  logger.info('Usuario desactivado', { userId });
};

/**
 * Lista usuarios con paginación
 * @param page - Página actual
 * @param limit - Límite por página
 * @returns Lista de usuarios y total
 */
export const listUsers = async (
  page: number = 1,
  limit: number = 10
): Promise<{ users: Omit<User, 'password_hash'>[]; total: number }> => {
  const offset = (page - 1) * limit;

  const [usersResult, countResult] = await Promise.all([
    query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, 
              u.document_id, u.date_of_birth, u.role_id, u.is_active, 
              u.is_verified, u.email_verified_at, u.last_login_at, 
              u.failed_login_attempts, u.locked_until, u.created_at, u.updated_at,
              r.name as role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       ORDER BY u.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
    query('SELECT COUNT(*) as total FROM users'),
  ]);

  return {
    users: usersResult.rows,
    total: parseInt(countResult.rows[0].total, 10),
  };
};

/**
 * Verifica si un email ya está registrado
 * @param email - Email a verificar
 * @returns true si el email existe
 */
export const emailExists = async (email: string): Promise<boolean> => {
  const result = await query(
    'SELECT 1 FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  return result.rows.length > 0;
};

export default {
  createUser,
  findUserByEmail,
  findUserByEmailWithPassword,
  findUserById,
  updateLastLogin,
  incrementFailedLoginAttempts,
  isAccountLocked,
  updateUser,
  changePassword,
  deactivateUser,
  listUsers,
  emailExists,
};
