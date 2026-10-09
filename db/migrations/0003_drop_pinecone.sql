-- Vectors live in Neon pgvector (description_embedding / vibe_embedding); Pinecone is not used.
ALTER TABLE venues DROP COLUMN IF EXISTS pinecone_id;
ALTER TABLE vendors DROP COLUMN IF EXISTS pinecone_id;
