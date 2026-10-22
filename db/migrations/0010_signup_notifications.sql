-- Sign-up notifications: each new account emails the team once.
-- Existing accounts are stamped now() so only sign-ups after this migration send a notice;
-- the default is then dropped so new accounts start NULL.
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_notified_at timestamptz DEFAULT now();
ALTER TABLE users ALTER COLUMN signup_notified_at DROP DEFAULT;
