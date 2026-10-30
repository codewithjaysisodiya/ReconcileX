-- ===================================================================
-- ReconcileX - Enterprise Financial Reconciliation Database Schema
-- Database Engine: MySQL 8.0+
-- Character Set: utf8mb4 / Collation: utf8mb4_unicode_ci
-- ===================================================================

CREATE DATABASE IF NOT EXISTS reconcilex_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE reconcilex_db;

-- -------------------------------------------------------------------
-- 1. Table: users
-- Stores registered financial analysts, auditors, and administrators
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(64) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role ENUM('ADMIN', 'SENIOR_AUDITOR', 'FINANCIAL_ANALYST') DEFAULT 'FINANCIAL_ANALYST',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    status ENUM('ACTIVE', 'SUSPENDED') DEFAULT 'ACTIVE',
    INDEX idx_user_email (email),
    INDEX idx_user_username (username)
) ENGINE=InnoDB;

-- -------------------------------------------------------------------
-- 2. Table: reconciliation_sessions
-- Represents a completed reconciliation execution batch
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reconciliation_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_code VARCHAR(50) NOT NULL UNIQUE,
    user_id INT NULL,
    bank_file_name VARCHAR(255) NOT NULL,
    company_file_name VARCHAR(255) NOT NULL,
    bank_records_count INT NOT NULL DEFAULT 0,
    company_records_count INT NOT NULL DEFAULT 0,
    total_processed INT NOT NULL DEFAULT 0,
    matched_count INT NOT NULL DEFAULT 0,
    unmatched_count INT NOT NULL DEFAULT 0,
    mismatch_count INT NOT NULL DEFAULT 0,
    duplicate_count INT NOT NULL DEFAULT 0,
    match_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    total_discrepancy DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    net_variance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    amount_tolerance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    date_tolerance_days INT NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_session_user (user_id),
    INDEX idx_session_date (created_at)
) ENGINE=InnoDB;

-- -------------------------------------------------------------------
-- 3. Table: reconciled_transactions
-- Itemized transaction reconciliation audit records
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reconciled_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    transaction_id VARCHAR(100) NOT NULL,
    occurrence_index INT NOT NULL DEFAULT 1,
    bank_amount DECIMAL(15,2) NULL,
    company_amount DECIMAL(15,2) NULL,
    difference DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    bank_date DATE NULL,
    company_date DATE NULL,
    date_difference_days INT NULL,
    status VARCHAR(50) NOT NULL,
    bank_description VARCHAR(500) NULL,
    company_description VARCHAR(500) NULL,
    bank_reference VARCHAR(100) NULL,
    company_reference VARCHAR(100) NULL,
    audit_notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES reconciliation_sessions(id) ON DELETE CASCADE,
    INDEX idx_txn_id (transaction_id),
    INDEX idx_txn_status (status),
    INDEX idx_txn_session (session_id)
) ENGINE=InnoDB;

-- -------------------------------------------------------------------
-- 4. Table: audit_logs
-- Immutable compliance trail for actions, approvals, and report exports
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NULL,
    user_id INT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT NULL,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES reconciliation_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_time (created_at)
) ENGINE=InnoDB;

-- -------------------------------------------------------------------
-- SEED DATA: Administrator & Demonstration Users
-- Password for demo admin is: Admin@1234
-- SHA-256 (Admin@1234 + salt 'rx_salt_default_2026')
-- ===================================================================
INSERT INTO users (username, email, password_hash, salt, full_name, role)
VALUES (
    'admin',
    'admin@reconcilex.internal',
    'a73d2a02b1f8eb4f46995ce50875b28d6c7b94ad1cfd33d712e5c8e317bbad32',
    'rx_salt_default_2026',
    'ReconcileX Lead Administrator',
    'ADMIN'
) ON DUPLICATE KEY UPDATE id=id;

INSERT INTO users (username, email, password_hash, salt, full_name, role)
VALUES (
    'analyst',
    'analyst@reconcilex.internal',
    'a73d2a02b1f8eb4f46995ce50875b28d6c7b94ad1cfd33d712e5c8e317bbad32',
    'rx_salt_default_2026',
    'Senior Financial Analyst',
    'FINANCIAL_ANALYST'
) ON DUPLICATE KEY UPDATE id=id;
