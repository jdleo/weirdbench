import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const HUMAN_SAMPLE_COUNT = 50;
const AI_SAMPLE_COUNT = 50;
const SAMPLE_SELECTION_SEED = 20260404;
const MAX_CLASSIFICATION_ATTEMPTS = 4;
const DEFAULT_MAX_CLASSIFICATION_TOKENS = 1024;

type ProviderOverride = {
  only?: string[];
  order?: string[];
  allow_fallbacks?: boolean;
  require_parameters?: boolean;
};

type RequestOverride = {
  provider?: ProviderOverride;
  useReasoningExclude?: boolean;
  maxTokens?: number;
};

type ChatRequestMode = "strict" | "relaxed" | "minimal";

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
};

type OpenRouterContentPart = {
  type?: string;
  text?: string;
};

type OpenRouterMessageContent = string | OpenRouterContentPart[] | undefined;

type EssayExample = {
  id: string;
  text: string;
  label: 0 | 1;
};

type ClassificationRecord = {
  id: string;
  actualLabel: 0 | 1;
  predictedLabel: 0 | 1;
  textLength: number;
};

export type AiWritingDetectionBenchmarkResult = {
  modelId: string;
  f1Score: number;
  precision: number;
  recall: number;
  promptTemplate: string;
  sampleSelectionSeed: number;
  sampleSize: number;
  positiveLabel: "1";
  datasetPath: string;
  counts: {
    human: number;
    ai: number;
  };
  confusionMatrix: {
    truePositive: number;
    falsePositive: number;
    falseNegative: number;
    trueNegative: number;
  };
  classifications: ClassificationRecord[];
};

const providerOverrides: Record<string, RequestOverride> = {
  "minimax/minimax-m2.5": {
    provider: {
      allow_fallbacks: false,
      require_parameters: true,
    },
  },
  "openai/gpt-oss-120b": {
    provider: {
      order: ["Fireworks"],
      allow_fallbacks: false,
      require_parameters: true,
    },
    maxTokens: 512,
  },
  "openai/gpt-oss-20b": {
    provider: {
      order: ["Fireworks"],
      allow_fallbacks: false,
      require_parameters: true,
    },
    maxTokens: 512,
  },
};

let essayDatasetPromise: Promise<{
  datasetPath: string;
  essays: EssayExample[];
}> | null = null;

export async function runAiWritingDetectionBenchmark(
  modelId: string,
): Promise<AiWritingDetectionBenchmarkResult> {
  const promptTemplate = getAiWritingDetectionPromptTemplate();
  const { datasetPath, essays } = await getAiWritingDetectionDataset();
  const classifications: ClassificationRecord[] = [];

  for (const essay of essays) {
    const predictedLabel = await classifyEssay(modelId, essay, promptTemplate);
    classifications.push({
      id: essay.id,
      actualLabel: essay.label,
      predictedLabel,
      textLength: essay.text.length,
    });
  }

  const confusionMatrix = getConfusionMatrix(classifications);
  const precision = getSafeRatio(
    confusionMatrix.truePositive,
    confusionMatrix.truePositive + confusionMatrix.falsePositive,
  );
  const recall = getSafeRatio(
    confusionMatrix.truePositive,
    confusionMatrix.truePositive + confusionMatrix.falseNegative,
  );
  const f1Score =
    precision + recall === 0
      ? 0
      : (2 * precision * recall) / (precision + recall);

  return {
    modelId,
    f1Score,
    precision,
    recall,
    promptTemplate,
    sampleSelectionSeed: SAMPLE_SELECTION_SEED,
    sampleSize: essays.length,
    positiveLabel: "1",
    datasetPath,
    counts: {
      human: essays.filter((essay) => essay.label === 0).length,
      ai: essays.filter((essay) => essay.label === 1).length,
    },
    confusionMatrix,
    classifications,
  };
}

export function getAiWritingDetectionPromptTemplate(): string {
  return [
    "Classify the essay as AI-generated or human-written.",
    'Return exactly one character: "1" for AI-generated or "0" for human-written.',
    "No explanation.",
  ].join(" ");
}

async function getAiWritingDetectionDataset(): Promise<{
  datasetPath: string;
  essays: EssayExample[];
}> {
  if (!essayDatasetPromise) {
    essayDatasetPromise = loadAiWritingDetectionDataset();
  }

  return essayDatasetPromise;
}

async function loadAiWritingDetectionDataset(): Promise<{
  datasetPath: string;
  essays: EssayExample[];
}> {
  const datasetPath = getDatasetPath();
  const csvText = await readFile(datasetPath, "utf8");
  const records = parseCsv(csvText);

  if (records.length === 0) {
    throw new Error(`Dataset is empty: ${datasetPath}`);
  }

  const normalizedRecords = records.map((record, index) =>
    normalizeEssayRecord(record, index),
  );
  const humans = shuffleWithSeed(
    normalizedRecords.filter((record) => record.label === 0),
    SAMPLE_SELECTION_SEED,
  ).slice(0, HUMAN_SAMPLE_COUNT);
  const ai = shuffleWithSeed(
    normalizedRecords.filter((record) => record.label === 1),
    SAMPLE_SELECTION_SEED + 1,
  ).slice(0, AI_SAMPLE_COUNT);

  if (humans.length < HUMAN_SAMPLE_COUNT || ai.length < AI_SAMPLE_COUNT) {
    throw new Error(
      `Dataset must include at least ${HUMAN_SAMPLE_COUNT} human and ${AI_SAMPLE_COUNT} AI essays.`,
    );
  }

  return {
    datasetPath,
    essays: [...humans, ...ai],
  };
}

function getDatasetPath(): string {
  const configuredPath = process.env.AI_WRITING_DETECTION_DATASET_PATH?.trim();

  if (configuredPath) {
    return configuredPath;
  }

  return path.join(homedir(), "Downloads", "AI Generated Essays Dataset.csv");
}

function normalizeEssayRecord(
  record: Record<string, string>,
  index: number,
): EssayExample {
  const rawText = record.text?.trim();
  const rawLabel = record.generated?.trim();

  if (!rawText) {
    throw new Error(`Dataset row ${index + 2} is missing essay text.`);
  }

  if (rawLabel !== "0" && rawLabel !== "1") {
    throw new Error(`Dataset row ${index + 2} has invalid label "${rawLabel}".`);
  }

  return {
    id: `essay-${index + 1}`,
    text: rawText,
    label: rawLabel === "1" ? 1 : 0,
  };
}

async function classifyEssay(
  modelId: string,
  essay: EssayExample,
  promptTemplate: string,
): Promise<0 | 1> {
  let lastParseError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_CLASSIFICATION_ATTEMPTS; attempt += 1) {
    const prompt = buildEssayPrompt(promptTemplate, essay.text, attempt);
    const data = await requestChatCompletion({ modelId, prompt });
    const choice = data.choices?.[0];
    const message = choice?.message;
    const content = extractTextContent(message?.content);

    if (!content) {
      logClassificationAttemptFailure({
        modelId,
        essayId: essay.id,
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

    try {
      return parseClassificationLabel(content);
    } catch (error) {
      lastParseError =
        error instanceof Error ? error : new Error(String(error));
      logClassificationAttemptFailure({
        modelId,
        essayId: essay.id,
        attempt,
        reason: "invalid_prediction",
        finishReason: choice?.finish_reason,
        provider: data.provider,
        contentType: describeContentShape(message?.content),
        hasReasoning: Boolean(message?.reasoning),
        hasReasoningDetails: Boolean(message?.reasoning_details?.length),
        rawPreview: content.slice(0, 40),
      });
    }
  }

  throw new Error(
    `Failed to classify ${essay.id}: ${lastParseError?.message ?? "unknown error"}`,
  );
}

function buildEssayPrompt(
  promptTemplate: string,
  essayText: string,
  attempt: number,
): string {
  const parts = [promptTemplate, `Essay:\n${essayText}`];

  if (attempt > 1) {
    parts.push('Retry. Return only "1" or "0".');
  }

  return parts.join("\n\n");
}

function parseClassificationLabel(content: string): 0 | 1 {
  const normalized = stripMarkdownFences(content).trim();
  const firstMatch = normalized.match(/[01]/);

  if (!firstMatch) {
    const lower = normalized.toLowerCase();

    if (
      /\b(ai|ai-generated|generated by ai|machine-generated|llm-generated)\b/.test(
        lower,
      )
    ) {
      return 1;
    }

    if (
      /\b(human|human-written|written by a human|written by human)\b/.test(
        lower,
      )
    ) {
      return 0;
    }

    throw new Error(`Prediction must contain 0 or 1, received "${normalized}".`);
  }

  return firstMatch[0] === "1" ? 1 : 0;
}

function getConfusionMatrix(classifications: ClassificationRecord[]): {
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  trueNegative: number;
} {
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let trueNegative = 0;

  for (const classification of classifications) {
    if (classification.actualLabel === 1 && classification.predictedLabel === 1) {
      truePositive += 1;
      continue;
    }

    if (classification.actualLabel === 0 && classification.predictedLabel === 1) {
      falsePositive += 1;
      continue;
    }

    if (classification.actualLabel === 1 && classification.predictedLabel === 0) {
      falseNegative += 1;
      continue;
    }

    trueNegative += 1;
  }

  return {
    truePositive,
    falsePositive,
    falseNegative,
    trueNegative,
  };
}

function getSafeRatio(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

function buildChatRequest(input: {
  modelId: string;
  prompt: string;
  mode: ChatRequestMode;
}): Record<string, unknown> {
  const requestOverride = getRequestOverride(input.modelId);
  const useReasoningExclude =
    input.mode === "minimal"
      ? false
      : requestOverride.useReasoningExclude !== false;
  const requireParameters =
    input.mode === "strict"
      ? requestOverride.provider?.require_parameters ?? true
      : false;

  return {
    model: input.modelId,
    messages: [
      {
        role: "user",
        content: input.prompt,
      },
    ],
    temperature: 0,
    max_tokens:
      requestOverride.maxTokens ?? DEFAULT_MAX_CLASSIFICATION_TOKENS,
    ...(useReasoningExclude
      ? {
          reasoning: {
            exclude: true,
          },
        }
      : {}),
    provider: {
      require_parameters: requireParameters,
      ...(requestOverride.provider ?? {}),
    },
  };
}

async function requestChatCompletion(input: {
  modelId: string;
  prompt: string;
}): Promise<OpenRouterChatResponse> {
  const modes: ChatRequestMode[] = ["strict", "relaxed", "minimal"];
  let lastError: Error | null = null;

  for (const mode of modes) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: getOpenRouterHeaders(),
      body: JSON.stringify(
        buildChatRequest({
          modelId: input.modelId,
          prompt: input.prompt,
          mode,
        }),
      ),
    });

    if (response.ok) {
      return (await response.json()) as OpenRouterChatResponse;
    }

    const errorText = await response.text();

    if (
      response.status === 404 &&
      errorText.includes("requested parameters") &&
      mode !== "minimal"
    ) {
      lastError = new Error(
        `OpenRouter chat request failed in ${mode} mode: ${response.status} ${errorText}`,
      );
      continue;
    }

    throw new Error(
      `OpenRouter chat request failed: ${response.status} ${errorText}`,
    );
  }

  throw lastError ?? new Error("OpenRouter chat request failed in all modes.");
}

function getRequestOverride(modelId: string): RequestOverride {
  if (providerOverrides[modelId]) {
    return providerOverrides[modelId];
  }

  if (modelId.startsWith("amazon/nova-")) {
    return {
      useReasoningExclude: false,
      provider: {
        require_parameters: false,
      },
    };
  }

  return {};
}

function extractTextContent(content: OpenRouterMessageContent): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
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

function stripMarkdownFences(content: string): string {
  return content
    .replace(/^```[a-zA-Z0-9_-]*\s*/g, "")
    .replace(/\s*```$/g, "")
    .trim();
}

function logClassificationAttemptFailure(details: {
  modelId: string;
  essayId: string;
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
        event: "ai_writing_detection_attempt_failed",
        ...details,
      },
      null,
      2,
    ),
  );
}

function getOpenRouterHeaders(): HeadersInit {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required.");
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    ...(process.env.OPENROUTER_HTTP_REFERER
      ? {
          "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER,
        }
      : {}),
    ...(process.env.OPENROUTER_X_TITLE
      ? {
          "X-Title": process.env.OPENROUTER_X_TITLE,
        }
      : {}),
  };
}

function parseCsv(csvText: string): Record<string, string>[] {
  const rows = parseCsvRows(csvText);

  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, "").trim());

  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};

    headers.forEach((header, index) => {
      record[header] = row[index] ?? "";
    });

    return record;
  });
}

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];

    if (character === '"') {
      if (inQuotes && csvText[index + 1] === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (character === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && csvText[index + 1] === "\n") {
        index += 1;
      }

      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += character;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows.filter(
    (row) => row.length > 1 || row[0]?.trim().length,
  );
}

function shuffleWithSeed<T>(values: T[], seed: number): T[] {
  const shuffled = [...values];
  let state = seed >>> 0;

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const swapIndex = state % (index + 1);
    const current = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = current;
  }

  return shuffled;
}
