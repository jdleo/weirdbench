import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getBenchmarkById,
  getScoreDirectionLabel,
} from "@/lib/benchmarks";
import { getScoresForBenchmark } from "@/lib/benchmark-store";

export default async function BenchmarkPage(props: PageProps<"/benchmarks/[id]">) {
  const { id } = await props.params;
  const benchmark = getBenchmarkById(id);

  if (!benchmark) {
    notFound();
  }

  const scores = await getScoresForBenchmark(benchmark);

  return (
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
                Benchmark leaderboard
              </p>
            </div>
          </div>

          <Link
            href="/"
            className="shell-button-secondary inline-flex items-center justify-center whitespace-nowrap px-5 py-2.5 text-sm"
          >
            Back Home
          </Link>
        </div>
      </header>

      <section className="shell-panel rounded-[2rem] px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="shell-label">{benchmark.id}</p>
            <h1 className="mt-3 text-[2rem] font-medium tracking-[var(--tracking-tight)] text-[var(--color-text)] sm:text-[2.4rem]">
              {benchmark.name}
            </h1>
            <p className="shell-copy mt-3 max-w-2xl text-sm sm:text-base">
              {benchmark.description}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="shell-pill px-3 py-1 text-xs">
              {getScoreDirectionLabel(benchmark.scoreDirection)}
            </span>
          </div>
        </div>
      </section>

      <section className="shell-panel mt-4 rounded-[2rem] p-4 sm:p-5">
        <div className="grid gap-3">
          {scores.length > 0 ? (
            <div className="grid gap-3">
              {scores.map((row, index) => (
                <article
                  key={`${row.benchmarkId}-${row.modelId}`}
                  className="shell-card rounded-[1.5rem] p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <div
                        className={`rank-badge ${
                          index === 0
                            ? "rank-badge-gold"
                            : index === 1
                              ? "rank-badge-silver"
                              : index === 2
                                ? "rank-badge-bronze"
                                : ""
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-lg font-medium text-[var(--color-text)]">
                          {row.modelId}
                        </p>
                      </div>
                    </div>
                    <div className="score-chip">{row.score.toFixed(3)}</div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <section className="shell-card rounded-[1.5rem] p-5 sm:p-6">
              <p className="shell-copy text-sm sm:text-base">
                Run the local benchmark script to populate Neon, then reload
                this page.
              </p>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
