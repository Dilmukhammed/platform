-- Password reset tokens table for serverless-safe token management.
-- Replaces the in-memory Map in src/lib/auth/reset-tokens.ts.

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast token lookup by hash
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash
    ON public.password_reset_tokens(token_hash);

-- Index for cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at
    ON public.password_reset_tokens(expires_at)
    WHERE used_at IS NULL;

-- Prevent duplicate active tokens for the same email
CREATE UNIQUE INDEX IF NOT EXISTS uq_password_reset_tokens_active_email
    ON public.password_reset_tokens(email)
    WHERE used_at IS NULL;

-- RLS: table is only accessed server-side via service role key (bypasses RLS).
-- No direct client access allowed.
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all direct access — server-side only"
    ON public.password_reset_tokens
    FOR ALL
    USING (false);
