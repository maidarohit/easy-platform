const WEBSITE_AI_WEBHOOK =
  "https://rohitm2026.app.n8n.cloud/webhook/c5d5e244-e62c-4634-b353-0175b9793c32";

export async function POST(request: Request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const body: unknown = await request.json();
    const upstream = await fetch(WEBSITE_AI_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
    const responseText = await upstream.text();

    if (!upstream.ok) {
      return new Response(responseText || "Website AI request failed.", {
        status: upstream.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!responseText) {
      return Response.json(
        { error: "Website AI returned an empty response." },
        { status: 502 }
      );
    }

    return new Response(responseText, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Website AI API error:", error);
    return Response.json({ error: "Website AI failed." }, { status: 500 });
  } finally {
    clearTimeout(timeout);
  }
}
