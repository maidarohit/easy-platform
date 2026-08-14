export async function POST(req: Request) {
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

    const response = await fetch("https://api.openai.com/v1/responses", {
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
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error("Business Idea AI error:", errorText);

      return Response.json(
        { error: "Could not generate business ideas." },
        { status: response.status }
      );
    }

    const data = await response.json();

    let outputText = "";

    for (const item of data.output || []) {
      for (const content of item.content || []) {
        if (content.type === "output_text" && content.text) {
          outputText += content.text;
        }
      }
    }

    if (!outputText) {
      return Response.json(
        { error: "AI returned no business ideas." },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(outputText);

    return Response.json({
      ideas: Array.isArray(parsed.ideas) ? parsed.ideas.slice(0, 3) : [],
    });
  } catch (error) {
    console.error("Business Idea Finder error:", error);

    return Response.json(
      { error: "Business Idea Finder failed." },
      { status: 500 }
    );
  }
}