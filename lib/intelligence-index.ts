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
      new Map(
        scores.map((score, index) => [
          score.modelId,
          {
            benchmarkId: benchmark.id,
            benchmarkName: benchmark.name,
            rawScore: score.score,
            normalizedScore: getNormalizedRankScore(index, scores.length),
          },
        ]),
      ),
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

function getNormalizedRankScore(index: number, count: number): number {
  if (count <= 1) {
    return 100;
  }

  return ((count - 1 - index) / (count - 1)) * 100;
}
