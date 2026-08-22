import {
  completePublicAiUsage,
  failPublicAiUsage,
  reservePublicBusinessIdeaUsage,
} from "../../lib/public-ai-usage";

const MAX_REQUEST_BODY_BYTES = 8 * 1024;
const PROVIDER_TIMEOUT_MS = 30_000;

const FIELD_LIMITS = {
  interests: 500,
  budget: 200,
  businessType: 200,
  workStyle: 200,
  skills: 500,
  speed: 200,
} as const;

type BusinessIdeasInput = {
  -readonly [Field in keyof typeof FIELD_LIMITS]: string;
};

class RequestBodyTooLargeError extends Error {}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null);

export function validateBusinessIdeasInput(
  value: unknown
): BusinessIdeasInput | null {
  if (!isPlainObject(value)) return null;

  const expectedFields = Object.keys(FIELD_LIMITS) as Array<
    keyof typeof FIELD_LIMITS
  >;

  if (
    Object.keys(value).length !== expectedFields.length ||
    Object.keys(value).some((field) => !(field in FIELD_LIMITS))
  ) {
    return null;
  }

  const input = {} as BusinessIdeasInput;

  for (const field of expectedFields) {
    const fieldValue = value[field];
    if (typeof fieldValue !== "string") return null;

    const trimmed = fieldValue.trim();
    if (trimmed.length > FIELD_LIMITS[field]) return null;
    input[field] = trimmed;
  }

  return input;
}

async function readLimitedJson(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("content-length")?.trim();

  if (contentLength && /^\d+$/.test(contentLength)) {
    if (Number(contentLength) > MAX_REQUEST_BODY_BYTES) {
      throw new RequestBodyTooLargeError();
    }
  }

  if (!request.body) return null;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > MAX_REQUEST_BODY_BYTES) {
      await reader.cancel();
      throw new RequestBodyTooLargeError();
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

export async function POST(req: Request) {
  let usageId: string | null = null;
  let startedAt = 0;

  const safeFailUsage = async () => {
    if (!usageId || startedAt === 0) return;

    try {
      await failPublicAiUsage({
        usageId,
        durationMs: Date.now() - startedAt,
      });
    } catch {
      console.error("Business Idea usage failure finalization failed.");
    }
  };

  try {
    let parsedBody: unknown;

    try {
      parsedBody = await readLimitedJson(req);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return Response.json({ error: "Request body is too large." }, { status: 413 });
      }

      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    const input = validateBusinessIdeasInput(parsedBody);
    if (!input) {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    const { interests, budget, businessType, workStyle, skills, speed } = input;

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "OpenAI API key is not configured." },
        { status: 500 }
      );
    }

    /*
     * Check the anonymous visitor/IP limits and reserve exactly
     * one usage row BEFORE any paid OpenAI request is made.
     */
    const reservation =
      await reservePublicBusinessIdeaUsage(req);

    if (!reservation.allowed) {
      return Response.json(
        {
          error:
            "The free Business Idea generation limit has been reached. Create your Buzypeezy account to continue.",
          code: "PUBLIC_AI_LIMIT_REACHED",
        },
        { status: 429 }
      );
    }

    usageId = reservation.usageId;

    /*
     * Customer-facing AI duration begins immediately before
     * the actual paid OpenAI request.
     */
    startedAt = Date.now();

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-5-mini",

          reasoning: {
            effort: "low",
          },

          input: `
You are the Business Idea Finder inside Buzypeezy.

Your job is to help a beginner who may know NOTHING about business.

Never assume the customer already understands business terminology.

Use the customer's answers below:

Interests:
${interests || "Not provided"}

Available investment:
${budget}

Preferred business type:
${businessType}

Preferred work style:
${workStyle}

Existing skills:
${skills || "Not provided"}

How quickly they want to start:
${speed}

Generate EXACTLY 3 realistic business ideas that fit this person.

Important rules:

- Keep the ideas practical.
- Do not promise guaranteed income.
- Do not give unrealistic revenue claims.
- Prefer ideas that match the customer's available investment.
- If the customer says "Not sure", do not treat that as a real preference.
- Explain things in beginner-friendly language.
- Make the 3 ideas meaningfully different.
- The customer should understand how each business actually makes money.
- The first steps must be simple and actionable.
`,

          text: {
            format: {
              type: "json_schema",
              name: "business_idea_results",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["ideas"],
                properties: {
                  ideas: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: [
                        "title",
                        "whyItFits",
                        "businessModel",
                        "startupLevel",
                        "difficulty",
                        "mode",
                        "targetCustomer",
                        "firstSteps",
                      ],
                      properties: {
                        title: {
                          type: "string",
                        },
                        whyItFits: {
                          type: "string",
                        },
                        businessModel: {
                          type: "string",
                        },
                        startupLevel: {
                          type: "string",
                        },
                        difficulty: {
                          type: "string",
                        },
                        mode: {
                          type: "string",
                        },
                        targetCustomer: {
                          type: "string",
                        },
                        firstSteps: {
                          type: "array",
                          items: {
                            type: "string",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },

          max_output_tokens: 1800,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      await response.body?.cancel();
      console.error("Business Idea AI request failed.");

      await safeFailUsage();

      return Response.json(
        {
          error: "Could not generate business ideas.",
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    let outputText = "";

    for (const item of data.output || []) {
      for (const content of item.content || []) {
        if (
          content.type === "output_text" &&
          content.text
        ) {
          outputText += content.text;
        }
      }
    }

    if (!outputText) {
      await safeFailUsage();

      return Response.json(
        {
          error: "AI returned no business ideas.",
        },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(outputText);

    const ideas = Array.isArray(parsed.ideas)
      ? parsed.ideas.slice(0, 3)
      : [];

    if (ideas.length === 0) {
      await safeFailUsage();

      return Response.json(
        {
          error: "AI returned no business ideas.",
        },
        { status: 500 }
      );
    }

    /*
     * Complete the SAME anonymous usage row.
     *
     * If final ledger updating ever fails after OpenAI has
     * successfully generated the ideas, do not throw away the
     * customer's valid result. This also avoids encouraging a
     * second paid request just because accounting finalization
     * encountered a database problem.
     */
    try {
      await completePublicAiUsage({
        usageId,
        durationMs: Date.now() - startedAt,
        inputTokens:
          typeof data.usage?.input_tokens === "number"
            ? data.usage.input_tokens
            : null,
        outputTokens:
          typeof data.usage?.output_tokens === "number"
            ? data.usage.output_tokens
            : null,
        model:
          typeof data.model === "string"
            ? data.model
            : "gpt-5-mini",
      });
    } catch {
      console.error("Business Idea usage completion failed.");
    }

    return Response.json({
      ideas,
    });
  } catch {
    console.error("Business Idea Finder request failed.");

    await safeFailUsage();

    return Response.json(
      {
        error: "Business Idea Finder failed.",
      },
      { status: 500 }
    );
  }
}
