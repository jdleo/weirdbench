import { sql } from "@/lib/db";
import type { BenchmarkDefinition, BenchmarkScoreRow } from "@/lib/benchmarks";

type BenchmarkScoreRecord = {
  benchmark_id: string;
  model_id: string;
  score: number;
  created_at: string;
};

type BenchmarkScoreRecordWithMetadata = BenchmarkScoreRecord & {
  metadata: unknown;
};

export async function ensureBenchmarkScoreTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS benchmark_scores (
      benchmark_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      score DOUBLE PRECISION NOT NULL,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (benchmark_id, model_id)
    );
  `;
}

export async function getScoresForBenchmark(
  benchmark: BenchmarkDefinition,
): Promise<BenchmarkScoreRow[]> {
  const rows = (await sql`
    SELECT benchmark_id, model_id, score, created_at
    FROM benchmark_scores
    WHERE benchmark_id = ${benchmark.id}
    ORDER BY
      score ${sql.unsafe(benchmark.scoreDirection === "lower" ? "ASC" : "DESC")},
      model_id ASC;
  `) as BenchmarkScoreRecord[];

  return rows.map((row) => ({
    benchmarkId: row.benchmark_id,
    modelId: row.model_id,
    score: row.score,
    createdAt: row.created_at,
  }));
}

export async function getTopModelPreview(
  benchmark: BenchmarkDefinition,
  limit = 3,
): Promise<BenchmarkScoreRow[]> {
  const rows = (await sql`
    SELECT benchmark_id, model_id, score, created_at
    FROM benchmark_scores
    WHERE benchmark_id = ${benchmark.id}
    ORDER BY
      score ${sql.unsafe(benchmark.scoreDirection === "lower" ? "ASC" : "DESC")},
      model_id ASC
    LIMIT ${limit};
  `) as BenchmarkScoreRecord[];

  return rows.map((row) => ({
    benchmarkId: row.benchmark_id,
    modelId: row.model_id,
    score: row.score,
    createdAt: row.created_at,
  }));
}

export async function getBenchmarkScore(
  benchmarkId: string,
  modelId: string,
): Promise<BenchmarkScoreRow | null> {
  const rows = (await sql`
    SELECT benchmark_id, model_id, score, metadata, created_at
    FROM benchmark_scores
    WHERE benchmark_id = ${benchmarkId} AND model_id = ${modelId}
    LIMIT 1;
  `) as BenchmarkScoreRecordWithMetadata[];

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    benchmarkId: row.benchmark_id,
    modelId: row.model_id,
    score: row.score,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

export async function upsertBenchmarkScore(
  row: BenchmarkScoreRow,
): Promise<void> {
  await sql`
    INSERT INTO benchmark_scores (benchmark_id, model_id, score, metadata)
    VALUES (${row.benchmarkId}, ${row.modelId}, ${row.score}, ${JSON.stringify(row.metadata ?? null)}::jsonb)
    ON CONFLICT (benchmark_id, model_id)
    DO UPDATE SET
      score = EXCLUDED.score,
      metadata = EXCLUDED.metadata,
      created_at = NOW();
  `;
}
