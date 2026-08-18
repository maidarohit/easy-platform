import {
  completePublicAiUsage,
  failPublicAiUsage,
  reservePublicBusinessIdeaUsage,
} from "../../lib/public-ai-usage";

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
    } catch (trackingError) {
      console.error(
        "Business Idea usage failure finalization error:",
        trackingError
      );
    }
  };

  try {
    const body = await req.json();

    const {
      interests = "",
      budget = "Not sure",
      businessType = "Not sure",
      workStyle = "Not sure",
      skills = "",
      speed = "Not sure",
    } = body;

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
            "You have reached today's free business idea generation limit. Create your Easy Platform account to continue.",
          code: "PUBLIC_AI_LIMIT_REACHED",
          limit: reservation.limit,
          remaining: 0,
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
You are the Business Idea Finder inside Easy Platform.

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
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "Business Idea AI error:",
        errorText
      );

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
    } catch (trackingError) {
      console.error(
        "Business Idea usage completion error:",
        trackingError
      );
    }

    return Response.json({
      ideas,
    });
  } catch (error) {
    console.error(
      "Business Idea Finder error:",
      error
    );

    await safeFailUsage();

    return Response.json(
      {
        error: "Business Idea Finder failed.",
      },
      { status: 500 }
    );
  }
}