import { execFile } from "node:child_process";
import { createRequire } from "node:module";

const BENCHMARK_ID = "regex-golf";
const MATCHES_PER_PUZZLE = 10;
const REJECTS_PER_PUZZLE = 10;
const MATCH_PENALTY = 20;
const REJECT_PENALTY = 20;
const INVALID_PENALTY = 200;
const EVAL_TIMEOUT_MS = 3_000;
const REQUEST_TIMEOUT_MS = 120_000;

type ProviderOverride = {
  only?: string[];
  order?: string[];
  allow_fallbacks?: boolean;
  require_parameters?: boolean;
};

type RequestOverride = {
  provider?: ProviderOverride;
  reasoning?: Record<string, unknown>;
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

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatRequestMode = "strict" | "relaxed" | "minimal";

export type RegexGolfPuzzle = {
  name: string;
  match: string[];
  reject: string[];
};

type WordPuzzleSpec = {
  kind: "words";
  name: string;
  predicate: (word: string) => boolean;
  minLength?: number;
  maxLength?: number;
  matchStart: number;
  matchStride: number;
  rejectStart: number;
  rejectStride: number;
};

type SyntheticPuzzleSpec = {
  kind: "synthetic";
  name: string;
  generate: () => { match: string[]; reject: string[] };
};

type PuzzleSpec = WordPuzzleSpec | SyntheticPuzzleSpec;

const WORD_PUZZLE_SPECS: WordPuzzleSpec[] = [
  {
    kind: "words",
    name: "Doubled Letters",
    predicate: hasAdjacentDuplicate,
    matchStart: 1_400,
    matchStride: 911,
    rejectStart: 2_300,
    rejectStride: 1_231,
  },
  {
    kind: "words",
    name: "Double O",
    predicate: (word) => word.includes("oo"),
    matchStart: 5_200,
    matchStride: 797,
    rejectStart: 6_100,
    rejectStride: 1_147,
  },
  {
    kind: "words",
    name: "Vowel Start",
    predicate: (word) => /^[aeiou]/.test(word),
    matchStart: 3_300,
    matchStride: 853,
    rejectStart: 4_400,
    rejectStride: 1_013,
  },
  {
    kind: "words",
    name: "Gerund Tail",
    predicate: (word) => word.endsWith("ing"),
    matchStart: 7_800,
    matchStride: 733,
    rejectStart: 8_900,
    rejectStride: 1_297,
  },
  {
    kind: "words",
    name: "Even Length",
    predicate: (word) => word.length % 2 === 0,
    matchStart: 10_000,
    matchStride: 661,
    rejectStart: 11_000,
    rejectStride: 1_337,
  },
  {
    kind: "words",
    name: "Contains Ball",
    predicate: (word) => word.includes("ball"),
    matchStart: 500,
    matchStride: 101,
    rejectStart: 12_000,
    rejectStride: 1_411,
  },
  {
    kind: "words",
    name: "Bookends",
    predicate: (word) => word[0] === word[word.length - 1],
    matchStart: 13_500,
    matchStride: 1_571,
    rejectStart: 14_500,
    rejectStride: 1_681,
  },
  {
    kind: "words",
    name: "Q Without U",
    predicate: (word) => /q(?!u)/.test(word),
    minLength: 2,
    matchStart: 0,
    matchStride: 3,
    rejectStart: 15_500,
    rejectStride: 1_777,
  },
  {
    kind: "words",
    name: "Palindrome",
    predicate: isPalindrome,
    matchStart: 0,
    matchStride: 5,
    rejectStart: 16_500,
    rejectStride: 1_877,
  },
  {
    kind: "words",
    name: "Digraph TH",
    predicate: (word) => word.includes("th"),
    matchStart: 18_000,
    matchStride: 907,
    rejectStart: 19_000,
    rejectStride: 1_033,
  },
  {
    kind: "words",
    name: "Doubled Tail",
    predicate: (word) =>
      word.length >= 2 && word[word.length - 1] === word[word.length - 2],
    matchStart: 21_000,
    matchStride: 1_117,
    rejectStart: 22_000,
    rejectStride: 1_219,
  },
  {
    kind: "words",
    name: "Double Vowel",
    predicate: (word) => /[aeiou]{2}/.test(word),
    matchStart: 24_000,
    matchStride: 1_307,
    rejectStart: 25_000,
    rejectStride: 1_423,
  },
  {
    kind: "words",
    name: "A Before B Before C",
    predicate: (word) => /a.*b.*c/.test(word),
    matchStart: 0,
    matchStride: 7,
    rejectStart: 27_000,
    rejectStride: 1_531,
  },
  {
    kind: "words",
    name: "Contains Cat",
    predicate: (word) => word.includes("cat"),
    matchStart: 29_000,
    matchStride: 1_633,
    rejectStart: 31_000,
    rejectStride: 1_741,
  },
  {
    kind: "words",
    name: "tion Tail",
    predicate: (word) => word.endsWith("tion"),
    matchStart: 33_000,
    matchStride: 1_853,
    rejectStart: 35_000,
    rejectStride: 1_963,
  },
  {
    kind: "words",
    name: "Digraph PH",
    predicate: (word) => word.includes("ph"),
    matchStart: 37_000,
    matchStride: 2_011,
    rejectStart: 39_000,
    rejectStride: 2_137,
  },
  {
    kind: "words",
    name: "Digraph MP",
    predicate: (word) => word.includes("mp"),
    matchStart: 41_000,
    matchStride: 2_237,
    rejectStart: 43_000,
    rejectStride: 2_351,
  },
  {
    kind: "words",
    name: "Lone Vowel",
    predicate: (word) => (word.match(/[aeiou]/g) ?? []).length === 1,
    matchStart: 45_000,
    matchStride: 2_477,
    rejectStart: 47_000,
    rejectStride: 2_593,
  },
  {
    kind: "words",
    name: "Double Z",
    predicate: (word) => word.includes("zz"),
    matchStart: 0,
    matchStride: 11,
    rejectStart: 49_000,
    rejectStride: 2_707,
  },
  {
    kind: "words",
    name: "Twin E",
    predicate: (word) => (word.match(/e/g) ?? []).length === 2,
    matchStart: 51_000,
    matchStride: 2_819,
    rejectStart: 53_000,
    rejectStride: 2_939,
  },
];

const SYNTHETIC_PUZZLE_SPECS: SyntheticPuzzleSpec[] = [
  {
    kind: "synthetic",
    name: "Multiples of Five",
    generate: generateMultiplesOfFivePuzzle,
  },
  {
    kind: "synthetic",
    name: "Binary Strings",
    generate: generateBinaryPuzzle,
  },
  {
    kind: "synthetic",
    name: "IPv4 Octets",
    generate: generateOctetPuzzle,
  },
  {
    kind: "synthetic",
    name: "Hex Colors",
    generate: generateHexColorPuzzle,
  },
  {
    kind: "synthetic",
    name: "Roman Numerals",
    generate: generateRomanPuzzle,
  },
];

const PUZZLE_SPECS: PuzzleSpec[] = [
  ...WORD_PUZZLE_SPECS,
  ...SYNTHETIC_PUZZLE_SPECS,
];

const providerOverrides: Record<string, RequestOverride> = {
  "moonshotai/kimi-k2.6": {
    provider: {
      require_parameters: true,
    },
    reasoning: {
      effort: "none",
      exclude: true,
    },
  },
  "minimax/minimax-m2.5": {
    provider: {
      allow_fallbacks: false,
      require_parameters: true,
    },
  },
};

const PYTHON_EVAL_SOURCE = `
import sys, json, re
data = json.loads(sys.stdin.buffer.read().decode("utf-8"))
result = {"ok": False, "error": None, "matchHits": None, "rejectHits": None}
try:
    pattern = re.compile(data["regex"])
except Exception as error:
    result["error"] = "invalid regex: " + str(error)
    sys.stdout.write(json.dumps(result))
    sys.exit(0)
try:
    result["matchHits"] = [bool(pattern.search(s)) for s in data["match"]]
    result["rejectHits"] = [bool(pattern.search(s)) for s in data["reject"]]
except Exception as error:
    result["error"] = "execution error: " + str(error)
    sys.stdout.write(json.dumps(result))
    sys.exit(0)
result["ok"] = True
sys.stdout.write(json.dumps(result))
`;

const require = createRequire(import.meta.url);

export type RegexGolfPuzzleRun = {
  name: string;
  regex: string;
  rawResponse: string;
  length: number;
  missedMatches: number;
  falseRejects: number;
  invalid: boolean;
  timedOut: boolean;
  error: string | null;
  puzzleScore: number;
};

export type RegexGolfBenchmarkResult = {
  benchmarkId: typeof BENCHMARK_ID;
  modelId: string;
  averageScore: number;
  totalScore: number;
  puzzleCount: number;
  prompt: string;
  puzzles: RegexGolfPuzzleRun[];
};

export function getRegexGolfPuzzles(): RegexGolfPuzzle[] {
  return PUZZLE_SPECS.map((spec) => {
    if (spec.kind === "synthetic") {
      const generated = spec.generate();
      return { name: spec.name, ...generated };
    }

    return { name: spec.name, ...selectWordPairs(spec) };
  });
}

export async function runRegexGolfBenchmark(
  modelId: string,
): Promise<RegexGolfBenchmarkResult> {
  const prompt = getRegexGolfPrompt();
  const puzzles = getRegexGolfPuzzles();
  const runs: RegexGolfPuzzleRun[] = [];

  for (const puzzle of puzzles) {
    runs.push(await playRegexGolfPuzzle(modelId, prompt, puzzle));
  }

  const totalScore = runs.reduce(
    (total, run) => total + run.puzzleScore,
    0,
  );

  return {
    benchmarkId: BENCHMARK_ID,
    modelId,
    averageScore: totalScore / runs.length,
    totalScore,
    puzzleCount: runs.length,
    prompt,
    puzzles: runs,
  };
}

export function getRegexGolfPrompt(): string {
  return [
    "You are competing in Regex Golf.",
    "You will receive two fixed lists of lowercase strings: MATCH and REJECT.",
    "Write one regular expression using Python re syntax that, when used with re.search, matches every string in MATCH and none of the strings in REJECT.",
    `Scoring per puzzle: your raw score is the character length of your regex, plus ${MATCH_PENALTY} for every MATCH string your regex fails to match, plus ${REJECT_PENALTY} for every REJECT string your regex falsely matches, plus a flat ${INVALID_PENALTY} if the regex is invalid or times out. Lower is better.`,
    "Anchor your regex when position matters. You may use backreferences, lookahead, character classes, and alternation.",
    "Reply with ONLY the raw regex string and nothing else: no explanation, no markdown, no code fences, no surrounding quotes or slashes.",
  ].join(" ");
}

async function playRegexGolfPuzzle(
  modelId: string,
  prompt: string,
  puzzle: RegexGolfPuzzle,
): Promise<RegexGolfPuzzleRun> {
  const messages: ChatMessage[] = [
    { role: "system", content: prompt },
    {
      role: "user",
      content: [
        `MATCH: ${JSON.stringify(puzzle.match)}`,
        `REJECT: ${JSON.stringify(puzzle.reject)}`,
        "Reply with only the raw regex string.",
      ].join("\n"),
    },
  ];

  const response = await requestChatCompletion({ modelId, messages });
  const choice = response.choices?.[0];
  const rawResponse = extractTextContent(choice?.message?.content).trim();
  const regex = extractRegex(rawResponse);
  const outcome = await evaluateRegexWithPython(regex, puzzle);

  const missedMatches = outcome.matchHits
    ? outcome.matchHits.filter((hit) => !hit).length
    : MATCHES_PER_PUZZLE;
  const falseRejects = outcome.rejectHits
    ? outcome.rejectHits.filter((hit) => hit).length
    : REJECTS_PER_PUZZLE;

  const lengthPenalty = regex.length;
  const penalty =
    missedMatches * MATCH_PENALTY +
    falseRejects * REJECT_PENALTY +
    (outcome.valid ? 0 : INVALID_PENALTY);

  return {
    name: puzzle.name,
    regex,
    rawResponse,
    length: regex.length,
    missedMatches,
    falseRejects,
    invalid: !outcome.valid,
    timedOut: outcome.timedOut,
    error: outcome.error,
    puzzleScore: lengthPenalty + penalty,
  };
}

type PythonEvalOutcome = {
  valid: boolean;
  timedOut: boolean;
  error: string | null;
  matchHits: boolean[] | null;
  rejectHits: boolean[] | null;
};

export function evaluateRegexWithPython(
  regex: string,
  puzzle: RegexGolfPuzzle,
): Promise<PythonEvalOutcome> {
  return new Promise((resolve) => {
    const child = execFile(
      "python3",
      ["-c", PYTHON_EVAL_SOURCE],
      { timeout: EVAL_TIMEOUT_MS },
      (error, stdout) => {
        if (error && !stdout) {
          resolve({
            valid: false,
            timedOut: Boolean(error.killed),
            error: error.killed
              ? "timed out (possible catastrophic backtracking)"
              : `evaluator failed: ${error.message}`,
            matchHits: null,
            rejectHits: null,
          });
          return;
        }

        try {
          const parsed = JSON.parse(stdout) as {
            ok: boolean;
            error: string | null;
            matchHits: boolean[] | null;
            rejectHits: boolean[] | null;
          };

          resolve({
            valid: parsed.ok,
            timedOut: false,
            error: parsed.error,
            matchHits: parsed.matchHits,
            rejectHits: parsed.rejectHits,
          });
        } catch {
          resolve({
            valid: false,
            timedOut: false,
            error: "evaluator produced unparseable output",
            matchHits: null,
            rejectHits: null,
          });
        }
      },
    );

    child.stdin?.write(
      JSON.stringify({
        regex,
        match: puzzle.match,
        reject: puzzle.reject,
      }),
    );
    child.stdin?.end();
  });
}

function selectWordPairs(spec: WordPuzzleSpec): {
  match: string[];
  reject: string[];
} {
  const corpus = loadWordCorpus();
  const minLength = spec.minLength ?? 4;
  const maxLength = spec.maxLength ?? 9;
  const eligible = corpus.filter(
    (word) => word.length >= minLength && word.length <= maxLength,
  );
  const match = collectWords(eligible, spec.matchStart, spec.matchStride, (word) =>
    spec.predicate(word),
  );
  const reject = collectWords(
    eligible,
    spec.rejectStart,
    spec.rejectStride,
    (word) => !spec.predicate(word),
  );

  if (match.length < MATCHES_PER_PUZZLE) {
    throw new Error(
      `Puzzle "${spec.name}" only produced ${match.length} match words.`,
    );
  }

  if (reject.length < REJECTS_PER_PUZZLE) {
    throw new Error(
      `Puzzle "${spec.name}" only produced ${reject.length} reject words.`,
    );
  }

  return { match, reject };
}

function collectWords(
  corpus: string[],
  start: number,
  stride: number,
  predicate: (word: string) => boolean,
): string[] {
  const collected: string[] = [];
  const seen = new Set<string>();
  const limit = corpus.length;

  for (let step = 0; step < limit && collected.length < MATCHES_PER_PUZZLE; step += 1) {
    const word = corpus[(start + step * stride) % limit];

    if (!predicate(word) || seen.has(word)) {
      continue;
    }

    seen.add(word);
    collected.push(word);
  }

  return collected;
}

let wordCorpusCache: string[] | null = null;

function loadWordCorpus(): string[] {
  if (wordCorpusCache) {
    return wordCorpusCache;
  }

  const words = require("an-array-of-english-words") as string[];
  wordCorpusCache = words.filter((word) => /^[a-z]+$/.test(word));

  return wordCorpusCache;
}

function hasAdjacentDuplicate(word: string): boolean {
  for (let index = 1; index < word.length; index += 1) {
    if (word[index] === word[index - 1]) {
      return true;
    }
  }

  return false;
}

function isPalindrome(word: string): boolean {
  return word === [...word].reverse().join("");
}

function generateMultiplesOfFivePuzzle(): { match: string[]; reject: string[] } {
  const matchBases = [1, 3, 7, 9, 14, 20, 41, 68, 133, 200];
  const rejectBases = [2, 6, 13, 19, 24, 51, 88, 97, 141, 233];

  return {
    match: matchBases.map((base) => String(base * 5)),
    reject: rejectBases.map((base) => String(base)),
  };
}

function generateBinaryPuzzle(): { match: string[]; reject: string[] } {
  return {
    match: takeEvery(
      enumerateStrings(["0", "1"], 5),
      6,
      (value) => /^[01]+$/.test(value),
    ),
    reject: takeEvery(
      enumerateStrings(["0", "1", "2"], 4),
      7,
      (value) => value.includes("2"),
    ),
  };
}

function generateOctetPuzzle(): { match: string[]; reject: string[] } {
  const match: string[] = [];

  for (let value = 0; value <= 255 && match.length < MATCHES_PER_PUZZLE; value += 26) {
    match.push(String(value));
  }

  const reject: string[] = [];

  for (
    let value = 256;
    value <= 999 && reject.length < REJECTS_PER_PUZZLE;
    value += 47
  ) {
    reject.push(String(value));
  }

  return { match, reject };
}

function generateHexColorPuzzle(): { match: string[]; reject: string[] } {
  const matchPairs: Array<[value: number, length: number]> = [
    [5, 3],
    [3500, 6],
    [200, 3],
    [4096, 6],
    [255, 3],
    [55000, 6],
    [10, 3],
    [123456, 6],
    [3725, 3],
    [999999, 6],
  ];
  const rejectPairs: Array<[value: number, length: number]> = [
    [10, 4],
    [200, 5],
    [255, 7],
    [3500, 8],
    [4096, 2],
    [15, 1],
    [37, 4],
    [488, 5],
    [9181, 7],
    [27, 2],
  ];

  return {
    match: matchPairs.map(([value, length]) =>
      `#${value.toString(16).padStart(length, "0")}`,
    ),
    reject: rejectPairs.map(([value, length]) =>
      `#${value.toString(16).padStart(length, "0")}`,
    ),
  };
}

const ROMAN_VALUES: Array<[number, string]> = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

const CANONICAL_ROMAN_PATTERN =
  /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

function toRoman(value: number): string {
  let remaining = value;
  let roman = "";

  for (const [amount, symbol] of ROMAN_VALUES) {
    while (remaining >= amount) {
      roman += symbol;
      remaining -= amount;
    }
  }

  return roman;
}

function generateRomanPuzzle(): { match: string[]; reject: string[] } {
  const match = [3, 9, 14, 23, 38, 42, 46, 54, 61, 75].map(toRoman);
  const reject = takeEvery(
    enumerateStrings(["I", "V", "X", "L", "C", "D", "M"], 4),
    1,
    (value) => !CANONICAL_ROMAN_PATTERN.test(value),
  );

  return { match, reject };
}

function enumerateStrings(
  alphabet: string[],
  maxLength: number,
): string[] {
  const values: string[] = [];

  for (let length = 1; length <= maxLength; length += 1) {
    const total = alphabet.length ** length;

    for (let index = 0; index < total; index += 1) {
      let remainder = index;
      let value = "";

      for (let position = 0; position < length; position += 1) {
        value = alphabet[remainder % alphabet.length] + value;
        remainder = Math.floor(remainder / alphabet.length);
      }

      values.push(value);
    }
  }

  return values;
}

function takeEvery(
  values: string[],
  stride: number,
  predicate: (value: string) => boolean,
): string[] {
  const collected: string[] = [];
  let seen = 0;

  for (const value of values) {
    if (!predicate(value)) {
      continue;
    }

    if (seen % stride === 0) {
      collected.push(value);
    }

    seen += 1;

    if (collected.length >= MATCHES_PER_PUZZLE) {
      break;
    }
  }

  return collected;
}

function extractRegex(rawResponse: string): string {
  let candidate = rawResponse.trim();

  const fence = candidate.match(/```(?:\w+)?\s*([\s\S]*?)```/);

  if (fence) {
    candidate = fence[1].trim();
  }

  candidate = candidate
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)[0] ?? candidate;

  candidate = candidate.replace(/^[\s`'"]+|[\s`'"]+$/g, "");

  if (
    candidate.length >= 2 &&
    candidate.startsWith("/") &&
    candidate.endsWith("/")
  ) {
    candidate = candidate.slice(1, -1);
  }

  return candidate;
}

function buildChatRequest(input: {
  modelId: string;
  messages: ChatMessage[];
  mode: ChatRequestMode;
  omitTemperature?: boolean;
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
    temperature: input.omitTemperature ? undefined : 0,
    ...(requestOverride.reasoning
      ? {
          reasoning: requestOverride.reasoning,
        }
      : useReasoningExclude
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
  const modes: Array<"strict" | "relaxed" | "minimal"> = [
    "strict",
    "relaxed",
    "minimal",
  ];
  let modeIndex = 0;
  let omitTemperature = false;
  let lastError: Error | null = null;

  while (modeIndex < modes.length) {
    const mode = modes[modeIndex];
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
            omitTemperature,
          }),
        ),
        signal: controller.signal,
      });

      if (response.ok) {
        return (await response.json()) as OpenRouterChatResponse;
      }

      const errorText = await response.text();

      if (
        response.status === 400 &&
        errorText.toLowerCase().includes("temperature") &&
        !omitTemperature
      ) {
        omitTemperature = true;
        continue;
      }

      if (
        response.status === 404 &&
        errorText.includes("requested parameters") &&
        mode !== "minimal"
      ) {
        lastError = new Error(
          `OpenRouter chat request failed in ${mode} mode: ${response.status} ${errorText}`,
        );
        modeIndex += 1;
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
