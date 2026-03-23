# WeirdBench

- Next `16.2.0`. Read local Next docs in `node_modules/next/dist/docs/` before assuming old behavior.
- Use `pnpm` only.
- This repo is for WeirdBench: an open-source site for unconventional LLM benchmarks.
- Site reads benchmark scores from Neon Postgres.
- Benchmarks run locally. Do not move benchmark execution into the web app.

# Architecture

- Benchmark definitions live in `lib/benchmarks.ts`.
- DB access lives in `lib/db.ts` and `lib/benchmark-store.ts`.
- Local benchmark logic lives in `lib/semantic-diversity.ts` and `scripts/`.
- Website pages only read from DB and render leaderboards.

# Data Rules

- Cache scores in DB by `(benchmark_id, model_id)`.
- Never recompute a model if a score already exists, unless explicitly asked.
- If a model fails during batch benchmark runs, skip it and continue.
- Current score table is intentionally simple: `benchmark_id`, `model_id`, `score`, `metadata`, `created_at`.
- Prefer bounded concurrency in runner scripts for model-level work; current default is parallel across models with a small cap, while each model still does cache -> run -> write sequentially.

# OpenRouter Rules

- Use `reasoning: { exclude: true }` for benchmark generation tasks.
- Parse multiple content shapes. Do not assume `message.content` is always a plain string.
- Prefer resilient retries over hard failure for malformed outputs.
- For provider routing, use OpenRouter raw HTTP field names, not SDK-style names.
- Current runner may use provider overrides for broken models. Keep them isolated in benchmark code.

# SEO / Content Rules

- Keep benchmark pages crawlable and content-rich, not just UI.
- Maintain `robots.ts`, `sitemap.ts`, `llms.txt`, JSON-LD, canonical metadata, OG/Twitter metadata.
- Use `public/og-image.png` as the default social preview unless intentionally changing it.

# UI Rules

- Main page and benchmark pages use route-level background wrappers to avoid visible background breaks.
- Keep styling restrained and dark; do not reintroduce noisy fake product UI.
- Homepage benchmark cards should show actual top scores from DB, not placeholders.

# Commands

- Dev: `pnpm dev`
- Lint: `pnpm lint`
- Build: `pnpm build`
- Init DB: `pnpm db:init`
- Run semantic diversity:
  - `pnpm benchmark:semantic-diversity <model-id>`
  - supports multiple args or comma-separated model IDs

# Contributing

- Do work on a feature branch, not directly on `main`.
- Open a PR for changes.
- Commits should use conventional commit style.
- Example: `feat: add semantic diversity benchmark retries`
