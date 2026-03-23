import Image from "next/image";
import Link from "next/link";
import {
  benchmarkRegistry,
  getScoreDirectionLabel,
} from "@/lib/benchmarks";
import { getTopModelPreview } from "@/lib/benchmark-store";

export default async function Home() {
  const benchmarks = benchmarkRegistry;
  const benchmarkPreviews = await Promise.all(
    benchmarks.map(async (benchmark) => ({
      benchmark,
      topScores: await getTopModelPreview(benchmark, 3),
    })),
  );

  return (
    <div className="home-page-shell">
      <main className="mx-auto flex min-h-screen w-full max-w-[96rem] flex-col px-4 py-4 sm:px-6 sm:py-6">
        <header className="shell-panel mb-4 rounded-[2rem] px-5 py-4 xl:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <Image
                src="/weirdbench-mark.png"
                alt="WeirdBench"
                width={44}
                height={44}
                className="h-11 w-11 shrink-0 object-contain opacity-95"
                priority
              />
              <div className="min-w-0">
                <p className="shell-label">WeirdBench</p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  Unconventional LLM benchmarks.
                </p>
              </div>
            </div>

            <Link
              href="https://github.com/jdleo/weirdbench"
              target="_blank"
              rel="noopener noreferrer"
              className="shell-button-secondary inline-flex items-center justify-center whitespace-nowrap px-5 py-2.5 text-sm"
            >
              GitHub
            </Link>
          </div>
        </header>

        <section className="shell-panel hero-panel rounded-[2rem] px-6 py-8 sm:px-8 sm:py-10 xl:px-10 xl:py-12">
          <div className="max-w-4xl">
            <h1 className="shell-display">
              WeirdBench tests modern LLMs on the weird corners other evals skip.
            </h1>
            <p className="shell-copy mt-5 max-w-2xl text-base sm:text-lg">
              Unconventional tasks, clear score direction, and a dead-simple score
              table. The benchmark definitions and code are written locally and
              published openly.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#benchmarks"
                className="shell-button-secondary inline-flex items-center justify-center px-6 py-3 text-sm font-medium"
              >
                View Benchmarks
              </a>
              <Link
                href="https://github.com/jdleo/weirdbench"
                target="_blank"
                rel="noopener noreferrer"
                className="shell-button-secondary inline-flex items-center justify-center px-6 py-3 text-sm font-medium"
              >
                View on GitHub
              </Link>
            </div>
          </div>
        </section>

        <section
          id="benchmarks"
          className="shell-panel home-benchmarks-panel mt-4 rounded-[2rem] p-4 sm:p-5"
        >
          <div className="grid gap-4">
            <section className="px-1 py-1">
              <h2 className="shell-title">Recent benchmarks:</h2>
            </section>

            <div className="benchmark-preview-grid gap-4">
              {benchmarkPreviews.map(({ benchmark, topScores }) => (
                <article
                  key={benchmark.id}
                  className="shell-card rounded-[1.5rem] p-5"
                >
                  <p className="shell-label">{benchmark.id}</p>
                  <h3 className="mt-3 text-xl font-medium text-[var(--color-text)]">
                    {benchmark.name}
                  </h3>
                  {benchmark.description ? (
                    <p className="shell-copy mt-3 text-sm">
                      {benchmark.description}
                    </p>
                  ) : null}
                  <div className="mt-4">
                    <p className="shell-label">Top Models</p>
                    <div className="mt-2 space-y-2">
                      {topScores.length > 0 ? (
                        topScores.map((row) => (
                          <div key={row.modelId} className="result-row">
                            <span>{row.modelId}</span>
                            <span>{row.score.toFixed(3)}</span>
                          </div>
                        ))
                      ) : (
                        <div className="result-row">
                          <span>No scores yet</span>
                          <span>run local script</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="shell-pill px-3 py-1 text-xs">
                      {getScoreDirectionLabel(benchmark.scoreDirection)}
                    </span>
                  </div>
                  <Link
                    href={`/benchmarks/${benchmark.id}`}
                    className="shell-button-secondary mt-5 inline-flex w-full items-center justify-center px-4 py-2.5 text-sm font-medium"
                  >
                    View Benchmark
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
