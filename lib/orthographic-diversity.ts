import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import wordListPath from "word-list";

const WORD_COUNT = 20;
const MIN_LENGTH = 4;
const MAX_LENGTH = 9;
const MAX_GENERATION_ATTEMPTS = 5;
const RUN_COUNT = 3;
const INVALID_WORD_PENALTY = 1;
const DUPLICATE_PENALTY = 2.5;
const COUNT_MISMATCH_PENALTY = 3;

type ProviderOverride = {
  only?: string[];
  order?: string[];
  allow_fallbacks?: boolean;
  require_parameters?: boolean;
};

type RequestOverride = {
  provider?: ProviderOverride;
  useResponseFormat?: boolean;
  useReasoningExclude?: boolean;
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

type ScoredWord = {
  submitted: string;
  normalized: string;
  isFormatValid: boolean;
  isDictionaryWord: boolean;
  isValid: boolean;
};

export type OrthographicDiversityResult = {
  modelId: string;
  averageScore: number;
  prompt: string;
  runs: OrthographicDiversityRun[];
};

export type OrthographicDiversityRun = {
  words: string[];
  score: number;
  scoreBreakdown: {
    averagePairwiseDistance: number;
    invalidWordCount: number;
    duplicateCount: number;
    countMismatchPenalty: number;
    totalPenalty: number;
  };
  invalidWords: string[];
  duplicateWords: string[];
};

const providerOverrides: Record<string, RequestOverride> = {
  "minimax/minimax-m2.5": {
    provider: {
      allow_fallbacks: false,
      require_parameters: true,
    },
  },
};

let dictionaryPromise: Promise<Set<string>> | null = null;
const require = createRequire(import.meta.url);

export async function runOrthographicDiversityBenchmark(
  modelId: string,
): Promise<OrthographicDiversityResult> {
  const prompt = getOrthographicDiversityPrompt();
  const runs: OrthographicDiversityRun[] = [];

  for (let index = 0; index < RUN_COUNT; index += 1) {
    const words = await generateOrthographicWordList(modelId, prompt);
    const scoreResult = await scoreWordList(words);
    runs.push({
      words,
      ...scoreResult,
    });
  }

  const averageScore =
    runs.reduce((total, run) => total + run.score, 0) / runs.length;

  return {
    modelId,
    prompt,
    averageScore,
    runs,
  };
}

export function getOrthographicDiversityPrompt(): string {
  return "Output exactly 20 real English words, with one word per line. Each word must be a single real English word of 4 to 9 letters. Your goal is to make the 20 words as orthographically different from one another as possible, meaning their spellings should have as little overlap as possible across the full set.";
}

async function generateOrthographicWordList(
  modelId: string,
  prompt: string,
): Promise<string[]> {
  let bestWords: string[] = [];

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const data = await requestChatCompletion({
      modelId,
      prompt: attempt === 1 ? prompt : buildRepairPrompt(bestWords),
    });
    const choice = data.choices?.[0];
    const message = choice?.message;
    const content = extractTextContent(message?.content);

    if (!content) {
      logAttemptFailure({
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
      logAttemptFailure({
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

    if (words.length > bestWords.length) {
      bestWords = words;
    }

    if (words.length === WORD_COUNT) {
      return words;
    }

    logAttemptFailure({
      modelId,
      attempt,
      reason: "wrong_item_count",
      finishReason: choice?.finish_reason,
      provider: data.provider,
      contentType: describeContentShape(message?.content),
      hasReasoning: Boolean(message?.reasoning),
      hasReasoningDetails: Boolean(message?.reasoning_details?.length),
      rawPreview: content.slice(0, 240),
    });
  }

  if (bestWords.length > 0) {
    return bestWords;
  }

  throw new Error(
    `Failed to generate any parseable word list after ${MAX_GENERATION_ATTEMPTS} attempts.`,
  );
}

function buildRepairPrompt(existingWords: string[]): string {
  return [
    "Your previous answer was invalid.",
    `Return exactly ${WORD_COUNT} words, one word per line.`,
    `Each word must be a real English word of ${MIN_LENGTH} to ${MAX_LENGTH} letters.`,
    "Use lowercase only.",
    "No duplicates, no proper nouns, no abbreviations, no acronyms, no punctuation.",
    ...(existingWords.length > 0
      ? [
          `Your previous partial candidate list was: ${JSON.stringify(existingWords)}.`,
          "Return the full 20-word list, not just the missing words.",
        ]
      : []),
  ].join(" ");
}

async function scoreWordList(words: string[]): Promise<{
  score: number;
  scoreBreakdown: OrthographicDiversityRun["scoreBreakdown"];
  invalidWords: string[];
  duplicateWords: string[];
}> {
  const dictionary = await getDictionary();
  const scoredWords = scoreSubmittedWords(words, dictionary);
  const validWords = scoredWords.filter((word) => word.isValid).map((word) => word.normalized);
  const averagePairwiseDistance = getAveragePairwiseLevenshtein(validWords);
  const invalidWords = scoredWords
    .filter((word) => !word.isValid)
    .map((word) => word.submitted || word.normalized);
  const duplicateWords = getDuplicateWords(scoredWords.map((word) => word.normalized));
  const countMismatchPenalty = Math.abs(words.length - WORD_COUNT) * COUNT_MISMATCH_PENALTY;
  const totalPenalty =
    invalidWords.length * INVALID_WORD_PENALTY +
    duplicateWords.length * DUPLICATE_PENALTY +
    countMismatchPenalty;

  return {
    score: averagePairwiseDistance - totalPenalty,
    scoreBreakdown: {
      averagePairwiseDistance,
      invalidWordCount: invalidWords.length,
      duplicateCount: duplicateWords.length,
      countMismatchPenalty,
      totalPenalty,
    },
    invalidWords,
    duplicateWords,
  };
}

function scoreSubmittedWords(words: string[], dictionary: Set<string>): ScoredWord[] {
  const limitedWords = words.slice(0, WORD_COUNT);

  while (limitedWords.length < WORD_COUNT) {
    limitedWords.push(`__missing_${limitedWords.length}`);
  }

  return limitedWords.map((word) => {
    const normalized = word.trim().toLowerCase();
    const isFormatValid = /^[a-z]{4,9}$/.test(normalized);
    const isDictionaryWord = isFormatValid && dictionary.has(normalized);

    return {
      submitted: word,
      normalized,
      isFormatValid,
      isDictionaryWord,
      isValid: isFormatValid && isDictionaryWord,
    };
  });
}

function getDuplicateWords(words: string[]): string[] {
  const counts = new Map<string, number>();

  for (const word of words) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([word, count]) => !word.startsWith("__missing_") && count > 1)
    .map(([word]) => word);
}

function getAveragePairwiseLevenshtein(words: string[]): number {
  if (words.length < 2) {
    return 0;
  }

  let totalDistance = 0;
  let pairCount = 0;

  for (let leftIndex = 0; leftIndex < words.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < words.length; rightIndex += 1) {
      totalDistance += levenshteinDistance(words[leftIndex], words[rightIndex]);
      pairCount += 1;
    }
  }

  return totalDistance / pairCount;
}

function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array<number>(right.length + 1).fill(0);

  for (let row = 1; row <= left.length; row += 1) {
    current[0] = row;

    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + cost,
      );
    }

    for (let column = 0; column <= right.length; column += 1) {
      previous[column] = current[column];
    }
  }

  return previous[right.length];
}

function normalizeWordList(content: string): string[] {
  const normalizedContent = stripMarkdownFences(content).trim();

  try {
    const parsed = JSON.parse(normalizedContent) as unknown;
    const values = extractWordValues(parsed);

    if (values.length > 0) {
      return sanitizeWords(values);
    }
  } catch {
    const jsonCandidate = extractJsonCandidate(normalizedContent);

    if (jsonCandidate) {
      try {
        const parsed = JSON.parse(jsonCandidate) as unknown;
        const values = extractWordValues(parsed);

        if (values.length > 0) {
          return sanitizeWords(values);
        }
      } catch {
        // Fall through.
      }
    }
  }

  const lines = normalizedContent
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter((value) => !/\s/.test(value))
    .filter(Boolean);

  if (lines.length > 1) {
    return sanitizeWords(lines);
  }

  return sanitizeWords(
    normalizedContent
      .split(/[,\n]/)
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function extractWordValues(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed && typeof parsed === "object") {
    const object = parsed as Record<string, unknown>;

    for (const key of ["words", "items", "answer", "answers"]) {
      if (Array.isArray(object[key])) {
        return object[key];
      }
    }

    return Object.values(object);
  }

  return [];
}

function sanitizeWords(values: unknown[]): string[] {
  return values
    .map((value) => String(value).trim().toLowerCase())
    .map((value) => value.replace(/^[-*0-9.)\s]+/, ""))
    .map((value) => value.replace(/^['"]+|['"]+$/g, ""))
    .filter(Boolean);
}

async function getDictionary(): Promise<Set<string>> {
  if (!dictionaryPromise) {
    dictionaryPromise = loadDictionary();
  }

  return dictionaryPromise;
}

async function loadDictionary(): Promise<Set<string>> {
  const content = await readFile(wordListPath, "utf8");
  const primaryWords = content
    .split("\n")
    .map((word) => word.trim().toLowerCase())
    .filter((word) => /^[a-z]{4,9}$/.test(word));
  const secondaryWords = (require("an-array-of-english-words") as string[])
    .map((word) => word.trim().toLowerCase())
    .filter((word) => /^[a-z]{4,9}$/.test(word));

  return new Set([...primaryWords, ...secondaryWords]);
}

function buildChatRequest(input: {
  modelId: string;
  prompt: string;
  mode: ChatRequestMode;
}): Record<string, unknown> {
  const requestOverride = getRequestOverride(input.modelId);
  const useResponseFormat =
    input.mode === "strict"
      ? requestOverride.useResponseFormat !== false
      : false;
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
    temperature: 0.1,
    ...(useReasoningExclude
      ? {
          reasoning: {
            exclude: true,
          },
        }
      : {}),
    ...(useResponseFormat
      ? {
          response_format: {
            type: "json_object",
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
      useResponseFormat: false,
      useReasoningExclude: false,
      provider: {
        require_parameters: false,
      },
    };
  }

  return {};
}

function stripMarkdownFences(content: string): string {
  return content
    .replace(/^```[a-zA-Z0-9_-]*\s*/g, "")
    .replace(/\s*```$/g, "")
    .trim();
}

function extractJsonCandidate(content: string): string | null {
  const arrayMatch = content.match(/\[[\s\S]*\]/);

  if (arrayMatch) {
    return arrayMatch[0];
  }

  const objectMatch = content.match(/\{[\s\S]*\}/);

  if (objectMatch) {
    return objectMatch[0];
  }

  return null;
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

function logAttemptFailure(details: {
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
        event: "orthographic_diversity_attempt_failed",
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
  };
}
