CREATE TABLE IF NOT EXISTS website_page_views (
  event_id uuid PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  publication_kind varchar(16) NOT NULL CHECK (publication_kind IN ('business', 'website')),
  publication_id uuid NOT NULL,
  page_path varchar(256) NOT NULL,
  visitor_id uuid NOT NULL,
  session_id uuid NOT NULL,
  referrer_origin varchar(255),
  utm_source varchar(64),
  utm_medium varchar(64),
  utm_campaign varchar(64),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS website_page_views_project_time_idx ON website_page_views(project_id, created_at);
CREATE INDEX IF NOT EXISTS website_page_views_project_visitor_time_idx ON website_page_views(project_id, publication_kind, publication_id, visitor_id, created_at);
CREATE INDEX IF NOT EXISTS website_page_views_publication_time_idx ON website_page_views(publication_kind, publication_id, created_at);
CREATE INDEX IF NOT EXISTS website_page_views_session_time_idx ON website_page_views(publication_id, session_id, created_at);
