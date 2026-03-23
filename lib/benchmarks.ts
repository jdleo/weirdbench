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

export function getScoreDirectionLabel(direction: ScoreDirection): string {
  return direction === "higher" ? "Higher score is better" : "Lower score is better";
}
