import { db } from "@/app/db";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { isBossAdmin } from "@/app/lib/paid-entitlements";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";

type Auth = Readonly<{
  verify: typeof verifyFirebaseIdToken;
  isBoss: typeof isBossAdmin;
}>;
type Migrate = () => Promise<{ state: "applied" | "already_applied" }>;
const auth: Auth = { verify: verifyFirebaseIdToken, isBoss: isBossAdmin };

async function applyBusinessDnaMigration(): Promise<{ state: "applied" | "already_applied" }> {
  return db.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtext('migration:0016:project_business_dna'))`);
    const result = await transaction.execute(sql`select to_regclass('public.project_business_dna')::text as table_name`);
    const existing = result[0] as { table_name?: string | null } | undefined;
    if (existing?.table_name) return { state: "already_applied" };

    await transaction.execute(sql.raw(`CREATE TABLE "project_business_dna" (
      "project_id" text PRIMARY KEY NOT NULL,
      "user_id" text NOT NULL,
      "dna" jsonb DEFAULT '{}'::jsonb NOT NULL,
      "schema_version" integer DEFAULT 1 NOT NULL,
      "confirmed" boolean DEFAULT false NOT NULL,
      "confirmed_at" timestamp with time zone,
      "revision_count" integer DEFAULT 0 NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "project_business_dna_schema_version_check" CHECK ("schema_version" = 1),
      CONSTRAINT "project_business_dna_revision_count_check" CHECK ("revision_count" >= 0),
      CONSTRAINT "project_business_dna_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade,
      CONSTRAINT "project_business_dna_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade
    )`));
    await transaction.execute(sql.raw(`CREATE INDEX "project_business_dna_owner_idx" ON "project_business_dna" ("user_id")`));
    return { state: "applied" };
  });
}

export async function handleBusinessDnaMigration(
  request: Request,
  migrate: Migrate = applyBusinessDnaMigration,
  authentication: Auth = auth,
) {
  try {
    const uid = (await authentication.verify(request)).uid;
    if (!(await authentication.isBoss(uid))) return Response.json({ error: "Not found." }, { status: 404 });
  } catch {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  try {
    return Response.json(await migrate(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "UNKNOWN";
    console.error("Business DNA migration 0016 failed.", { code: code.slice(0, 32) });
    return Response.json({ error: "Migration could not be applied safely." }, { status: 409 });
  }
}

export async function POST(request: Request) {
  return handleBusinessDnaMigration(request);
}
