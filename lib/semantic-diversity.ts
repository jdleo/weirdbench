const DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-large";
const RUN_COUNT = 3;
const WORD_COUNT = 20;
const MAX_GENERATION_ATTEMPTS = 5;

const providerOverrides: Record<
  string,
  {
    only?: string[];
    order?: string[];
    allowFallbacks?: boolean;
  }
> = {
  "minimax/minimax-m2.5": {
    allowFallbacks: false,
  },
};

type OpenRouterChatResponse = {
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | Array<{
        type?: string;
        text?: string;
      }>;
      reasoning?: string | Array<unknown>;
      reasoning_details?: Array<unknown>;
    };
  }>;
  provider?: string;
  model?: string;
};

type OpenRouterEmbeddingResponse = {
  data?: Array<{
    embedding?: number[];
  }>;
};

type OpenRouterContentPart = {
  type?: string;
  text?: string;
};

type OpenRouterMessageContent = string | OpenRouterContentPart[] | undefined;

export type SemanticDiversityRun = {
  words: string[];
  score: number;
};

export async function runSemanticDiversityBenchmark(
  modelId: string,
): Promise<{
  modelId: string;
  averageScore: number;
  runs: SemanticDiversityRun[];
  prompt: string;
  embeddingModel: string;
}> {
  const runs: SemanticDiversityRun[] = [];
  const prompt = getSemanticDiversityPrompt();

  for (let index = 0; index < RUN_COUNT; index += 1) {
    const words = await generateSemanticDiversityWords(modelId, prompt);
    const score = await scoreWordList(words);
    runs.push({ words, score });
  }

  const averageScore =
    runs.reduce((total, run) => total + run.score, 0) / runs.length;

  return {
    modelId,
    averageScore,
    runs,
    prompt,
    embeddingModel: process.env.OPENROUTER_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL,
  };
}

export function getSemanticDiversityPrompt(): string {
  return [
    `Generate exactly ${WORD_COUNT} English words that are maximally semantically unrelated to each other.`,
    "Return only a JSON array of lowercase single words.",
    "No phrases, no punctuation outside JSON, no explanations.",
  ].join(" ");
}

async function generateSemanticDiversityWords(
  modelId: string,
  prompt: string,
): Promise<string[]> {
  let bestWords: string[] = [];

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: getOpenRouterHeaders(),
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: "user",
            content:
              attempt === 1
                ? prompt
                : buildRepairPrompt(bestWords),
          },
        ],
        temperature: 0.1,
        reasoning: {
          exclude: true,
        },
        response_format: {
          type: "json_object",
        },
        provider: {
          require_parameters: true,
          ...providerOverrides[modelId],
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `OpenRouter chat request failed: ${response.status} ${await response.text()}`,
      );
    }

    const data = (await response.json()) as OpenRouterChatResponse;
    const choice = data.choices?.[0];
    const message = choice?.message;
    const content = extractTextContent(message?.content);

    if (!content) {
      logChatAttemptFailure({
        modelId,
        attempt,
        reason: "missing_content",
        finishReason: choice?.finish_reason,
        provider: data.provider,
        contentType: describeContentShape(message?.content),
        hasReasoning: Boolean(message?.reasoning),
        hasReasoningDetails: Boolean(message?.reasoning_details?.length),
      });
      continue;
    }

    const words = normalizeWordList(content);

    if (words.length === 0) {
      logChatAttemptFailure({
        modelId,
        attempt,
        reason: "unparseable_content",
        finishReason: choice?.finish_reason,
        provider: data.provider,
        contentType: describeContentShape(message?.content),
        hasReasoning: Boolean(message?.reasoning),
        hasReasoningDetails: Boolean(message?.reasoning_details?.length),
        rawPreview: content.slice(0, 240),
      });
      continue;
    }

    if (attempt === 1) {
      bestWords = words.slice(0, WORD_COUNT);
    } else {
      bestWords = mergeUniqueWords(bestWords, words).slice(0, WORD_COUNT);
    }

    if (bestWords.length === WORD_COUNT) {
      return bestWords;
    }
  }

  throw new Error(
    `Failed to generate exactly ${WORD_COUNT} words after ${MAX_GENERATION_ATTEMPTS} attempts.`,
  );
}

function buildRepairPrompt(existingWords: string[]): string {
  const missingCount = WORD_COUNT - existingWords.length;

  return [
    `You already produced these valid words: ${existingWords.join(", ")}.`,
    `Return exactly ${missingCount} additional unique lowercase single English words that are maximally semantically unrelated to the existing words and to each other.`,
    "Return only a JSON array.",
  ].join(" ");
}

function mergeUniqueWords(left: string[], right: string[]): string[] {
  return [...left, ...right].filter(
    (value, index, allValues) => allValues.indexOf(value) === index,
  );
}

function normalizeWordList(content: string): string[] {
  try {
    const parsed = JSON.parse(content) as unknown;

    if (Array.isArray(parsed)) {
      return sanitizeWords(parsed);
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      "words" in parsed &&
      Array.isArray((parsed as { words?: unknown }).words)
    ) {
      return sanitizeWords((parsed as { words: unknown[] }).words);
    }
  } catch {
    // Fall back to line / comma parsing.
  }

  const fallback = content
    .replace(/^\s*\[|\]\s*$/g, "")
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);

  return sanitizeWords(fallback);
}

function extractTextContent(content: OpenRouterMessageContent): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part?.text === "string") {
          return part.text;
        }

        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  return "";
}

function describeContentShape(content: OpenRouterMessageContent): string {
  if (typeof content === "string") {
    return "string";
  }

  if (Array.isArray(content)) {
    return "array";
  }

  if (content == null) {
    return "empty";
  }

  return typeof content;
}

function logChatAttemptFailure(details: {
  modelId: string;
  attempt: number;
  reason: string;
  finishReason?: string | null;
  provider?: string;
  contentType: string;
  hasReasoning: boolean;
  hasReasoningDetails: boolean;
  rawPreview?: string;
}): void {
  console.warn(
    JSON.stringify(
      {
        event: "semantic_diversity_attempt_failed",
        ...details,
      },
      null,
      2,
    ),
  );
}

function sanitizeWords(values: unknown[]): string[] {
  return values
    .map((value) => String(value).trim().toLowerCase())
    .map((value) => value.replace(/^["'\d.\-\s]+|["'\d.\-\s]+$/g, ""))
    .filter((value) => /^[a-z]+$/.test(value))
    .filter((value, index, allValues) => allValues.indexOf(value) === index);
}

async function scoreWordList(words: string[]): Promise<number> {
  const embeddings = await Promise.all(words.map((word) => getEmbedding(word)));
  const scores: number[] = [];

  for (let i = 0; i < embeddings.length; i += 1) {
    for (let j = i + 1; j < embeddings.length; j += 1) {
      scores.push(Math.max(cosineSimilarity(embeddings[i], embeddings[j]), 0));
    }
  }

  return scores.reduce((total, score) => total + score, 0) / scores.length;
}

async function getEmbedding(text: string): Promise<number[]> {
  const embeddingModel =
    process.env.OPENROUTER_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL;

  const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: getOpenRouterHeaders(),
    body: JSON.stringify({
      model: embeddingModel,
      input: text.toLowerCase().trim(),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `OpenRouter embedding request failed: ${response.status} ${await response.text()}`,
    );
  }

  const data = (await response.json()) as OpenRouterEmbeddingResponse;
  const embedding = data.data?.[0]?.embedding;

  if (!embedding) {
    throw new Error("OpenRouter returned no embedding.");
  }

  return embedding;
}

function cosineSimilarity(left: number[], right: number[]): number {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function getOpenRouterHeaders(): HeadersInit {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required.");
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://github.com/jdleo/weirdbench",
    "X-Title": "WeirdBench",
  };
}
