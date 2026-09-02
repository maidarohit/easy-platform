ALTER TABLE "projects"
  ADD COLUMN "primary_language" varchar(2) NOT NULL DEFAULT 'en';

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_primary_language_check"
  CHECK ("primary_language" IN ('en', 'es', 'fr', 'de', 'pt', 'ar', 'hi', 'ja', 'ko', 'zh', 'kn', 'ta', 'te', 'ml'));
