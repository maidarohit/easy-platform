import { NextResponse } from "next/server";
import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/app/db";
import { projectProducts, projects } from "@/app/db/schema";
import { verifyFirebaseIdTokenAllowUnverified } from "@/app/lib/firebase-admin";

async function getAuthenticatedUserId(request: Request) {
  try {
    const token = await verifyFirebaseIdTokenAllowUnverified(request);
    return token.uid;
  } catch {
    return null;
  }
}

async function ownsProject(projectId: string, userId: string) {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  return Boolean(project);
}

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId(request);

  if (!userId) {
    return NextResponse.json(
      { error: "Authentication is required." },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId")?.trim() ?? "";

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required." },
      { status: 400 },
    );
  }

  if (!(await ownsProject(projectId, userId))) {
    return NextResponse.json(
      { error: "Project not found." },
      { status: 404 },
    );
  }

  const products = await db
    .select()
    .from(projectProducts)
    .where(
      and(
        eq(projectProducts.projectId, projectId),
        eq(projectProducts.userId, userId),
      ),
    )
    .orderBy(
      asc(projectProducts.sortOrder),
      desc(projectProducts.createdAt),
    );

  return NextResponse.json({ products });
}

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId(request);

  if (!userId) {
    return NextResponse.json(
      { error: "Authentication is required." },
      { status: 401 },
    );
  }

  let body: {
    projectId?: unknown;
    name?: unknown;
    description?: unknown;
    category?: unknown;
    kind?: unknown;
    price?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const projectId =
    typeof body.projectId === "string" ? body.projectId.trim() : "";

  const name =
    typeof body.name === "string" ? body.name.trim() : "";

  const description =
    typeof body.description === "string"
      ? body.description.trim()
      : "";

  const category =
    typeof body.category === "string"
      ? body.category.trim()
      : "";

  const kind =
    body.kind === "service" ? "service" : "product";

  const price =
    typeof body.price === "number"
      ? body.price
      : typeof body.price === "string"
        ? Number(body.price)
        : Number.NaN;

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required." },
      { status: 400 },
    );
  }

  if (!name || name.length > 160) {
    return NextResponse.json(
      { error: "A valid product or service name is required." },
      { status: 400 },
    );
  }

  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json(
      { error: "A valid price is required." },
      { status: 400 },
    );
  }

  const pricePaise = Math.round(price * 100);

  if (!Number.isSafeInteger(pricePaise)) {
    return NextResponse.json(
      { error: "Price is too large." },
      { status: 400 },
    );
  }

  if (!(await ownsProject(projectId, userId))) {
    return NextResponse.json(
      { error: "Project not found." },
      { status: 404 },
    );
  }

  const [product] = await db
    .insert(projectProducts)
    .values({
      projectId,
      userId,
      name,
      description: description || null,
      category: category || null,
      kind,
      pricePaise,
      currency: "INR",
      isActive: true,
    })
    .returning();

  return NextResponse.json(
    { product },
    { status: 201 },
  );
}