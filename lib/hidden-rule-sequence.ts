type ChatRequestMode = "strict" | "relaxed" | "minimal";

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

const OBSERVED_ITEM_COUNT = 6;
const PREDICT_ITEM_COUNT = 3;
const MAX_GENERATION_ATTEMPTS = 5;

const providerOverrides: Record<string, RequestOverride> = {
  "minimax/minimax-m2.5": {
    provider: {
      allow_fallbacks: false,
      require_parameters: true,
    },
  },
};

export type HiddenRuleSequenceCase = {
  id: string;
  family: string;
  sequence: string[];
  expectedNext: string[];
};

export type HiddenRuleSequenceCaseResult = HiddenRuleSequenceCase & {
  predictedNext: string[];
  exactItemAccuracy: number;
  fullSequenceMatch: boolean;
};

export async function runHiddenRuleSequenceBenchmark(
  modelId: string,
): Promise<{
  modelId: string;
  score: number;
  exactItemAccuracy: number;
  fullSequenceMatchRate: number;
  caseCount: number;
  predictItemCount: number;
  cases: HiddenRuleSequenceCaseResult[];
  promptTemplate: string;
}> {
  const cases = generateHiddenRuleSequenceCases();
  const promptTemplate = getCasePrompt(cases[0]);
  const results: HiddenRuleSequenceCaseResult[] = [];

  for (const testCase of cases) {
    const predictedNext = await predictNextItems(modelId, testCase);
    const exactMatches = testCase.expectedNext.filter(
      (expected, index) => predictedNext[index] === expected,
    ).length;
    const exactItemAccuracy = exactMatches / testCase.expectedNext.length;
    const fullSequenceMatch = exactMatches === testCase.expectedNext.length;

    results.push({
      ...testCase,
      predictedNext,
      exactItemAccuracy,
      fullSequenceMatch,
    });
  }

  const exactItemAccuracy =
    results.reduce((total, result) => total + result.exactItemAccuracy, 0) /
    results.length;
  const fullSequenceMatchRate =
    results.filter((result) => result.fullSequenceMatch).length / results.length;

  return {
    modelId,
    score: exactItemAccuracy,
    exactItemAccuracy,
    fullSequenceMatchRate,
    caseCount: results.length,
    predictItemCount: PREDICT_ITEM_COUNT,
    cases: results,
    promptTemplate,
  };
}

function generateHiddenRuleSequenceCases(): HiddenRuleSequenceCase[] {
  return [
    ...buildArithmeticProgressionCases(),
    ...buildIncreasingStepCases(),
    ...buildAlternationCases(),
    ...buildGrammarExpansionCases(),
    ...buildMixedAttributeCases(),
  ];
}

function buildArithmeticProgressionCases(): HiddenRuleSequenceCase[] {
  return [
    createNumericProgressionCase("arith-1", 4, 3),
    createNumericProgressionCase("arith-2", 11, 5),
    createNumericProgressionCase("arith-3", 23, 7),
    createNumericProgressionCase("arith-4", 2, 9),
  ];
}

function createNumericProgressionCase(
  id: string,
  start: number,
  step: number,
): HiddenRuleSequenceCase {
  const values = Array.from(
    { length: OBSERVED_ITEM_COUNT + PREDICT_ITEM_COUNT },
    (_, index) => String(start + step * index),
  );

  return {
    id,
    family: "arithmetic-progression",
    sequence: values.slice(0, OBSERVED_ITEM_COUNT),
    expectedNext: values.slice(OBSERVED_ITEM_COUNT),
  };
}

function buildIncreasingStepCases(): HiddenRuleSequenceCase[] {
  return [
    createIncreasingStepCase("step-1", 2, 3, 1),
    createIncreasingStepCase("step-2", 5, 4, 2),
    createIncreasingStepCase("step-3", 9, 6, 1),
    createIncreasingStepCase("step-4", 14, 5, 3),
  ];
}

function createIncreasingStepCase(
  id: string,
  start: number,
  initialStep: number,
  stepGrowth: number,
): HiddenRuleSequenceCase {
  const values: number[] = [start];
  let current = start;
  let step = initialStep;

  for (let index = 1; index < OBSERVED_ITEM_COUNT + PREDICT_ITEM_COUNT; index += 1) {
    current += step;
    values.push(current);
    step += stepGrowth;
  }

  return {
    id,
    family: "increasing-step-recurrence",
    sequence: values.slice(0, OBSERVED_ITEM_COUNT).map(String),
    expectedNext: values.slice(OBSERVED_ITEM_COUNT).map(String),
  };
}

function buildAlternationCases(): HiddenRuleSequenceCase[] {
  return [
    createCycleCase("alt-1", "alternation", ["@", "#"]),
    createCycleCase("alt-2", "alternation", ["sun", "moon", "moon"]),
    createCycleCase("alt-3", "nested-cycle", ["A1", "B1", "A2", "B2"]),
    createCycleCase("alt-4", "nested-cycle", ["triangle", "circle", "triangle", "square"]),
  ];
}

function createCycleCase(
  id: string,
  family: string,
  cycle: string[],
): HiddenRuleSequenceCase {
  const values = Array.from(
    { length: OBSERVED_ITEM_COUNT + PREDICT_ITEM_COUNT },
    (_, index) => cycle[index % cycle.length],
  );

  return {
    id,
    family,
    sequence: values.slice(0, OBSERVED_ITEM_COUNT),
    expectedNext: values.slice(OBSERVED_ITEM_COUNT),
  };
}

function buildGrammarExpansionCases(): HiddenRuleSequenceCase[] {
  return [
    createGrowingSuffixCase("grammar-1", "a", "b"),
    createGrowingSuffixCase("grammar-2", "x", "yz"),
    createWrappedCase("grammar-3", "m", "[", "]"),
    createWrappedCase("grammar-4", "core", "<", ">"),
  ];
}

function createGrowingSuffixCase(
  id: string,
  root: string,
  suffix: string,
): HiddenRuleSequenceCase {
  const values = Array.from(
    { length: OBSERVED_ITEM_COUNT + PREDICT_ITEM_COUNT },
    (_, index) => root + suffix.repeat(index),
  );

  return {
    id,
    family: "grammar-expansion",
    sequence: values.slice(0, OBSERVED_ITEM_COUNT),
    expectedNext: values.slice(OBSERVED_ITEM_COUNT),
  };
}

function createWrappedCase(
  id: string,
  core: string,
  leftWrap: string,
  rightWrap: string,
): HiddenRuleSequenceCase {
  const values = Array.from(
    { length: OBSERVED_ITEM_COUNT + PREDICT_ITEM_COUNT },
    (_, index) => `${leftWrap.repeat(index)}${core}${rightWrap.repeat(index)}`,
  );

  return {
    id,
    family: "grammar-wrap",
    sequence: values.slice(0, OBSERVED_ITEM_COUNT),
    expectedNext: values.slice(OBSERVED_ITEM_COUNT),
  };
}

function buildMixedAttributeCases(): HiddenRuleSequenceCase[] {
  return [
    createMixedAttributeCase("mixed-1", ["red", "blue"], ["circle", "square", "triangle"]),
    createMixedAttributeCase("mixed-2", ["north", "east", "south"], ["amber", "jade"]),
    createMixedAttributeCase("mixed-3", ["small", "large"], ["oak", "pine", "birch"]),
    createMixedAttributeCase("mixed-4", ["cold", "warm", "hot"], ["iron", "glass"]),
  ];
}

function createMixedAttributeCase(
  id: string,
  firstAxis: string[],
  secondAxis: string[],
): HiddenRuleSequenceCase {
  const values = Array.from(
    { length: OBSERVED_ITEM_COUNT + PREDICT_ITEM_COUNT },
    (_, index) =>
      `${firstAxis[index % firstAxis.length]}-${secondAxis[
        Math.floor(index / firstAxis.length) % secondAxis.length
      ]}`,
  );

  return {
    id,
    family: "mixed-attribute-transition",
    sequence: values.slice(0, OBSERVED_ITEM_COUNT),
    expectedNext: values.slice(OBSERVED_ITEM_COUNT),
  };
}

async function predictNextItems(
  modelId: string,
  testCase: HiddenRuleSequenceCase,
): Promise<string[]> {
  let bestPrediction: string[] = [];

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const data = await requestChatCompletion({
      modelId,
      prompt:
        attempt === 1
          ? getCasePrompt(testCase)
          : getRepairPrompt(testCase, bestPrediction),
    });
    const choice = data.choices?.[0];
    const message = choice?.message;
    const content = extractTextContent(message?.content);

    if (!content) {
      logPredictionAttemptFailure({
        modelId,
        caseId: testCase.id,
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

    const predictedNext = normalizePredictionList(content);

    if (predictedNext.length === 0) {
      logPredictionAttemptFailure({
        modelId,
        caseId: testCase.id,
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

    if (predictedNext.length > bestPrediction.length) {
      bestPrediction = predictedNext;
    }

    if (predictedNext.length === PREDICT_ITEM_COUNT) {
      return predictedNext;
    }

    logPredictionAttemptFailure({
      modelId,
      caseId: testCase.id,
      attempt,
      reason: "partial_prediction",
      finishReason: choice?.finish_reason,
      provider: data.provider,
      contentType: describeContentShape(message?.content),
      hasReasoning: Boolean(message?.reasoning),
      hasReasoningDetails: Boolean(message?.reasoning_details?.length),
      rawPreview: content.slice(0, 240),
    });
  }

  throw new Error(
    `Failed to parse ${PREDICT_ITEM_COUNT} predicted items for case ${testCase.id}.`,
  );
}

function getCasePrompt(testCase: HiddenRuleSequenceCase): string {
  return [
    "Infer the hidden rule in the sequence and predict the next 3 items.",
    "Return only JSON in the form {\"next\":[...]} or a JSON array.",
    "Preserve exact item formatting.",
    `Sequence: ${JSON.stringify(testCase.sequence)}`,
  ].join(" ");
}

function getRepairPrompt(
  testCase: HiddenRuleSequenceCase,
  existingPrediction: string[],
): string {
  return [
    "Your previous answer was invalid.",
    "Return exactly 3 next items for the sequence.",
    "Return only JSON in the form {\"next\":[...]} or a JSON array.",
    "Preserve exact item formatting.",
    ...(existingPrediction.length > 0
      ? [
          `You already returned this partial candidate: ${JSON.stringify(existingPrediction)}.`,
          "Return the complete 3-item continuation, not just the missing suffix.",
        ]
      : []),
    `Sequence: ${JSON.stringify(testCase.sequence)}`,
  ].join(" ");
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
    temperature: 0,
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

function normalizePredictionList(content: string): string[] {
  const normalizedContent = stripMarkdownFences(content).trim();

  try {
    return sanitizePredictionValues(extractPredictionValues(JSON.parse(normalizedContent)));
  } catch {
    const jsonCandidate = extractJsonCandidate(normalizedContent);

    if (jsonCandidate) {
      try {
        return sanitizePredictionValues(extractPredictionValues(JSON.parse(jsonCandidate)));
      } catch {
        // Fall through to loose parsing.
      }
    }
  }

  return sanitizePredictionValues(
    normalizedContent
      .replace(/^\s*\[|\]\s*$/g, "")
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function extractPredictionValues(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed && typeof parsed === "object") {
    const object = parsed as Record<string, unknown>;

    for (const key of ["next", "items", "prediction", "predictions", "answer"]) {
      if (Array.isArray(object[key])) {
        return object[key];
      }
    }
  }

  return [];
}

function sanitizePredictionValues(values: unknown[]): string[] {
  return values
    .map((value) => String(value).trim())
    .map((value) => value.replace(/^['"]+|['"]+$/g, ""))
    .filter(Boolean)
    .slice(0, PREDICT_ITEM_COUNT);
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

function logPredictionAttemptFailure(details: {
  modelId: string;
  caseId: string;
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
        event: "hidden_rule_sequence_attempt_failed",
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
