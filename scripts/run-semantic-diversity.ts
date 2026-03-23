import { getBenchmarkScore, upsertBenchmarkScore } from "@/lib/benchmark-store";
import { getBenchmarkById } from "@/lib/benchmarks";
import { runSemanticDiversityBenchmark } from "@/lib/semantic-diversity";

const benchmarkId = "semantic-diversity";

async function main() {
  const benchmark = getBenchmarkById(benchmarkId);

  if (!benchmark) {
    throw new Error(`Unknown benchmark: ${benchmarkId}`);
  }

  const modelIds = getModelIds(process.argv.slice(2));

  for (const modelId of modelIds) {
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
      continue;
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
}

function getModelIds(args: string[]): string[] {
  const parsed = args
    .flatMap((arg) => arg.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  const modelIds = parsed.length > 0 ? parsed : ["openai/gpt-4o-mini"];

  return modelIds.filter(
    (value, index, allValues) => allValues.indexOf(value) === index,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
