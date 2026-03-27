-- Migration: Add Branding Columns to Organizations
-- Run this in your SQL Editor if you encounter P2022 error during build

ALTER TABLE "organizations" 
ADD COLUMN IF NOT EXISTS "app_name" TEXT NOT NULL DEFAULT 'DIAMOND KMS',
ADD COLUMN IF NOT EXISTS "slogan" TEXT NOT NULL DEFAULT 'AI Powered Knowledge Management System',
ADD COLUMN IF NOT EXISTS "logo_url" TEXT,
ADD COLUMN IF NOT EXISTS "system_language" TEXT NOT NULL DEFAULT 'en-US';
