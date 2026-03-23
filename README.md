# WeirdBench

WeirdBench is an unconventional LLM benchmarking site.

The site reads benchmark scores from Neon Postgres.
Benchmark execution happens locally.

## How It Works

- Benchmark definitions live in [`lib/benchmarks.ts`](/Users/johnleonardo/Documents/workspace/weirdbench/lib/benchmarks.ts).
- The website reads leaderboard data from Neon through [`lib/benchmark-store.ts`](/Users/johnleonardo/Documents/workspace/weirdbench/lib/benchmark-store.ts).
- Benchmark runner scripts execute locally, use your local env vars, and write scores into the database.
- Scores are cached in Postgres by `(benchmark_id, model_id)`, so an existing model score is never recomputed unless you explicitly delete it.

## Current Benchmark

- `semantic-diversity`
  - Source: [The Semantic Diversity Benchmark](https://jdleo.me/blog/semantic-diversity-benchmark)
  - Task: generate exactly 20 English words that are maximally semantically unrelated
  - Scoring: average pairwise semantic similarity
  - Ranking: lower is better

## Environment

Expected in `.env.local`:

- `DATABASE_URL`
- `OPENROUTER_API_KEY`

## Install

```bash
pnpm install
```

## Run The Site

```bash
pnpm dev
```

## Initialize The DB

```bash
pnpm db:init
```

This is required before running the app or benchmark scripts against a fresh database. Runtime code does not auto-create tables.

## Add A Model To Semantic Diversity

```bash
pnpm benchmark:semantic-diversity <model-id>
```

Examples:

```bash
pnpm benchmark:semantic-diversity google/gemini-2.5-pro
pnpm benchmark:semantic-diversity anthropic/claude-opus-4.1
pnpm benchmark:semantic-diversity openai/gpt-5
pnpm benchmark:semantic-diversity google/gemini-2.5-pro,anthropic/claude-opus-4.1,openai/gpt-5
pnpm benchmark:semantic-diversity google/gemini-2.5-pro anthropic/claude-opus-4.1 openai/gpt-5
```

Behavior:

- Runs locally.
- Uses `OPENROUTER_API_KEY`.
- Writes the score to Neon using `DATABASE_URL`.
- Returns cached data immediately if that model already has a stored score.

## Common Commands

```bash
pnpm dev
pnpm lint
pnpm build
pnpm db:init
pnpm benchmark:semantic-diversity <model-id>
```

## Relevant Files

- [app/page.tsx](/Users/johnleonardo/Documents/workspace/weirdbench/app/page.tsx)
- [app/benchmarks/[id]/page.tsx](/Users/johnleonardo/Documents/workspace/weirdbench/app/benchmarks/[id]/page.tsx)
- [lib/benchmarks.ts](/Users/johnleonardo/Documents/workspace/weirdbench/lib/benchmarks.ts)
- [lib/benchmark-store.ts](/Users/johnleonardo/Documents/workspace/weirdbench/lib/benchmark-store.ts)
- [lib/semantic-diversity.ts](/Users/johnleonardo/Documents/workspace/weirdbench/lib/semantic-diversity.ts)
- [scripts/init-db.ts](/Users/johnleonardo/Documents/workspace/weirdbench/scripts/init-db.ts)
- [scripts/run-semantic-diversity.ts](/Users/johnleonardo/Documents/workspace/weirdbench/scripts/run-semantic-diversity.ts)
