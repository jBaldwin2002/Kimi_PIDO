/**
 * PIDO - Utilidades de Encriptación
 * ==================================
 * Funciones para hash y verificación de contraseñas usando bcrypt
 */

import bcrypt from 'bcryptjs';
import logger from './logger';

// Número de rounds para el salt (10 es un buen balance entre seguridad y rendimiento)
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10');

/**
 * Genera un hash seguro de una contraseña
 * @param password - Contraseña en texto plano
 * @returns Hash de la contraseña
 */
export const hashPassword = async (password: string): Promise<string> => {
  try {
    // Generar salt
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    
    // Generar hash
    const hash = await bcrypt.hash(password, salt);
    
    logger.debug('Contraseña hasheada exitosamente');
    
    return hash;
  } catch (error) {
    logger.error('Error hasheando contraseña', { error: (error as Error).message });
    throw new Error('Error al encriptar la contraseña');
  }
};

/**
 * Verifica una contraseña contra un hash
 * @param password - Contraseña en texto plano
 * @param hash - Hash almacenado
 * @returns true si la contraseña coincide
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  try {
    const isMatch = await bcrypt.compare(password, hash);
    
    logger.debug('Verificación de contraseña', { match: isMatch });
    
    return isMatch;
  } catch (error) {
    logger.error('Error verificando contraseña', { error: (error as Error).message });
    throw new Error('Error al verificar la contraseña');
  }
};

/**
 * Genera un hash síncrono (útil para seeds o tests)
 * @param password - Contraseña en texto plano
 * @returns Hash de la contraseña
 */
export const hashPasswordSync = (password: string): string => {
  try {
    const salt = bcrypt.genSaltSync(SALT_ROUNDS);
    const hash = bcrypt.hashSync(password, salt);
    return hash;
  } catch (error) {
    logger.error('Error hasheando contraseña (sync)', { error: (error as Error).message });
    throw new Error('Error al encriptar la contraseña');
  }
};

/**
 * Verifica si una contraseña necesita ser rehasheada
 * (útil cuando se cambia el número de rounds)
 * @param hash - Hash existente
 * @returns true si necesita rehash
 */
export const needsRehash = (hash: string): boolean => {
  const saltRounds = bcrypt.getRounds(hash);
  return saltRounds !== SALT_ROUNDS;
};

/**
 * Genera una contraseña aleatoria segura
 * @param length - Longitud de la contraseña (default: 12)
 * @returns Contraseña aleatoria
 */
export const generateRandomPassword = (length: number = 12): string => {
  const charset = {
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  };

  const allChars = Object.values(charset).join('');
  let password = '';

  // Asegurar al menos un carácter de cada tipo
  password += charset.uppercase[Math.floor(Math.random() * charset.uppercase.length)];
  password += charset.lowercase[Math.floor(Math.random() * charset.lowercase.length)];
  password += charset.numbers[Math.floor(Math.random() * charset.numbers.length)];
  password += charset.symbols[Math.floor(Math.random() * charset.symbols.length)];

  // Completar el resto de la longitud
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Mezclar la contraseña
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

/**
 * Valida la fortaleza de una contraseña
 * @param password - Contraseña a validar
 * @returns Objeto con resultado y mensaje
 */
export const validatePasswordStrength = (password: string): {
  isValid: boolean;
  score: number;
  errors: string[];
} => {
  const errors: string[] = [];
  let score = 0;

  // Longitud mínima
  if (password.length < 8) {
    errors.push('La contraseña debe tener al menos 8 caracteres');
  } else {
    score += password.length >= 12 ? 2 : 1;
  }

  // Al menos una mayúscula
  if (!/[A-Z]/.test(password)) {
    errors.push('Debe contener al menos una letra mayúscula');
  } else {
    score += 1;
  }

  // Al menos una minúscula
  if (!/[a-z]/.test(password)) {
    errors.push('Debe contener al menos una letra minúscula');
  } else {
    score += 1;
  }

  // Al menos un número
  if (!/\d/.test(password)) {
    errors.push('Debe contener al menos un número');
  } else {
    score += 1;
  }

  // Al menos un símbolo
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    errors.push('Debe contener al menos un símbolo especial');
  } else {
    score += 1;
  }

  // No caracteres repetidos consecutivos
  if (/(.)\1{2,}/.test(password)) {
    errors.push('No debe contener caracteres repetidos consecutivamente');
    score -= 1;
  }

  // No secuencias comunes
  const commonSequences = ['123', 'abc', 'qwe', 'password', 'admin'];
  const lowerPassword = password.toLowerCase();
  if (commonSequences.some(seq => lowerPassword.includes(seq))) {
    errors.push('No debe contener secuencias comunes');
    score -= 1;
  }

  return {
    isValid: errors.length === 0,
    score: Math.max(0, score),
    errors,
  };
};

export default {
  hashPassword,
  verifyPassword,
  hashPasswordSync,
  needsRehash,
  generateRandomPassword,
  validatePasswordStrength,
};
