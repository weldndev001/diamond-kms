-- Sprint 2: AI Integration — Database Migration
-- Jalankan di Database Management Client / SQL Editor
-- PENTING: Jalankan SEBELUM prisma generate

-- 1. Ubah dimensi embedding dari 1536 ke 768
--    Tidak bisa ALTER COLUMN untuk vector — harus drop + add
ALTER TABLE document_chunks
  DROP COLUMN IF EXISTS embedding,
  ADD  COLUMN embedding vector(768);

-- 2. Tambah kolom baru di document_chunks
ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS page_end    INTEGER,
  ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3. Tambah kolom baru di documents
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS embedding_model    TEXT,
  ADD COLUMN IF NOT EXISTS embedding_version  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_error   TEXT;

-- 4. Buat HNSW index untuk similarity search (pgvector 0.5+)
CREATE INDEX IF NOT EXISTS idx_doc_chunks_embedding
  ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 5. Verifikasi hasilnya
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'document_chunks'
ORDER BY ordinal_position;
