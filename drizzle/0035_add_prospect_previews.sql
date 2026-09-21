CREATE TABLE IF NOT EXISTS prospect_previews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key varchar(128) NOT NULL,
  payload_hash varchar(64) NOT NULL,
  status varchar(16) NOT NULL CONSTRAINT prospect_previews_status_check CHECK (status IN ('processing', 'ready', 'failed')),
  project_id text NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  output_id uuid REFERENCES project_outputs(id) ON DELETE RESTRICT,
  usage_id uuid NOT NULL REFERENCES ai_usage(id) ON DELETE RESTRICT,
  token_hash varchar(64),
  expires_at timestamptz,
  revoked_at timestamptz,
  lease_expires_at timestamptz NOT NULL,
  error_category varchar(40),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS prospect_previews_idempotency_unique ON prospect_previews(idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS prospect_previews_token_unique ON prospect_previews(token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS prospect_previews_project_unique ON prospect_previews(project_id);
CREATE INDEX IF NOT EXISTS prospect_previews_created_idx ON prospect_previews(created_at);

CREATE TABLE IF NOT EXISTS prospect_preview_rate_limits (
  key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  count integer NOT NULL
);
