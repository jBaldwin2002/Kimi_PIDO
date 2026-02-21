-- =====================================================
-- PIDO - Digital Wallet & Currency Exchange System
-- Base de Datos PostgreSQL
-- =====================================================

-- Eliminar tablas si existen (para recrear)
DROP TABLE IF EXISTS transaction_logs CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS wallet_balances CASCADE;
DROP TABLE IF EXISTS wallets CASCADE;
DROP TABLE IF EXISTS exchange_rates CASCADE;
DROP TABLE IF EXISTS currencies CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- =====================================================
-- TABLA: ROLES
-- =====================================================
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE roles IS 'Tabla de roles de usuario (Usuario, Administrador)';
COMMENT ON COLUMN roles.permissions IS 'Permisos en formato JSON array';

-- =====================================================
-- TABLA: USUARIOS
-- =====================================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    document_id VARCHAR(50),
    date_of_birth DATE,
    role_id INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP,
    last_login_at TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Restricciones
    CONSTRAINT fk_user_role 
        FOREIGN KEY (role_id) 
        REFERENCES roles(id) 
        ON DELETE RESTRICT,
    CONSTRAINT chk_email_format 
        CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Índices para usuarios
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_users_active ON users(is_active);

COMMENT ON TABLE users IS 'Tabla principal de usuarios del sistema PIDO';
COMMENT ON COLUMN users.password_hash IS 'Contraseña encriptada con bcrypt';

-- =====================================================
-- TABLA: SESIONES DE USUARIO
-- =====================================================
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token VARCHAR(500) NOT NULL,
    refresh_token VARCHAR(500),
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP,
    
    CONSTRAINT fk_session_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(token);

COMMENT ON TABLE user_sessions IS 'Registro de sesiones activas de usuarios';

-- =====================================================
-- TABLA: DIVISAS (MONEDAS)
-- =====================================================
CREATE TABLE currencies (
    id SERIAL PRIMARY KEY,
    code VARCHAR(3) UNIQUE NOT NULL,  -- USD, EUR, MXN, etc.
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(10) NOT NULL,       -- $, €, £, etc.
    flag_emoji VARCHAR(10),
    is_active BOOLEAN DEFAULT TRUE,
    is_base_currency BOOLEAN DEFAULT FALSE,  -- Divisa base del sistema
    decimal_places INTEGER DEFAULT 2,
    min_amount DECIMAL(18, 8) DEFAULT 0.01,
    max_amount DECIMAL(18, 8) DEFAULT 999999999.99,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_currency_code 
        CHECK (LENGTH(code) = 3),
    CONSTRAINT chk_decimal_places 
        CHECK (decimal_places BETWEEN 0 AND 8)
);

CREATE INDEX idx_currencies_code ON currencies(code);
CREATE INDEX idx_currencies_active ON currencies(is_active);

COMMENT ON TABLE currencies IS 'Catálogo de divisas soportadas por el sistema';

-- =====================================================
-- TABLA: TASAS DE CAMBIO
-- =====================================================
CREATE TABLE exchange_rates (
    id SERIAL PRIMARY KEY,
    from_currency_id INTEGER NOT NULL,
    to_currency_id INTEGER NOT NULL,
    rate DECIMAL(18, 8) NOT NULL,           -- Tasa de cambio
    inverse_rate DECIMAL(18, 8) NOT NULL,   -- Tasa inversa
    spread_percentage DECIMAL(5, 2) DEFAULT 0.00,  -- Margen de ganancia
    final_rate DECIMAL(18, 8) NOT NULL,     -- Tasa con spread aplicado
    source VARCHAR(50) DEFAULT 'manual',    -- Fuente de la tasa
    is_active BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_rate_from_currency 
        FOREIGN KEY (from_currency_id) 
        REFERENCES currencies(id) 
        ON DELETE RESTRICT,
    CONSTRAINT fk_rate_to_currency 
        FOREIGN KEY (to_currency_id) 
        REFERENCES currencies(id) 
        ON DELETE RESTRICT,
    CONSTRAINT chk_positive_rate 
        CHECK (rate > 0),
    CONSTRAINT chk_different_currencies 
        CHECK (from_currency_id != to_currency_id),
    CONSTRAINT uq_currency_pair 
        UNIQUE (from_currency_id, to_currency_id)
);

CREATE INDEX idx_rates_from_currency ON exchange_rates(from_currency_id);
CREATE INDEX idx_rates_to_currency ON exchange_rates(to_currency_id);
CREATE INDEX idx_rates_active ON exchange_rates(is_active);

COMMENT ON TABLE exchange_rates IS 'Tasas de cambio entre divisas';

-- =====================================================
-- TABLA: BILLETERAS
-- =====================================================
CREATE TABLE wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    wallet_number VARCHAR(20) UNIQUE NOT NULL,  -- Número de billetera único
    name VARCHAR(100) DEFAULT 'Mi Billetera',
    is_primary BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    daily_limit DECIMAL(18, 2) DEFAULT 10000.00,
    monthly_limit DECIMAL(18, 2) DEFAULT 100000.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_wallet_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE,
    CONSTRAINT chk_wallet_number 
        CHECK (wallet_number ~ '^[0-9]{10,20}$')
);

CREATE INDEX idx_wallets_user ON wallets(user_id);
CREATE INDEX idx_wallets_number ON wallets(wallet_number);
CREATE INDEX idx_wallets_primary ON wallets(is_primary);

COMMENT ON TABLE wallets IS 'Billeteras digitales de los usuarios';

-- =====================================================
-- TABLA: SALDOS DE BILLETERA POR DIVISA
-- =====================================================
CREATE TABLE wallet_balances (
    id SERIAL PRIMARY KEY,
    wallet_id INTEGER NOT NULL,
    currency_id INTEGER NOT NULL,
    balance DECIMAL(18, 8) DEFAULT 0.00,
    available_balance DECIMAL(18, 8) DEFAULT 0.00,  -- Balance disponible (restando retenciones)
    held_balance DECIMAL(18, 8) DEFAULT 0.00,       -- Balance retenido
    last_transaction_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_balance_wallet 
        FOREIGN KEY (wallet_id) 
        REFERENCES wallets(id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_balance_currency 
        FOREIGN KEY (currency_id) 
        REFERENCES currencies(id) 
        ON DELETE RESTRICT,
    CONSTRAINT uq_wallet_currency 
        UNIQUE (wallet_id, currency_id),
    CONSTRAINT chk_non_negative_balance 
        CHECK (balance >= 0),
    CONSTRAINT chk_available_balance 
        CHECK (available_balance >= 0),
    CONSTRAINT chk_held_balance 
        CHECK (held_balance >= 0)
);

CREATE INDEX idx_balances_wallet ON wallet_balances(wallet_id);
CREATE INDEX idx_balances_currency ON wallet_balances(currency_id);

COMMENT ON TABLE wallet_balances IS 'Saldos de cada billetera por tipo de divisa';

-- =====================================================
-- TABLA: TRANSACCIONES
-- =====================================================
CREATE TYPE transaction_type AS ENUM (
    'deposit',           -- Depósito
    'withdrawal',        -- Retiro
    'transfer_sent',     -- Transferencia enviada
    'transfer_received', -- Transferencia recibida
    'exchange',          -- Intercambio de divisas
    'fee',               -- Comisión
    'refund',            -- Reembolso
    'adjustment'         -- Ajuste manual
);

CREATE TYPE transaction_status AS ENUM (
    'pending',     -- Pendiente
    'processing',  -- En proceso
    'completed',   -- Completada
    'failed',      -- Fallida
    'cancelled',   -- Cancelada
    'refunded'     -- Reembolsada
);

CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    transaction_number VARCHAR(50) UNIQUE NOT NULL,  -- Número único de transacción
    transaction_type transaction_type NOT NULL,
    status transaction_status DEFAULT 'pending',
    
    -- Billeteras involucradas
    from_wallet_id INTEGER,
    to_wallet_id INTEGER,
    
    -- Usuarios involucrados
    from_user_id INTEGER,
    to_user_id INTEGER,
    
    -- Divisas y montos
    from_currency_id INTEGER,
    to_currency_id INTEGER,
    from_amount DECIMAL(18, 8) NOT NULL,
    to_amount DECIMAL(18, 8),
    exchange_rate DECIMAL(18, 8),
    
    -- Comisiones
    fee_amount DECIMAL(18, 8) DEFAULT 0.00,
    fee_currency_id INTEGER,
    
    -- Descripción y metadata
    description TEXT,
    reference_code VARCHAR(100),
    external_reference VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    
    -- Tiempos
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_tx_from_wallet 
        FOREIGN KEY (from_wallet_id) 
        REFERENCES wallets(id) 
        ON DELETE SET NULL,
    CONSTRAINT fk_tx_to_wallet 
        FOREIGN KEY (to_wallet_id) 
        REFERENCES wallets(id) 
        ON DELETE SET NULL,
    CONSTRAINT fk_tx_from_user 
        FOREIGN KEY (from_user_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL,
    CONSTRAINT fk_tx_to_user 
        FOREIGN KEY (to_user_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL,
    CONSTRAINT fk_tx_from_currency 
        FOREIGN KEY (from_currency_id) 
        REFERENCES currencies(id) 
        ON DELETE RESTRICT,
    CONSTRAINT fk_tx_to_currency 
        FOREIGN KEY (to_currency_id) 
        REFERENCES currencies(id) 
        ON DELETE RESTRICT,
    CONSTRAINT fk_tx_fee_currency 
        FOREIGN KEY (fee_currency_id) 
        REFERENCES currencies(id) 
        ON DELETE RESTRICT,
    CONSTRAINT chk_positive_amount 
        CHECK (from_amount > 0),
    CONSTRAINT chk_transaction_wallets 
        CHECK (
            (transaction_type IN ('deposit', 'transfer_received') AND to_wallet_id IS NOT NULL) OR
            (transaction_type IN ('withdrawal', 'transfer_sent') AND from_wallet_id IS NOT NULL) OR
            (transaction_type = 'exchange' AND from_wallet_id IS NOT NULL AND to_wallet_id IS NOT NULL)
        )
);

CREATE INDEX idx_transactions_number ON transactions(transaction_number);
CREATE INDEX idx_transactions_from_wallet ON transactions(from_wallet_id);
CREATE INDEX idx_transactions_to_wallet ON transactions(to_wallet_id);
CREATE INDEX idx_transactions_from_user ON transactions(from_user_id);
CREATE INDEX idx_transactions_to_user ON transactions(to_user_id);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created ON transactions(created_at);
CREATE INDEX idx_transactions_metadata ON transactions USING GIN (metadata);

COMMENT ON TABLE transactions IS 'Registro de todas las transacciones del sistema';
COMMENT ON COLUMN transactions.metadata IS 'Datos adicionales en formato JSON';

-- =====================================================
-- TABLA: LOGS DE TRANSACCIONES (Auditoría)
-- =====================================================
CREATE TABLE transaction_logs (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER NOT NULL,
    action VARCHAR(50) NOT NULL,           -- created, updated, status_changed, etc.
    previous_status transaction_status,
    new_status transaction_status,
    previous_data JSONB,
    new_data JSONB,
    performed_by INTEGER,                  -- Usuario que realizó la acción (NULL = sistema)
    ip_address INET,
    user_agent TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_log_transaction 
        FOREIGN KEY (transaction_id) 
        REFERENCES transactions(id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_log_performed_by 
        FOREIGN KEY (performed_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL
);

CREATE INDEX idx_logs_transaction ON transaction_logs(transaction_id);
CREATE INDEX idx_logs_action ON transaction_logs(action);
CREATE INDEX idx_logs_created ON transaction_logs(created_at);

COMMENT ON TABLE transaction_logs IS 'Log de auditoría para todas las transacciones';

-- =====================================================
-- FUNCIONES Y TRIGGERS
-- =====================================================

-- Función para actualizar el timestamp updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para actualizar updated_at
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_currencies_updated_at BEFORE UPDATE ON currencies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exchange_rates_updated_at BEFORE UPDATE ON exchange_rates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallet_balances_updated_at BEFORE UPDATE ON wallet_balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para generar número de billetera único
CREATE OR REPLACE FUNCTION generate_wallet_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.wallet_number := LPAD(FLOOR(RANDOM() * 10000000000)::TEXT, 10, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_wallet_number BEFORE INSERT ON wallets
    FOR EACH ROW EXECUTE FUNCTION generate_wallet_number();

-- Función para generar número de transacción único
CREATE OR REPLACE FUNCTION generate_transaction_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.transaction_number := 'TXN' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(NEXTVAL('transactions_id_seq')::TEXT, 10, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_transaction_number BEFORE INSERT ON transactions
    FOR EACH ROW EXECUTE FUNCTION generate_transaction_number();

-- Función para crear saldos iniciales al crear billetera
CREATE OR REPLACE FUNCTION create_initial_wallet_balances()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO wallet_balances (wallet_id, currency_id, balance, available_balance)
    SELECT NEW.id, id, 0.00, 0.00 FROM currencies WHERE is_active = TRUE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_wallet_balances AFTER INSERT ON wallets
    FOR EACH ROW EXECUTE FUNCTION create_initial_wallet_balances();

-- Función para log de transacciones
CREATE OR REPLACE FUNCTION log_transaction_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO transaction_logs (transaction_id, action, new_data, new_status)
        VALUES (NEW.id, 'created', to_jsonb(NEW), NEW.status);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            INSERT INTO transaction_logs (transaction_id, action, previous_status, new_status, previous_data, new_data)
            VALUES (NEW.id, 'status_changed', OLD.status, NEW.status, to_jsonb(OLD), to_jsonb(NEW));
        ELSE
            INSERT INTO transaction_logs (transaction_id, action, previous_data, new_data)
            VALUES (NEW.id, 'updated', to_jsonb(OLD), to_jsonb(NEW));
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_transaction_changes AFTER INSERT OR UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION log_transaction_change();

-- =====================================================
-- DATOS INICIALES
-- =====================================================

-- Insertar roles
INSERT INTO roles (name, description, permissions) VALUES
('admin', 'Administrador del sistema con acceso completo', '["users:read", "users:write", "users:delete", "wallets:read", "wallets:write", "transactions:read", "transactions:write", "transactions:delete", "currencies:read", "currencies:write", "exchange_rates:read", "exchange_rates:write", "reports:read", "system:config"]'),
('user', 'Usuario estándar del sistema', '["profile:read", "profile:write", "wallet:read", "wallet:write", "transaction:read", "transaction:write", "transfer:send", "transfer:receive", "exchange:perform"]');

-- Insertar divisas
INSERT INTO currencies (code, name, symbol, flag_emoji, is_active, is_base_currency, decimal_places) VALUES
('USD', 'Dólar Estadounidense', '$', '🇺🇸', TRUE, TRUE, 2),
('EUR', 'Euro', '€', '🇪🇺', TRUE, FALSE, 2),
('MXN', 'Peso Mexicano', '$', '🇲🇽', TRUE, FALSE, 2),
('GBP', 'Libra Esterlina', '£', '🇬🇧', TRUE, FALSE, 2),
('COP', 'Peso Colombiano', '$', '🇨🇴', TRUE, FALSE, 2),
('ARS', 'Peso Argentino', '$', '🇦🇷', TRUE, FALSE, 2),
('BRL', 'Real Brasileño', 'R$', '🇧🇷', TRUE, FALSE, 2),
('CLP', 'Peso Chileno', '$', '🇨🇱', TRUE, FALSE, 0),
('PEN', 'Sol Peruano', 'S/', '🇵🇪', TRUE, FALSE, 2);

-- Insertar tasas de cambio iniciales (con respecto a USD)
INSERT INTO exchange_rates (from_currency_id, to_currency_id, rate, inverse_rate, spread_percentage, final_rate, source) VALUES
-- USD a otras divisas
(1, 2, 0.92, 1.09, 1.50, 0.9062, 'manual'),  -- USD -> EUR
(1, 3, 17.05, 0.0587, 1.50, 16.7943, 'manual'),  -- USD -> MXN
(1, 4, 0.79, 1.27, 1.50, 0.7782, 'manual'),  -- USD -> GBP
(1, 5, 3925.00, 0.000255, 2.00, 3846.50, 'manual'),  -- USD -> COP
(1, 6, 875.50, 0.00114, 2.50, 853.61, 'manual'),  -- USD -> ARS
(1, 7, 4.95, 0.202, 2.00, 4.851, 'manual'),  -- USD -> BRL
(1, 8, 905.00, 0.0011, 2.00, 886.90, 'manual'),  -- USD -> CLP
(1, 9, 3.72, 0.269, 2.00, 3.6456, 'manual'),  -- USD -> PEN

-- EUR a USD
(2, 1, 1.09, 0.92, 1.50, 1.0736, 'manual'),

-- MXN a USD
(3, 1, 0.0587, 17.05, 1.50, 0.0578, 'manual'),

-- GBP a USD
(4, 1, 1.27, 0.79, 1.50, 1.251, 'manual'),

-- COP a USD
(5, 1, 0.000255, 3925.00, 2.00, 0.0002499, 'manual'),

-- ARS a USD
(6, 1, 0.00114, 875.50, 2.50, 0.001112, 'manual'),

-- BRL a USD
(7, 1, 0.202, 4.95, 2.00, 0.19796, 'manual'),

-- CLP a USD
(8, 1, 0.0011, 905.00, 2.00, 0.001078, 'manual'),

-- PEN a USD
(9, 1, 0.269, 3.72, 2.00, 0.26362, 'manual');

-- Insertar usuario administrador (contraseña: Admin123!)
-- El hash es bcrypt de "Admin123!" con 10 rounds
INSERT INTO users (email, password_hash, first_name, last_name, phone, role_id, is_active, is_verified, email_verified_at) VALUES
('admin@pido.com', '$2b$10$YourHashHere12345678901234567890123456789012345678901234567890', 'Administrador', 'Sistema', '+1234567890', 1, TRUE, TRUE, CURRENT_TIMESTAMP);

-- Insertar billetera principal del administrador
INSERT INTO wallets (user_id, name, is_primary, is_active) VALUES
(1, 'Billetera Principal', TRUE, TRUE);

-- Insertar saldo inicial en USD para el admin
UPDATE wallet_balances SET balance = 10000.00, available_balance = 10000.00 
WHERE wallet_id = 1 AND currency_id = 1;

-- =====================================================
-- VISTAS ÚTILES
-- =====================================================

-- Vista de usuarios con información de rol
CREATE VIEW user_details AS
SELECT 
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    u.phone,
    u.is_active,
    u.is_verified,
    u.created_at,
    u.last_login_at,
    r.name as role_name,
    r.description as role_description
FROM users u
JOIN roles r ON u.role_id = r.id;

-- Vista de billeteras con saldos
CREATE VIEW wallet_details AS
SELECT 
    w.id,
    w.wallet_number,
    w.name,
    w.is_primary,
    w.is_active,
    w.user_id,
    u.email as user_email,
    u.first_name || ' ' || u.last_name as user_full_name,
    wb.currency_id,
    c.code as currency_code,
    c.symbol as currency_symbol,
    wb.balance,
    wb.available_balance,
    wb.held_balance
FROM wallets w
JOIN users u ON w.user_id = u.id
LEFT JOIN wallet_balances wb ON w.id = wb.wallet_id
LEFT JOIN currencies c ON wb.currency_id = c.id;

-- Vista de transacciones con detalles
CREATE VIEW transaction_details AS
SELECT 
    t.id,
    t.transaction_number,
    t.transaction_type,
    t.status,
    t.from_amount,
    t.to_amount,
    t.exchange_rate,
    t.fee_amount,
    t.description,
    t.created_at,
    t.completed_at,
    fw.wallet_number as from_wallet_number,
    tw.wallet_number as to_wallet_number,
    fu.email as from_user_email,
    tu.email as to_user_email,
    fc.code as from_currency_code,
    tc.code as to_currency_code,
    fec.code as fee_currency_code
FROM transactions t
LEFT JOIN wallets fw ON t.from_wallet_id = fw.id
LEFT JOIN wallets tw ON t.to_wallet_id = tw.id
LEFT JOIN users fu ON t.from_user_id = fu.id
LEFT JOIN users tu ON t.to_user_id = tu.id
LEFT JOIN currencies fc ON t.from_currency_id = fc.id
LEFT JOIN currencies tc ON t.to_currency_id = tc.id
LEFT JOIN currencies fec ON t.fee_currency_id = fec.id;

-- Vista de tasas de cambio con nombres de divisas
CREATE VIEW exchange_rate_details AS
SELECT 
    er.id,
    er.rate,
    er.inverse_rate,
    er.spread_percentage,
    er.final_rate,
    er.is_active,
    er.valid_from,
    er.valid_until,
    fc.code as from_currency_code,
    fc.name as from_currency_name,
    fc.symbol as from_currency_symbol,
    tc.code as to_currency_code,
    tc.name as to_currency_name,
    tc.symbol as to_currency_symbol
FROM exchange_rates er
JOIN currencies fc ON er.from_currency_id = fc.id
JOIN currencies tc ON er.to_currency_id = tc.id;

-- =====================================================
-- PERMISOS (Opcional - ajustar según necesidad)
-- =====================================================

-- Crear usuario de aplicación (ejemplo)
-- CREATE USER pido_app WITH PASSWORD 'your_secure_password';
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO pido_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pido_app;

COMMENT ON DATABASE current_database() IS 'PIDO - Digital Wallet & Currency Exchange System Database';
