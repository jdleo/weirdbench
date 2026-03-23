import { getBenchmarkScore, upsertBenchmarkScore } from "@/lib/benchmark-store";
import { getBenchmarkById } from "@/lib/benchmarks";
import { runSemanticDiversityBenchmark } from "@/lib/semantic-diversity";

const benchmarkId = "semantic-diversity";
const modelId = process.argv[2] ?? "openai/gpt-4o-mini";

async function main() {
  const benchmark = getBenchmarkById(benchmarkId);

  if (!benchmark) {
    throw new Error(`Unknown benchmark: ${benchmarkId}`);
  }

  const existing = await getBenchmarkScore(benchmark.id, modelId);

  if (existing) {
    console.log(
      JSON.stringify(
        {
          benchmarkId: benchmark.id,
          modelId,
          cached: true,
          score: existing.score,
        },
        null,
        2,
      ),
    );
    return;
  }

  const result = await runSemanticDiversityBenchmark(modelId);

  await upsertBenchmarkScore({
    benchmarkId: benchmark.id,
    modelId,
    score: result.averageScore,
    metadata: {
      prompt: result.prompt,
      embeddingModel: result.embeddingModel,
      runs: result.runs,
    },
  });

  console.log(
    JSON.stringify(
      {
        benchmarkId: benchmark.id,
        modelId,
        cached: false,
        score: result.averageScore,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
