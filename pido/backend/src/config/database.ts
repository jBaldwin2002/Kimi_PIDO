/**
 * PIDO - Configuración de Base de Datos
 * ======================================
 * Configuración y pool de conexiones PostgreSQL
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import logger from '@utils/logger';

// Configuración del pool de conexiones
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'pido_db',
  user: process.env.DB_USER || 'pido_user',
  password: process.env.DB_PASSWORD || 'pido_password',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  
  // Configuración del pool
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  min: parseInt(process.env.DB_POOL_MIN || '5'),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'),
});

// Eventos del pool
pool.on('connect', () => {
  logger.debug('Nueva conexión a la base de datos establecida');
});

pool.on('error', (err) => {
  logger.error('Error inesperado en el pool de conexiones', { error: err.message });
});

pool.on('remove', () => {
  logger.debug('Conexión removida del pool');
});

/**
 * Ejecuta una consulta SQL con parámetros
 * @param text - Consulta SQL
 * @param params - Parámetros de la consulta
 * @returns Resultado de la consulta
 */
export const query = async <T = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> => {
  const start = Date.now();
  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    
    logger.debug('Consulta ejecutada', {
      query: text.substring(0, 100),
      duration: `${duration}ms`,
      rows: result.rowCount
    });
    
    return result;
  } catch (error) {
    logger.error('Error ejecutando consulta', {
      query: text.substring(0, 100),
      error: (error as Error).message
    });
    throw error;
  }
};

/**
 * Obtiene una conexión del pool para transacciones
 * @returns Cliente del pool
 */
export const getClient = async (): Promise<PoolClient> => {
  const client = await pool.connect();
  
  // Sobrescribir el método query para logging
  const originalQuery = client.query.bind(client);
  
  // @ts-ignore - Sobrescritura para logging
  client.query = async (...args: any[]) => {
    const start = Date.now();
    try {
      // @ts-ignore
      const result = await originalQuery(...args);
      const duration = Date.now() - start;
      
      logger.debug('Consulta en transacción ejecutada', {
        query: typeof args[0] === 'string' ? args[0].substring(0, 100) : 'prepared statement',
        duration: `${duration}ms`,
        rows: result.rowCount
      });
      
      return result;
    } catch (error) {
      logger.error('Error en consulta de transacción', {
        query: typeof args[0] === 'string' ? args[0].substring(0, 100) : 'prepared statement',
        error: (error as Error).message
      });
      throw error;
    }
  };
  
  return client;
};

/**
 * Ejecuta una transacción con manejo automático de commit/rollback
 * @param callback - Función que recibe el cliente y ejecuta las operaciones
 * @returns Resultado de la transacción
 */
export const withTransaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    logger.debug('Transacción iniciada');
    
    const result = await callback(client);
    
    await client.query('COMMIT');
    logger.debug('Transacción commit exitoso');
    
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transacción rollback', { error: (error as Error).message });
    throw error;
  } finally {
    client.release();
    logger.debug('Cliente de transacción liberado');
  }
};

/**
 * Verifica la conexión a la base de datos
 * @returns true si la conexión es exitosa
 */
export const checkConnection = async (): Promise<boolean> => {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    logger.info('Conexión a base de datos exitosa', {
      time: result.rows[0].current_time
    });
    return true;
  } catch (error) {
    logger.error('Error conectando a la base de datos', {
      error: (error as Error).message
    });
    return false;
  }
};

/**
 * Cierra el pool de conexiones
 */
export const closePool = async (): Promise<void> => {
  await pool.end();
  logger.info('Pool de conexiones cerrado');
};

export default pool;
