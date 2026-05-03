-- =============================================================================
-- Diamond KMS - Database Initialization Script
-- =============================================================================
-- Script ini dijalankan otomatis saat container PostgreSQL pertama kali dibuat.
-- Mengaktifkan ekstensi yang dibutuhkan oleh Diamond KMS.
-- =============================================================================

-- Ekstensi UUID (untuk auto-generate ID)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ekstensi pgvector (untuk AI Embeddings / Pencarian Semantik)
CREATE EXTENSION IF NOT EXISTS "vector";
