export type ScoreDirection = "higher" | "lower";

export type BenchmarkDefinition = {
  id: string;
  name: string;
  scoreDirection: ScoreDirection;
  description?: string;
  topModelPreview?: string[];
};

export type BenchmarkScoreRow = {
  benchmarkId: BenchmarkDefinition["id"];
  modelId: string;
  score: number;
};

export function defineBenchmark(
  benchmark: BenchmarkDefinition,
): BenchmarkDefinition {
  return benchmark;
}

export const benchmarkRegistry: BenchmarkDefinition[] = [
  defineBenchmark({
    id: "strange-loop",
    name: "Strange Loop",
    scoreDirection: "higher",
    description:
      "Mock benchmark preview for unconventional reasoning, odd edge cases, and tasks standard evals usually ignore.",
    topModelPreview: ["gpt-5", "claude-opus-4.1", "gemini-2.5-pro"],
  }),
];

export const benchmarkScoreRows: BenchmarkScoreRow[] = [
  { benchmarkId: "strange-loop", modelId: "gpt-5", score: 91.4 },
  { benchmarkId: "strange-loop", modelId: "claude-opus-4.1", score: 88.7 },
  { benchmarkId: "strange-loop", modelId: "gemini-2.5-pro", score: 84.9 },
  { benchmarkId: "strange-loop", modelId: "o4-mini", score: 79.3 },
  { benchmarkId: "strange-loop", modelId: "llama-4-maverick", score: 73.8 },
];

export function getBenchmarkById(id: string): BenchmarkDefinition | undefined {
  return benchmarkRegistry.find((benchmark) => benchmark.id === id);
}

export function getScoresForBenchmark(id: string): BenchmarkScoreRow[] {
  const benchmark = getBenchmarkById(id);

  if (!benchmark) {
    return [];
  }

  return benchmarkScoreRows
    .filter((row) => row.benchmarkId === id)
    .sort((left, right) =>
      benchmark.scoreDirection === "higher"
        ? right.score - left.score
        : left.score - right.score,
    );
}

export function getScoreDirectionLabel(direction: ScoreDirection): string {
  return direction === "higher" ? "Higher score is better" : "Lower score is better";
}
