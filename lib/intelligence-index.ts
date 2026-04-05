import { benchmarkRegistry, type BenchmarkScoreRow } from "@/lib/benchmarks";
import { getScoresForBenchmark } from "@/lib/benchmark-store";

export type IntelligenceIndexBenchmarkScore = {
  benchmarkId: string;
  benchmarkName: string;
  rawScore: number;
  normalizedScore: number;
};

export type IntelligenceIndexEntry = {
  modelId: string;
  overallScore: number;
  averageNormalizedScore: number;
  coverageCount: number;
  totalBenchmarks: number;
  coverageRatio: number;
  benchmarkScores: IntelligenceIndexBenchmarkScore[];
};

export async function getIntelligenceIndex(): Promise<IntelligenceIndexEntry[]> {
  const benchmarks = await Promise.all(
    benchmarkRegistry.map(async (benchmark) => ({
      benchmark,
      scores: await getScoresForBenchmark(benchmark),
    })),
  );

  const totalBenchmarks = benchmarks.length;
  const modelMap = new Map<string, BenchmarkScoreRow[]>();

  for (const { scores } of benchmarks) {
    for (const score of scores) {
      const existing = modelMap.get(score.modelId) ?? [];
      existing.push(score);
      modelMap.set(score.modelId, existing);
    }
  }

  const benchmarkScoreMaps = new Map(
    benchmarks.map(({ benchmark, scores }) => [
      benchmark.id,
      createBenchmarkScoreMap(benchmark, scores),
    ]),
  );

  return Array.from(modelMap.entries())
    .map(([modelId]) => {
      const benchmarkScores = benchmarks
        .map(({ benchmark }) => benchmarkScoreMaps.get(benchmark.id)?.get(modelId))
        .filter((score): score is IntelligenceIndexBenchmarkScore => Boolean(score));

      const coverageCount = benchmarkScores.length;
      const coverageRatio =
        totalBenchmarks > 0 ? coverageCount / totalBenchmarks : 0;
      const averageNormalizedScore =
        coverageCount > 0
          ? benchmarkScores.reduce(
              (total, score) => total + score.normalizedScore,
              0,
            ) / coverageCount
          : 0;
      const overallScore = averageNormalizedScore * coverageRatio;

      return {
        modelId,
        overallScore,
        averageNormalizedScore,
        coverageCount,
        totalBenchmarks,
        coverageRatio,
        benchmarkScores,
      };
    })
    .sort((left, right) => {
      if (right.overallScore !== left.overallScore) {
        return right.overallScore - left.overallScore;
      }

      if (right.coverageCount !== left.coverageCount) {
        return right.coverageCount - left.coverageCount;
      }

      if (right.averageNormalizedScore !== left.averageNormalizedScore) {
        return right.averageNormalizedScore - left.averageNormalizedScore;
      }

      return left.modelId.localeCompare(right.modelId);
    });
}

function createBenchmarkScoreMap(
  benchmark: (typeof benchmarkRegistry)[number],
  scores: BenchmarkScoreRow[],
): Map<string, IntelligenceIndexBenchmarkScore> {
  const normalizedScoreByModelId = getNormalizedScoreByModelId(benchmark, scores);

  return new Map(
    scores.map((score) => [
      score.modelId,
      {
        benchmarkId: benchmark.id,
        benchmarkName: benchmark.name,
        rawScore: score.score,
        normalizedScore: normalizedScoreByModelId.get(score.modelId) ?? 0,
      },
    ]),
  );
}

function getNormalizedScoreByModelId(
  benchmark: (typeof benchmarkRegistry)[number],
  scores: BenchmarkScoreRow[],
): Map<string, number> {
  if (scores.length === 0) {
    return new Map();
  }

  const rawScores = scores.map((score) => score.score);
  const bestScore = benchmark.scoreDirection === "higher"
    ? Math.max(...rawScores)
    : Math.min(...rawScores);
  const worstScore = benchmark.scoreDirection === "higher"
    ? Math.min(...rawScores)
    : Math.max(...rawScores);

  return new Map(
    scores.map((score) => [
      score.modelId,
      normalizeBenchmarkScore({
        rawScore: score.score,
        bestScore,
        worstScore,
        scoreDirection: benchmark.scoreDirection,
      }),
    ]),
  );
}

function normalizeBenchmarkScore(input: {
  rawScore: number;
  bestScore: number;
  worstScore: number;
  scoreDirection: (typeof benchmarkRegistry)[number]["scoreDirection"];
}): number {
  const { rawScore, bestScore, worstScore, scoreDirection } = input;

  if (bestScore === worstScore) {
    return 100;
  }

  if (scoreDirection === "higher") {
    if (bestScore > 0 && rawScore >= 0) {
      return clampScore((rawScore / bestScore) * 100);
    }

    return clampScore(((rawScore - worstScore) / (bestScore - worstScore)) * 100);
  }

  if (bestScore > 0 && rawScore > 0) {
    return clampScore((bestScore / rawScore) * 100);
  }

  return clampScore(((worstScore - rawScore) / (worstScore - bestScore)) * 100);
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}
