-- Add API key hash and description to agents table
-- For Moltbook-style simple registration

ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "api_key_hash" text;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "description" text;
