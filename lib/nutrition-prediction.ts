const DISH_COUNT = 50;
const DISH_SELECTION_SEED = 20250907;
const MIN_CALORIES = 100;
const MIN_INGREDIENTS = 3;
const DISH_CONCURRENCY = 4;
const MAX_PREDICTION_ATTEMPTS = 3;

const METADATA_URLS = [
  "https://storage.googleapis.com/download/storage/v1/b/nutrition5k_dataset/o/nutrition5k_dataset%2Fmetadata%2Fdish_metadata_cafe1.csv?alt=media",
  "https://storage.googleapis.com/download/storage/v1/b/nutrition5k_dataset/o/nutrition5k_dataset%2Fmetadata%2Fdish_metadata_cafe2.csv?alt=media",
] as const;

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

type NutritionField = "calories" | "protein" | "carbs" | "fat";

type NutritionValues = Record<NutritionField, number>;

type NutritionDish = {
  dishId: string;
  ingredients: string[];
  actual: NutritionValues;
};

type NutritionPrediction = NutritionValues;

export type NutritionPredictionResult = {
  modelId: string;
  overallScore: number;
  accuracyScore: number;
  correlationScore: number;
  averageMape: number;
  averageCorrelation: number;
  promptTemplate: string;
  sampleSize: number;
  dishSelectionSeed: number;
  dishes: Array<{
    dishId: string;
    ingredients: string[];
    actual: NutritionValues;
    predicted: NutritionPrediction;
  }>;
  perField: Record<
    NutritionField,
    {
      mape: number;
      correlation: number;
    }
  >;
};

const FIELDS: NutritionField[] = ["calories", "protein", "carbs", "fat"];

const providerOverrides: Record<string, RequestOverride> = {
  "minimax/minimax-m2.5": {
    provider: {
      allow_fallbacks: false,
      require_parameters: true,
    },
  },
};

let dishesPromise: Promise<NutritionDish[]> | null = null;

export async function runNutritionPredictionBenchmark(
  modelId: string,
): Promise<NutritionPredictionResult> {
  const promptTemplate = getNutritionPredictionPromptTemplate();
  const dishes = await getNutritionBenchmarkDishes();
  const predictions = await runWithConcurrency(
    dishes,
    DISH_CONCURRENCY,
    async (dish) => ({
      dish,
      predicted: await predictDishNutrition(modelId, dish),
    }),
  );

  const perField = Object.fromEntries(
    FIELDS.map((field) => {
      const actualValues = predictions.map(({ dish }) => dish.actual[field]);
      const predictedValues = predictions.map(({ predicted }) => predicted[field]);

      return [
        field,
        {
          mape: getMeanAbsolutePercentageError(actualValues, predictedValues),
          correlation: getPearsonCorrelation(actualValues, predictedValues),
        },
      ];
    }),
  ) as NutritionPredictionResult["perField"];

  const averageMape =
    FIELDS.reduce((total, field) => total + perField[field].mape, 0) /
    FIELDS.length;
  const averageCorrelation =
    FIELDS.reduce((total, field) => total + perField[field].correlation, 0) /
    FIELDS.length;
  const accuracyScore = 100 / (1 + averageMape);
  const correlationScore = averageCorrelation * 100;
  const overallScore = accuracyScore * 0.6 + correlationScore * 0.4;

  return {
    modelId,
    overallScore,
    accuracyScore,
    correlationScore,
    averageMape,
    averageCorrelation,
    promptTemplate,
    sampleSize: dishes.length,
    dishSelectionSeed: DISH_SELECTION_SEED,
    dishes: predictions.map(({ dish, predicted }) => ({
      dishId: dish.dishId,
      ingredients: dish.ingredients,
      actual: dish.actual,
      predicted,
    })),
    perField,
  };
}

export function getNutritionPredictionPromptTemplate(): string {
  return [
    "You are a nutrition expert API which will take a list of ingredients and output JSON.",
    'Return exactly this shape: {"calories": <number>, "protein": <number>, "carbs": <number>, "fat": <number>}.',
    "Use numeric values only.",
    "Respond with no other text.",
  ].join(" ");
}

async function getNutritionBenchmarkDishes(): Promise<NutritionDish[]> {
  if (!dishesPromise) {
    dishesPromise = loadNutritionBenchmarkDishes();
  }

  return dishesPromise;
}

async function loadNutritionBenchmarkDishes(): Promise<NutritionDish[]> {
  const texts = await Promise.all(
    METADATA_URLS.map(async (url) => {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch Nutrition5k metadata: ${response.status} ${await response.text()}`,
        );
      }

      return response.text();
    }),
  );

  const rows = texts
    .flatMap((text) => text.trim().split(/\r?\n/))
    .map(parseNutritionDishRow)
    .filter((dish): dish is NutritionDish => Boolean(dish))
    .filter((dish) => dish.actual.calories >= MIN_CALORIES)
    .filter((dish) => dish.ingredients.length >= MIN_INGREDIENTS);

  return shuffleWithSeed(rows, DISH_SELECTION_SEED).slice(0, DISH_COUNT);
}

function parseNutritionDishRow(line: string): NutritionDish | null {
  const values = line.split(",");

  if (values.length < 13) {
    return null;
  }

  const ingredients: string[] = [];

  for (let index = 6; index + 6 < values.length; index += 7) {
    const ingredientName = values[index + 1]?.trim();

    if (ingredientName) {
      ingredients.push(ingredientName);
    }
  }

  return {
    dishId: values[0],
    ingredients,
    actual: {
      calories: Number(values[1]),
      protein: Number(values[5]),
      carbs: Number(values[4]),
      fat: Number(values[3]),
    },
  };
}

async function predictDishNutrition(
  modelId: string,
  dish: NutritionDish,
): Promise<NutritionPrediction> {
  let lastParseError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_PREDICTION_ATTEMPTS; attempt += 1) {
    const prompt = buildDishPrompt(dish, attempt);
    const data = await requestChatCompletion({ modelId, prompt });
    const choice = data.choices?.[0];
    const message = choice?.message;
    const content = extractTextContent(message?.content);

    if (!content) {
      logPredictionAttemptFailure({
        modelId,
        dishId: dish.dishId,
        attempt,
        reason: "missing_content",
        finishReason: choice?.finish_reason,
        provider: data.provider,
        contentType: describeContentShape(message?.content),
      });
      continue;
    }

    try {
      return parseNutritionPrediction(content);
    } catch (error) {
      lastParseError =
        error instanceof Error ? error : new Error(String(error));
      logPredictionAttemptFailure({
        modelId,
        dishId: dish.dishId,
        attempt,
        reason: "invalid_prediction",
        finishReason: choice?.finish_reason,
        provider: data.provider,
        contentType: describeContentShape(message?.content),
        rawPreview: content.slice(0, 240),
      });
    }
  }

  throw new Error(
    `Failed to parse nutrition prediction for ${dish.dishId}: ${lastParseError?.message ?? "unknown error"}`,
  );
}

function buildDishPrompt(dish: NutritionDish, attempt: number): string {
  const basePrompt = [
    getNutritionPredictionPromptTemplate(),
    `Ingredients: ${dish.ingredients.join(", ")}`,
  ];

  if (attempt > 1) {
    basePrompt.push(
      'Retry. Return only JSON with numeric "calories", "protein", "carbs", and "fat" fields.',
    );
  }

  return basePrompt.join("\n\n");
}

function parseNutritionPrediction(content: string): NutritionPrediction {
  const normalizedContent = stripMarkdownFences(content).trim();
  const parsed = JSON.parse(extractJsonCandidate(normalizedContent) ?? normalizedContent) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Prediction is not a JSON object.");
  }

  const record = parsed as Record<string, unknown>;
  const result = {} as NutritionPrediction;

  for (const field of FIELDS) {
    const value = normalizeNumericField(record[field]);

    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Invalid numeric value for ${field}.`);
    }

    result[field] = value;
  }

  return result;
}

function normalizeNumericField(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.+-]/g, "");
    const parsed = Number(cleaned);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Number.NaN;
}

function getMeanAbsolutePercentageError(
  actualValues: number[],
  predictedValues: number[],
): number {
  const percentages = actualValues.map((actual, index) => {
    if (actual <= 0) {
      return 0;
    }

    return (Math.abs(predictedValues[index] - actual) / actual) * 100;
  });

  return (
    percentages.reduce((total, value) => total + value, 0) / percentages.length
  );
}

function getPearsonCorrelation(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length === 0) {
    return 0;
  }

  const leftMean = left.reduce((total, value) => total + value, 0) / left.length;
  const rightMean = right.reduce((total, value) => total + value, 0) / right.length;

  let numerator = 0;
  let leftVariance = 0;
  let rightVariance = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index] - leftMean;
    const rightDelta = right[index] - rightMean;
    numerator += leftDelta * rightDelta;
    leftVariance += leftDelta * leftDelta;
    rightVariance += rightDelta * rightDelta;
  }

  const denominator = Math.sqrt(leftVariance * rightVariance);

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

function extractJsonCandidate(content: string): string | null {
  const objectMatch = content.match(/\{[\s\S]*\}/);
  return objectMatch ? objectMatch[0] : null;
}

function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const random = mulberry32(seed);
  const values = [...items];

  for (let index = values.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    [values[index], values[randomIndex]] = [values[randomIndex], values[index]];
  }

  return values;
}

function mulberry32(seed: number): () => number {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

async function runWithConcurrency<T, TResult>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<TResult>,
): Promise<TResult[]> {
  const results = new Array<TResult>(items.length);
  let currentIndex = 0;

  async function runNext(): Promise<void> {
    const index = currentIndex;
    currentIndex += 1;

    if (index >= items.length) {
      return;
    }

    results[index] = await worker(items[index]);
    await runNext();
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runNext()),
  );

  return results;
}

function logPredictionAttemptFailure(details: {
  modelId: string;
  dishId: string;
  attempt: number;
  reason: string;
  finishReason?: string | null;
  provider?: string;
  contentType: string;
  rawPreview?: string;
}): void {
  console.warn(
    JSON.stringify(
      {
        event: "nutrition_prediction_attempt_failed",
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
    "HTTP-Referer": "https://github.com/jdleo/weirdbench",
    "X-Title": "WeirdBench",
  };
}
