export type ScoreDirection = "higher" | "lower";

export type BenchmarkDefinition = {
  id: string;
  name: string;
  scoreDirection: ScoreDirection;
  description: string;
  sourceUrl?: string;
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
