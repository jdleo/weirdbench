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
];

export function getBenchmarkById(id: string): BenchmarkDefinition | undefined {
  return benchmarkRegistry.find((benchmark) => benchmark.id === id);
}

export function getScoreDirectionLabel(direction: ScoreDirection): string {
  return direction === "higher"
    ? "Higher score is better"
    : "Lower score is better";
}
