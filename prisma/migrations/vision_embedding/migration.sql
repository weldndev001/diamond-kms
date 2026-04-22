-- Migration: Add image_embedding support for Vision Embedding (experimental)
-- Adds image_embedding column, chunk_type, and image_source to chunk tables

-- 1. Add image_embedding column to document_chunks
ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS image_embedding vector(768),
  ADD COLUMN IF NOT EXISTS chunk_type TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS image_source TEXT;

-- 2. Add image_embedding column to content_chunks  
ALTER TABLE content_chunks
  ADD COLUMN IF NOT EXISTS image_embedding vector(768),
  ADD COLUMN IF NOT EXISTS chunk_type TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS image_source TEXT;

-- 3. Create HNSW indexes for image_embedding columns (cosine similarity)
CREATE INDEX IF NOT EXISTS idx_doc_chunks_image_embedding
  ON document_chunks
  USING hnsw (image_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_content_chunks_image_embedding
  ON content_chunks
  USING hnsw (image_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 4. Add index on chunk_type for efficient filtering
CREATE INDEX IF NOT EXISTS idx_doc_chunks_type ON document_chunks (chunk_type);
CREATE INDEX IF NOT EXISTS idx_content_chunks_type ON content_chunks (chunk_type);
