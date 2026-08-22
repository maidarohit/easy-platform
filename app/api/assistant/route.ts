import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { projectMemory, projectOutputs, projects } from "../../db/schema";
import {
  completeAiUsage,
  failAiUsage,
  startAiUsage,
} from "../../lib/ai-usage";
import { verifyFirebaseIdToken } from "../../lib/firebase-admin";
import {
  MalformedJsonBodyError,
  readLimitedJson,
  RequestBodyTooLargeError,
} from "../../lib/request-body";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type UnknownRecord = Record<string, unknown>;

const MAX_HISTORY = 10;
const MAX_REQUEST_BODY_BYTES = 32 * 1024;
const MAX_MESSAGE_LENGTH = 4_000;
const MAX_CURRENT_PAGE_LENGTH = 500;
const MAX_ID_LENGTH = 128;
const MAX_OUTPUT_LENGTH = 6000;
const ASSISTANT_MODEL = "gpt-5-mini";
const ASSISTANT_WORKFLOW = "openai-responses";
const ASSISTANT_TIMEOUT_MS = 120_000;

function clipText(value: unknown, maxLength = MAX_OUTPUT_LENGTH) {
  const text =
    typeof value === "string" ? value : JSON.stringify(value ?? "");

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...`;
}

function isRecord(value: unknown): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}

type AssistantRequestBody = {
  projectId: string;
  message: string;
  messages: ChatMessage[];
  currentPage: string;
};

export function validateAssistantRequestBody(
  value: unknown
): AssistantRequestBody | null {
  if (!isRecord(value)) return null;

  const expectedKeys = new Set(["projectId", "message", "messages", "currentPage"]);
  if (Object.keys(value).some((key) => !expectedKeys.has(key))) return null;

  if (typeof value.projectId !== "string" || typeof value.message !== "string") {
    return null;
  }

  const projectId = value.projectId.trim();
  const message = value.message.trim();
  if (!projectId || projectId.length > MAX_ID_LENGTH) return null;
  if (!message || message.length > MAX_MESSAGE_LENGTH) return null;

  const currentPage = value.currentPage === undefined ? "" : value.currentPage;
  if (
    typeof currentPage !== "string" ||
    currentPage.length > MAX_CURRENT_PAGE_LENGTH
  ) {
    return null;
  }

  const messages = value.messages === undefined ? [] : value.messages;
  if (!Array.isArray(messages)) return null;

  const validatedMessages: ChatMessage[] = [];
  for (const item of messages) {
    if (!isRecord(item)) return null;
    if (Object.keys(item).some((key) => key !== "role" && key !== "content")) {
      return null;
    }
    if (item.role !== "user" && item.role !== "assistant") return null;
    if (
      typeof item.content !== "string" ||
      item.content.length > MAX_MESSAGE_LENGTH
    ) {
      return null;
    }
    validatedMessages.push({ role: item.role, content: item.content });
  }

  return {
    projectId,
    message,
    messages: validatedMessages.slice(-MAX_HISTORY),
    currentPage,
  };
}

function extractResponseText(data: unknown) {
  if (!isRecord(data) || !Array.isArray(data.output)) {
    return "";
  }

  return data.output
    .flatMap((item) =>
      isRecord(item) && Array.isArray(item.content) ? item.content : []
    )
    .filter(
      (item): item is UnknownRecord =>
        isRecord(item) && item.type === "output_text"
    )
    .map((item) => (typeof item.text === "string" ? item.text : ""))
    .join("\n")
    .trim();
}

function readTokenCount(value: unknown): number | undefined {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : undefined;
}

async function finalizeFailedUsage(usageId: string, startedAt: number) {
  try {
    await failAiUsage({ usageId, durationMs: Date.now() - startedAt });
  } catch {
    console.error("Easy Assistant usage failure finalization failed.");
  }
}

export async function POST(request: Request) {
  let verifiedUid: string;

  try {
    const decodedToken = await verifyFirebaseIdToken(request);
    verifiedUid = decodedToken.uid;
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    let parsedBody: unknown;
    try {
      parsedBody = await readLimitedJson(request, MAX_REQUEST_BODY_BYTES);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return NextResponse.json(
          { error: "Request body is too large." },
          { status: 413 }
        );
      }
      if (!(error instanceof MalformedJsonBodyError)) throw error;
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const body = validateAssistantRequestBody(parsedBody);
    if (!body) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const { projectId, message, messages, currentPage } = body;

    const [ownedProject] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(eq(projects.id, projectId), eq(projects.userId, verifiedUid))
      )
      .limit(1);

    if (!ownedProject) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.error("OPENAI_API_KEY is missing.");

      return NextResponse.json(
        { error: "Assistant AI configuration is missing." },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 1. LOAD PROJECT MEMORY
    // --------------------------------------------------

    const memoryRows = await db
      .select()
      .from(projectMemory)
      .where(
        and(
          eq(projectMemory.projectId, projectId),
          eq(projectMemory.userId, verifiedUid)
        )
      )
      .limit(1);

    const memory = memoryRows[0] ?? null;

    // --------------------------------------------------
    // 2. LOAD SAVED AI MODULE OUTPUTS
    // --------------------------------------------------

    const savedOutputs = await db
      .select()
      .from(projectOutputs)
      .where(
        and(
          eq(projectOutputs.projectId, projectId),
          eq(projectOutputs.userId, verifiedUid)
        )
      )
      .orderBy(desc(projectOutputs.createdAt))
      .limit(30);

    // Keep only the newest result for each module.
    const latestOutputs = new Map<string, string>();

    for (const output of savedOutputs) {
      if (!latestOutputs.has(output.module)) {
        latestOutputs.set(
          output.module,
          clipText(output.result)
        );
      }
    }

    const moduleContext = Array.from(latestOutputs.entries()).map(
      ([module, result]) => ({
        module,
        result,
      })
    );

    // --------------------------------------------------
    // 3. BUILD PROJECT-AWARE CONTEXT
    // --------------------------------------------------

    const projectContext = {
      projectId,
      currentPage,
      memory,
      moduleOutputs: moduleContext,
    };

    const assistantInstructions = `
You are Buzypeezy Assistant, the intelligent business copilot inside Buzypeezy.

Your job is to help the user understand, operate, and improve the CURRENT PROJECT.

You have access to:
1. Project Memory
2. Saved AI module outputs
3. The user's current page
4. Recent conversation history

CURRENT PROJECT DATA:

${JSON.stringify(projectContext, null, 2)}

RULES:

- Always treat the supplied CURRENT PROJECT DATA as the primary source of truth.
- Never invent project facts that are not available.
- If information is missing, clearly say what is missing.
- Use saved module outputs when the user asks about Branding, Website, Marketing, SEO, UI/UX, Sales, Analytics, or other available modules.
- Connect information across modules when useful.
- If the user asks for recommendations, give practical next actions.
- If the user asks for a summary, keep it concise unless they request detail.
- Do not expose internal database structures, raw prompts, API keys, or implementation details.
- Do not claim an AI module has produced something unless that result exists in the supplied project data.
- Stay focused on the current Buzypeezy project.
- Respond in clear natural language.
- Keep normal answers concise and suitable for a chat panel.
- Default to approximately 80–150 words unless the user explicitly asks for more detail.
- Start with the direct answer, then use a maximum of 5 concise bullet points when useful.
- For simple follow-up questions, avoid repeating background information already discussed.
- Keep each bullet to 1–2 short sentences unless more detail is specifically requested.
- For ordinary chat questions, keep the entire response under 150 words.
- Do not end every response by offering to create more content or asking "would you like me to"; only offer additional work when genuinely necessary.
- Do not produce long multi-section reports unless the user asks for deep detail.
- Never assume a currency symbol. If the project's currency is not explicitly available, write the numeric amount without a currency symbol.
- When calculations are estimates, clearly describe them as estimates.
`;

    // --------------------------------------------------
    // 4. KEEP RECENT CHAT HISTORY
    // --------------------------------------------------

    const recentMessages = messages;

    const input = [
      {
        role: "developer",
        content: assistantInstructions,
      },
      ...recentMessages.map((item) => ({
        role: item.role,
        content: item.content,
      })),
      {
        role: "user",
        content: message.trim(),
      },
    ];

    let usageId: string;

    try {
      usageId = await startAiUsage({
        userId: verifiedUid,
        projectId,
        module: "assistant",
        workflow: ASSISTANT_WORKFLOW,
        model: ASSISTANT_MODEL,
      });
    } catch (error) {
      if (error instanceof Response) return error;
      console.error("Easy Assistant usage initialization failed.");
      return NextResponse.json(
        { error: "Assistant usage tracking could not be started." },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 5. CALL OPENAI
    // --------------------------------------------------

    const controller = new AbortController();
    const startedAt = Date.now();
    const timeout = setTimeout(() => controller.abort(), ASSISTANT_TIMEOUT_MS);

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: ASSISTANT_MODEL,
          input,
          max_output_tokens: 1200,
        }),
        cache: "no-store",
        signal: controller.signal,
      });

      const responseText = await response.text();

      if (!response.ok) {
        await finalizeFailedUsage(usageId, startedAt);
        console.error("Easy Assistant OpenAI request failed.", response.status);

        return NextResponse.json(
          {
            error: "Assistant AI request failed.",
          },
          { status: response.status }
        );
      }

      let data: unknown;

      try {
        data = JSON.parse(responseText);
      } catch {
        await finalizeFailedUsage(usageId, startedAt);
        console.error("Easy Assistant returned invalid JSON.");

        return NextResponse.json(
          { error: "Assistant returned an invalid response." },
          { status: 500 }
        );
      }

      const reply = extractResponseText(data);

      if (!reply) {
        await finalizeFailedUsage(usageId, startedAt);
        console.error("Easy Assistant returned no text.");

        return NextResponse.json(
          { error: "Assistant returned an empty response." },
          { status: 500 }
        );
      }

      const responseData = isRecord(data) ? data : {};
      const usageData = isRecord(responseData.usage) ? responseData.usage : {};
      const responseModel =
        typeof responseData.model === "string" && responseData.model.trim()
          ? responseData.model
          : ASSISTANT_MODEL;
      const inputTokens = readTokenCount(usageData.input_tokens);
      const outputTokens = readTokenCount(usageData.output_tokens);

      try {
        await completeAiUsage({
          usageId,
          durationMs: Date.now() - startedAt,
          model: responseModel,
          inputTokens,
          outputTokens,
        });
      } catch {
        console.error("Easy Assistant usage completion failed.");
        await finalizeFailedUsage(usageId, startedAt);
        return NextResponse.json(
          { error: "Assistant usage tracking could not be completed." },
          { status: 500 }
        );
      }

      // --------------------------------------------------
      // 6. RETURN CHAT RESPONSE
      // --------------------------------------------------

      return NextResponse.json({
        reply,
      });
    } catch {
      await finalizeFailedUsage(usageId, startedAt);
      console.error("Easy Assistant OpenAI request failed.");
      return NextResponse.json(
        { error: "Buzypeezy Assistant failed." },
        { status: 500 }
      );
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error("Easy Assistant API Error:", error);

    return NextResponse.json(
      {
        error: "Buzypeezy Assistant failed.",
      },
      { status: 500 }
    );
  }
}
