export type ScoreDirection = "higher" | "lower";

export type BenchmarkDefinition = {
  id: string;
  name: string;
  scoreDirection: ScoreDirection;
  description: string;
  sourceUrl?: string;
  methodology: {
    measurementTechnique: string;
    promptSummary: string;
    scoreSummary: string;
    executionSummary: string;
  };
};

export type BenchmarkScoreRow = {
  benchmarkId: BenchmarkDefinition["id"];
  modelId: string;
  score: number;
  metadata?: unknown;
  createdAt?: string;
};

export const benchmarkRegistry: BenchmarkDefinition[] = [
  {
    id: "regex-golf",
    name: "Regex Golf",
    scoreDirection: "lower",
    description:
      "Generate the shortest valid regular expression matching all 10 target strings while excluding all 10 distractor strings across 25 deterministically generated puzzles. Lower is better.",
    methodology: {
      measurementTechnique:
        "Generate 25 puzzle pairs deterministically from committed generator code (word-corpus predicates with fixed strides plus enumerated alphabets), prompt the model once per puzzle, then evaluate each submission with a local Python re.search runner and score regex length plus penalties.",
      promptSummary:
        "The model receives the MATCH and REJECT string lists and must reply with only the raw regular expression in Python re syntax.",
      scoreSummary:
        "Lower is better. Per puzzle: regex length plus 20 per missed MATCH, 20 per falsely matched REJECT, and a flat 200 for invalid regex or evaluation timeout. The benchmark score is the average across all 25 puzzles.",
      executionSummary:
        "Benchmark runners execute locally, evaluate submissions with a sandboxed Python subprocess that is killed on timeout to catch catastrophic backtracking, use OpenRouter with reasoning output excluded, cache results in Neon, and skip recomputation for models that already have stored scores.",
    },
  },
  {
    id: "ai-writing-detection",
    name: "AI Writing Detection",
    scoreDirection: "higher",
    description:
      "Classify essays from a fixed balanced sample of 50 human-written and 50 AI-generated examples from the AI Generated Essays Dataset. Higher is better.",
    sourceUrl:
      "https://www.kaggle.com/datasets/denvermagtibay/ai-generated-essays-dataset",
    methodology: {
      measurementTechnique:
        "Read a fixed deterministic sample of 50 human essays and 50 AI essays from the downloaded Kaggle dataset, prompt the model once per essay to predict whether it is AI-generated, then compute binary classification precision, recall, and F1 for the AI class.",
      promptSummary:
        'Each essay is shown once and the model must return exactly one character: "1" for AI-generated or "0" for human-written, with no explanation.',
      scoreSummary:
        "Higher is better. The benchmark score is the F1 score for detecting AI-generated essays, using label 1 as the positive class.",
      executionSummary:
        "Benchmark runners execute locally, read the dataset from disk, use OpenRouter for predictions with reasoning disabled, cache results in Neon by benchmark and model ID, and skip recomputation for models that already have stored scores.",
    },
  },
  {
    id: "nutrition-prediction",
    name: "Nutrition Prediction",
    scoreDirection: "higher",
    description:
      "Predict calories, protein, carbs, and fat from ingredient lists for a fixed 50-dish Nutrition5k sample. Higher is better.",
    sourceUrl: "https://jdleo.me/blog/nutrition-benchmark",
    methodology: {
      measurementTechnique:
        "Fetch Nutrition5k dish metadata, deterministically sample 50 dishes that have at least 3 ingredients and 100+ calories, prompt the model once per dish, then compute per-field MAPE and Pearson correlation.",
      promptSummary:
        'Given only the ingredient list, return JSON with numeric `calories`, `protein`, `carbs`, and `fat` fields and no extra text.',
      scoreSummary:
        "Higher is better. Overall score is 60% accuracy and 40% average correlation, where accuracy = 100 / (1 + average MAPE percentage).",
      executionSummary:
        "Benchmark runners execute locally, use OpenRouter for predictions, fetch the fixed Nutrition5k metadata sample, cache results in Neon, and skip recomputation for models that already have stored scores.",
    },
  },
  {
    id: "semantic-diversity",
    name: "Semantic Diversity",
    scoreDirection: "lower",
    description:
      "Generate exactly 20 English words that are maximally semantically unrelated to each other, then score the average pairwise semantic similarity. Lower is better.",
    sourceUrl: "https://jdleo.me/blog/semantic-diversity-benchmark",
    methodology: {
      measurementTechnique:
        "Generate 20 words, embed them, and score average pairwise semantic similarity.",
      promptSummary:
        "Generate exactly 20 English words and return only a JSON array of lowercase single words.",
      scoreSummary:
        "Lower is better. Lower scores mean the chosen words are less semantically related to each other.",
      executionSummary:
        "Benchmark runners execute locally, cache results in Neon, and skip recomputation for models that already have stored scores.",
    },
  },
  {
    id: "orthographic-diversity",
    name: "Orthographic Diversity",
    scoreDirection: "higher",
    description:
      "Search for 20 real English words that are maximally different in spelling under hard validity rules and deterministic penalties. Higher is better.",
    methodology: {
      measurementTechnique:
        "Generate 20 candidate words from one fixed prompt, validate them against the installed npm English word list plus format rules, then score average pairwise Levenshtein distance minus deterministic penalties.",
      promptSummary:
        "Output exactly 20 real English words, one per line, 4 to 9 letters each, lowercase only, chosen to be as orthographically different from one another as possible.",
      scoreSummary:
        "Higher is better. Raw score equals average pairwise Levenshtein distance minus penalties for invalid words, duplicates, trivial variants, shared prefixes and suffixes, and repeated character n-grams.",
      executionSummary:
        "Validation and scoring happen locally with no judge model and no human grading, and results are cached in Neon by benchmark and model ID.",
    },
  },
  {
    id: "wordle",
    name: "Wordle",
    scoreDirection: "lower",
    description:
      "Play 20 recent Wordle answers turn by turn with standard gray/yellow/green feedback. Invalid guesses still cost a turn, scores are capped at 10 turns per puzzle, and lower is better.",
    sourceUrl: "https://www.rockpapershotgun.com/wordle-past-answers",
    methodology: {
      measurementTechnique:
        "Use a fixed set of 20 recent Wordle answers, run a fresh chat loop for each puzzle, and score the average turns needed to solve while applying standard duplicate-letter feedback rules.",
      promptSummary:
        "The model is told to reply with exactly one 5-letter word per turn, that any extra text is penalized, and that duplicate letters are allowed.",
      scoreSummary:
        "Lower is better. Each puzzle score is the turn the word is solved on, or 10 if the model never solves it within 10 turns. Invalid guesses still count as turns.",
      executionSummary:
        "Benchmark runners execute locally, simulate the Wordle judge deterministically, cache results in Neon, and skip recomputation for models that already have stored scores.",
    },
  },
];

export function getBenchmarkById(id: string): BenchmarkDefinition | undefined {
  return benchmarkRegistry.find((benchmark) => benchmark.id === id);
}

export function getScoreDirectionLabel(direction: ScoreDirection): string {
  return direction === "higher"
    ? "Higher score is better"
    : "Lower score is better";
}
