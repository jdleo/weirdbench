import { getBenchmarkScore, upsertBenchmarkScore } from "@/lib/benchmark-store";
import { getBenchmarkById } from "@/lib/benchmarks";
import { runHiddenRuleSequenceBenchmark } from "@/lib/hidden-rule-sequence";

const benchmarkId = "hidden-rule-sequence";
const DEFAULT_CONCURRENCY = 3;

async function main() {
  const benchmark = getBenchmarkById(benchmarkId);

  if (!benchmark) {
    throw new Error(`Unknown benchmark: ${benchmarkId}`);
  }

  const args = process.argv.slice(2);
  const modelIds = getModelIds(args);
  const concurrency = getConcurrency(args);

  await runWithConcurrency(modelIds, concurrency, async (modelId) => {
    try {
      const existing = await getBenchmarkScore(benchmark.id, modelId);

      if (existing) {
        logResult({
          benchmarkId: benchmark.id,
          modelId,
          cached: true,
          score: existing.score,
        });
        return;
      }

      const result = await runHiddenRuleSequenceBenchmark(modelId);

      await upsertBenchmarkScore({
        benchmarkId: benchmark.id,
        modelId,
        score: result.score,
        metadata: {
          promptTemplate: result.promptTemplate,
          caseCount: result.caseCount,
          predictItemCount: result.predictItemCount,
          exactItemAccuracy: result.exactItemAccuracy,
          fullSequenceMatchRate: result.fullSequenceMatchRate,
          cases: result.cases,
        },
      });

      logResult({
        benchmarkId: benchmark.id,
        modelId,
        cached: false,
        score: result.score,
      });
    } catch (error) {
      console.log(
        JSON.stringify(
          {
            benchmarkId: benchmark.id,
            modelId,
            skipped: true,
            error: error instanceof Error ? error.message : String(error),
          },
          null,
          2,
        ),
      );
    }
  });
}

function getModelIds(args: string[]): string[] {
  const parsed = args
    .filter((arg) => !arg.startsWith("--concurrency="))
    .flatMap((arg) => arg.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  const modelIds = parsed.length > 0 ? parsed : ["openai/gpt-4o-mini"];

  return modelIds.filter(
    (value, index, allValues) => allValues.indexOf(value) === index,
  );
}

function getConcurrency(args: string[]): number {
  const flag = args.find((arg) => arg.startsWith("--concurrency="));
  const value = flag ? Number(flag.split("=")[1]) : DEFAULT_CONCURRENCY;

  if (!Number.isFinite(value) || value < 1) {
    return DEFAULT_CONCURRENCY;
  }

  return Math.floor(value);
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let currentIndex = 0;

  async function runNext(): Promise<void> {
    const index = currentIndex;
    currentIndex += 1;

    if (index >= items.length) {
      return;
    }

    await worker(items[index]);
    await runNext();
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => runNext(),
  );

  await Promise.all(workers);
}

function logResult(result: {
  benchmarkId: string;
  modelId: string;
  cached: boolean;
  score: number;
}): void {
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
