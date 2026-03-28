const BENCHMARK_ID = "wordle";
const MAX_TURNS = 10;
const REQUEST_TIMEOUT_MS = 120_000;

type ProviderOverride = {
  only?: string[];
  order?: string[];
  allow_fallbacks?: boolean;
  require_parameters?: boolean;
};

type RequestOverride = {
  provider?: ProviderOverride;
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

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type FeedbackColor = "gray" | "yellow" | "green";

type WordlePuzzle = {
  puzzleNumber: number;
  date: string;
  answer: string;
  sourceUrl: string;
};

export type WordlePuzzleRun = {
  puzzleNumber: number;
  date: string;
  answer: string;
  solved: boolean;
  turns: number;
  guesses: Array<{
    turn: number;
    rawResponse: string;
    parsedGuess: string | null;
    validGuess: boolean;
    feedback: FeedbackColor[] | null;
  }>;
};

export type WordleBenchmarkResult = {
  benchmarkId: typeof BENCHMARK_ID;
  modelId: string;
  averageTurns: number;
  prompt: string;
  maxTurns: number;
  puzzleCount: number;
  puzzles: WordlePuzzleRun[];
};

const providerOverrides: Record<string, RequestOverride> = {
  "minimax/minimax-m2.5": {
    provider: {
      allow_fallbacks: false,
      require_parameters: true,
    },
  },
};

const WORDLE_PUZZLES: WordlePuzzle[] = [
  {
    puzzleNumber: 1743,
    date: "2026-03-28",
    answer: "AFOOT",
    sourceUrl: "https://www.rockpapershotgun.com/wordle-hint-and-answer-today-28-03-26",
  },
  {
    puzzleNumber: 1742,
    date: "2026-03-27",
    answer: "IVORY",
    sourceUrl: "https://www.rockpapershotgun.com/wordle-hint-and-answer-today-27-03-26",
  },
  {
    puzzleNumber: 1741,
    date: "2026-03-26",
    answer: "BEFIT",
    sourceUrl: "https://www.rockpapershotgun.com/wordle-hint-and-answer-today-26-03-26",
  },
  {
    puzzleNumber: 1740,
    date: "2026-03-25",
    answer: "WISER",
    sourceUrl: "https://www.rockpapershotgun.com/wordle-hint-and-answer-today-25-03-26",
  },
  {
    puzzleNumber: 1739,
    date: "2026-03-24",
    answer: "BROOD",
    sourceUrl: "https://www.rockpapershotgun.com/wordle-hint-and-answer-today-24-03-26",
  },
  {
    puzzleNumber: 1738,
    date: "2026-03-23",
    answer: "SERIF",
    sourceUrl: "https://www.rockpapershotgun.com/wordle-hint-and-answer-today-23-03-26",
  },
  {
    puzzleNumber: 1737,
    date: "2026-03-22",
    answer: "BASIL",
    sourceUrl: "https://www.rockpapershotgun.com/wordle-hint-and-answer-today-22-03-26",
  },
  {
    puzzleNumber: 1736,
    date: "2026-03-21",
    answer: "SLICK",
    sourceUrl: "https://www.rockpapershotgun.com/wordle-hint-and-answer-today-21-03-26",
  },
  {
    puzzleNumber: 1735,
    date: "2026-03-20",
    answer: "OASIS",
    sourceUrl: "https://www.rockpapershotgun.com/wordle-hint-and-answer-today-20-03-26",
  },
  {
    puzzleNumber: 1734,
    date: "2026-03-19",
    answer: "REHAB",
    sourceUrl: "https://www.rockpapershotgun.com/wordle-hint-and-answer-today-19-03-26",
  },
  {
    puzzleNumber: 1733,
    date: "2026-03-18",
    answer: "AMPLY",
    sourceUrl: "https://www.rockpapershotgun.com/wordle-hint-and-answer-today-18-03-26",
  },
  {
    puzzleNumber: 1732,
    date: "2026-03-17",
    answer: "CLASP",
    sourceUrl: "https://www.rockpapershotgun.com/wordle-hint-and-answer-today-17-03-26",
  },
  {
    puzzleNumber: 1731,
    date: "2026-03-16",
    answer: "DRAMA",
    sourceUrl: "https://www.rockpapershotgun.com/wordle-hint-and-answer-today-16-03-26",
  },
  {
    puzzleNumber: 1730,
    date: "2026-03-15",
    answer: "GRADE",
    sourceUrl: "https://www.rockpapershotgun.com/wordle-hint-and-answer-today-15-03-26",
  },
  {
    puzzleNumber: 1729,
    date: "2026-03-14",
    answer: "ANKLE",
    sourceUrl: "https://www.rockpapershotgun.com/wordle-hint-and-answer-today-14-03-26",
  },
  {
    puzzleNumber: 1728,
    date: "2026-03-13",
    answer: "EATEN",
    sourceUrl: "https://www.rockpapershotgun.com/wordle-hint-and-answer-today-13-03-26",
  },
  {
    puzzleNumber: 1727,
    date: "2026-03-12",
    answer: "SMELL",
    sourceUrl: "https://www.rockpapershotgun.com/wordle-hint-and-answer-today-12-03-26",
  },
  {
    puzzleNumber: 1726,
    date: "2026-03-11",
    answer: "TEDDY",
    sourceUrl: "https://www.rockpapershotgun.com/wordle-hint-and-answer-today-11-03-26",
  },
  {
    puzzleNumber: 1725,
    date: "2026-03-10",
    answer: "SHOAL",
    sourceUrl: "https://www.rockpapershotgun.com/wordle-hint-and-answer-today-10-03-26",
  },
  {
    puzzleNumber: 1724,
    date: "2026-03-09",
    answer: "HASTY",
    sourceUrl: "https://www.rockpapershotgun.com/wordle-hint-and-answer-today-09-03-26",
  },
];

export async function runWordleBenchmark(
  modelId: string,
): Promise<WordleBenchmarkResult> {
  const prompt = getWordlePrompt();
  const puzzles: WordlePuzzleRun[] = [];

  for (const puzzle of WORDLE_PUZZLES) {
    puzzles.push(await playWordlePuzzle(modelId, puzzle, prompt));
  }

  const averageTurns =
    puzzles.reduce((total, puzzle) => total + puzzle.turns, 0) / puzzles.length;

  return {
    benchmarkId: BENCHMARK_ID,
    modelId,
    averageTurns,
    prompt,
    maxTurns: MAX_TURNS,
    puzzleCount: WORDLE_PUZZLES.length,
    puzzles,
  };
}

export function getWordlePrompt(): string {
  return [
    "You are playing Wordle with a judge.",
    "On every turn, reply with exactly one 5-letter English word and nothing else.",
    "Do not add punctuation, explanations, JSON, markdown, quotes, or multiple guesses.",
    "If you reply with anything besides a single 5-letter word, it is an invalid guess and you are penalized because it still counts as a turn.",
    "After each guess, the judge will return five slot results in order from left to right using only these colors:",
    "gray = that letter is not present in the answer after duplicate-letter accounting.",
    "yellow = that letter is present but in a different position.",
    "green = that letter is in the correct position.",
    "Duplicate letters are allowed in both guesses and answers, for example BOOST.",
    "Before sending each reply, verify that your final answer is exactly 5 letters long.",
    `You have at most ${MAX_TURNS} turns. Give your first guess now.`,
  ].join(" ");
}

async function playWordlePuzzle(
  modelId: string,
  puzzle: WordlePuzzle,
  prompt: string,
): Promise<WordlePuzzleRun> {
  const guesses: WordlePuzzleRun["guesses"] = [];
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: prompt,
    },
  ];

  for (let turn = 1; turn <= MAX_TURNS; turn += 1) {
    messages.push({
      role: "user",
      content:
        turn === 1
          ? "Turn 1. Reply with your first guess. Your reply must be exactly 5 letters."
          : `Turn ${turn}. Reply with your next guess. Your reply must be exactly 5 letters.`,
    });

    const response = await requestChatCompletion({ modelId, messages });
    const choice = response.choices?.[0];
    const content = extractTextContent(choice?.message?.content);
    const rawResponse = content?.trim() ?? "";
    const parsedGuess = normalizeGuess(rawResponse);
    const validGuess = Boolean(parsedGuess);

    messages.push({
      role: "assistant",
      content: rawResponse,
    });

    if (!parsedGuess) {
      guesses.push({
        turn,
        rawResponse,
        parsedGuess: null,
        validGuess: false,
        feedback: null,
      });

      if (turn < MAX_TURNS) {
        messages.push({
          role: "user",
          content: [
            `Invalid guess. Your reply was: ${JSON.stringify(rawResponse || "<empty>")}.`,
            "That still counted as a turn.",
            "You must reply with exactly one 5-letter English word using letters A-Z only and no extra text.",
            "Before replying, verify that your final answer is exactly 5 letters long.",
          ].join(" "),
        });
      }

      continue;
    }

    const feedback = getFeedback(parsedGuess, puzzle.answer);

    guesses.push({
      turn,
      rawResponse,
      parsedGuess,
      validGuess,
      feedback,
    });

    if (parsedGuess === puzzle.answer) {
      return {
        puzzleNumber: puzzle.puzzleNumber,
        date: puzzle.date,
        answer: puzzle.answer,
        solved: true,
        turns: turn,
        guesses,
      };
    }

    if (turn < MAX_TURNS) {
      messages.push({
        role: "user",
        content: buildFeedbackMessage(parsedGuess, feedback),
      });
    }
  }

  return {
    puzzleNumber: puzzle.puzzleNumber,
    date: puzzle.date,
    answer: puzzle.answer,
    solved: false,
    turns: MAX_TURNS,
    guesses,
  };
}

function buildFeedbackMessage(
  guess: string,
  feedback: FeedbackColor[],
): string {
  return [
    `Feedback for ${guess}: ${feedback.join(", ")}.`,
    "The colors are listed in left-to-right slot order.",
    "Your next reply must be exactly one 5-letter word.",
  ].join(" ");
}

function normalizeGuess(rawResponse: string): string | null {
  const exactCandidate = rawResponse.trim().toUpperCase();

  if (/^[A-Z]{5}$/.test(exactCandidate)) {
    return exactCandidate;
  }

  const lines = rawResponse
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const lastLine = lines.at(-1);

  if (!lastLine) {
    return null;
  }

  const strippedLine = lastLine.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "");
  const finalCandidate = strippedLine.toUpperCase();

  if (/^[A-Z]{5}$/.test(finalCandidate)) {
    return finalCandidate;
  }

  const candidates = Array.from(
    new Set(
      Array.from(rawResponse.matchAll(/\b([A-Za-z]{5})\b/g), (match) =>
        match[1].toUpperCase(),
      ),
    ),
  );

  return candidates.length === 1 ? candidates[0] : null;
}

function getFeedback(guess: string, answer: string): FeedbackColor[] {
  const feedback: FeedbackColor[] = Array.from(
    { length: guess.length },
    () => "gray",
  );
  const remainingLetters = new Map<string, number>();

  for (let index = 0; index < answer.length; index += 1) {
    if (guess[index] === answer[index]) {
      feedback[index] = "green";
      continue;
    }

    remainingLetters.set(
      answer[index],
      (remainingLetters.get(answer[index]) ?? 0) + 1,
    );
  }

  for (let index = 0; index < guess.length; index += 1) {
    if (feedback[index] === "green") {
      continue;
    }

    const remaining = remainingLetters.get(guess[index]) ?? 0;

    if (remaining > 0) {
      feedback[index] = "yellow";
      remainingLetters.set(guess[index], remaining - 1);
    }
  }

  return feedback;
}

function buildChatRequest(input: {
  modelId: string;
  messages: ChatMessage[];
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
    messages: input.messages,
    temperature: 0,
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
  messages: ChatMessage[];
}): Promise<OpenRouterChatResponse> {
  const modes: ChatRequestMode[] = ["strict", "relaxed", "minimal"];
  let lastError: Error | null = null;

  for (const mode of modes) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: getOpenRouterHeaders(),
        body: JSON.stringify(
          buildChatRequest({
            ...input,
            mode,
          }),
        ),
        signal: controller.signal,
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
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error("OpenRouter chat request failed in all modes.");
}

function getRequestOverride(modelId: string): RequestOverride {
  return providerOverrides[modelId] ?? {};
}

function getOpenRouterHeaders(): HeadersInit {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set.");
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

function extractTextContent(content: OpenRouterMessageContent): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => (part.type === "text" ? part.text ?? "" : ""))
    .join("")
    .trim();
}
