/**
 * PIDO - Tipos e Interfaces del Sistema
 * ======================================
 * Define todos los tipos, interfaces y enums utilizados en el backend
 */

// =====================================================
// ENUMS
// =====================================================

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user'
}

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  TRANSFER_SENT = 'transfer_sent',
  TRANSFER_RECEIVED = 'transfer_received',
  EXCHANGE = 'exchange',
  FEE = 'fee',
  REFUND = 'refund',
  ADJUSTMENT = 'adjustment'
}

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

// =====================================================
// INTERFACES DE BASE DE DATOS
// =====================================================

export interface Role {
  id: number;
  name: string;
  description: string | null;
  permissions: string[];
  created_at: Date;
  updated_at: Date;
}

export interface User {
  id: number;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  document_id: string | null;
  date_of_birth: Date | null;
  role_id: number;
  is_active: boolean;
  is_verified: boolean;
  email_verified_at: Date | null;
  last_login_at: Date | null;
  failed_login_attempts: number;
  locked_until: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserSession {
  id: number;
  user_id: number;
  token: string;
  refresh_token: string | null;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: Date;
  created_at: Date;
  revoked_at: Date | null;
}

export interface Currency {
  id: number;
  code: string;
  name: string;
  symbol: string;
  flag_emoji: string | null;
  is_active: boolean;
  is_base_currency: boolean;
  decimal_places: number;
  min_amount: number;
  max_amount: number;
  created_at: Date;
  updated_at: Date;
}

export interface ExchangeRate {
  id: number;
  from_currency_id: number;
  to_currency_id: number;
  rate: number;
  inverse_rate: number;
  spread_percentage: number;
  final_rate: number;
  source: string;
  is_active: boolean;
  valid_from: Date;
  valid_until: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Wallet {
  id: number;
  user_id: number;
  wallet_number: string;
  name: string;
  is_primary: boolean;
  is_active: boolean;
  daily_limit: number;
  monthly_limit: number;
  created_at: Date;
  updated_at: Date;
}

export interface WalletBalance {
  id: number;
  wallet_id: number;
  currency_id: number;
  balance: number;
  available_balance: number;
  held_balance: number;
  last_transaction_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Transaction {
  id: number;
  transaction_number: string;
  transaction_type: TransactionType;
  status: TransactionStatus;
  from_wallet_id: number | null;
  to_wallet_id: number | null;
  from_user_id: number | null;
  to_user_id: number | null;
  from_currency_id: number | null;
  to_currency_id: number | null;
  from_amount: number;
  to_amount: number | null;
  exchange_rate: number | null;
  fee_amount: number;
  fee_currency_id: number | null;
  description: string | null;
  reference_code: string | null;
  external_reference: string | null;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

export interface TransactionLog {
  id: number;
  transaction_id: number;
  action: string;
  previous_status: TransactionStatus | null;
  new_status: TransactionStatus | null;
  previous_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  performed_by: number | null;
  ip_address: string | null;
  user_agent: string | null;
  notes: string | null;
  created_at: Date;
}

// =====================================================
// INTERFACES DE REQUEST/RESPONSE
// =====================================================

export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: UserResponse;
  token: string;
  refreshToken: string;
}

export interface UserResponse {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: string;
  is_verified: boolean;
  created_at: Date;
}

export interface TransferRequest {
  to_wallet_number: string;
  amount: number;
  currency_code: string;
  description?: string;
}

export interface ExchangeRequest {
  from_currency_code: string;
  to_currency_code: string;
  amount: number;
}

export interface ExchangePreview {
  from_currency: Currency;
  to_currency: Currency;
  amount: number;
  exchange_rate: number;
  final_rate: number;
  spread_percentage: number;
  to_amount: number;
  fee_amount: number;
  total_deduction: number;
}

export interface TransactionResponse {
  id: number;
  transaction_number: string;
  transaction_type: TransactionType;
  status: TransactionStatus;
  from_amount: number;
  to_amount: number | null;
  exchange_rate: number | null;
  fee_amount: number;
  description: string | null;
  created_at: Date;
  from_wallet_number: string | null;
  to_wallet_number: string | null;
  from_user_name: string | null;
  to_user_name: string | null;
  from_currency_code: string | null;
  to_currency_code: string | null;
}

export interface WalletResponse {
  id: number;
  wallet_number: string;
  name: string;
  is_primary: boolean;
  balances: WalletBalanceResponse[];
}

export interface WalletBalanceResponse {
  currency_code: string;
  currency_name: string;
  symbol: string;
  balance: number;
  available_balance: number;
  flag_emoji: string | null;
}

export interface DashboardStats {
  total_balance_usd: number;
  recent_transactions: TransactionResponse[];
  wallet_count: number;
  currency_count: number;
}

// =====================================================
// INTERFACES DE SERVICIOS
// =====================================================

export interface PaginationParams {
  page: number;
  limit: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// =====================================================
// TIPOS DE JWT
// =====================================================

export interface JWTPayload {
  userId: number;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// =====================================================
// TIPOS DE CONFIGURACIÓN
// =====================================================

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
}

export interface JWTConfig {
  secret: string;
  refreshSecret: string;
  expiresIn: string;
  refreshExpiresIn: string;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  apiPrefix: string;
  corsOrigin: string;
}
