import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getBenchmarkById,
  getScoreDirectionLabel,
} from "@/lib/benchmarks";
import { getScoresForBenchmark } from "@/lib/benchmark-store";
import { siteConfig } from "@/lib/site";

export async function generateMetadata(
  props: PageProps<"/benchmarks/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const benchmark = getBenchmarkById(id);

  if (!benchmark) {
    return {
      title: "Benchmark Not Found",
    };
  }

  const title = `${benchmark.name} Benchmark Leaderboard`;
  const description = `${benchmark.description} ${getScoreDirectionLabel(
    benchmark.scoreDirection,
  )}.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/benchmarks/${benchmark.id}`,
    },
    openGraph: {
      type: "website",
      url: `${siteConfig.url}/benchmarks/${benchmark.id}`,
      title,
      description,
      siteName: siteConfig.name,
      images: [
        {
          url: siteConfig.ogImage,
          width: 1200,
          height: 630,
          alt: `${benchmark.name} benchmark preview`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [siteConfig.ogImage],
      creator: siteConfig.xHandle,
    },
  };
}

export default async function BenchmarkPage(props: PageProps<"/benchmarks/[id]">) {
  const { id } = await props.params;
  const benchmark = getBenchmarkById(id);

  if (!benchmark) {
    notFound();
  }

  const scores = await getScoresForBenchmark(benchmark);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: benchmark.name,
    description: benchmark.description,
    url: `${siteConfig.url}/benchmarks/${benchmark.id}`,
    creator: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
    },
    includedInDataCatalog: {
      "@type": "DataCatalog",
      name: siteConfig.name,
      url: siteConfig.url,
    },
    measurementTechnique:
      "Generate 20 words, embed them, and score average pairwise semantic similarity.",
    variableMeasured: benchmark.scoreDirection,
  };

  return (
    <div className="benchmark-page-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
                      <div className="score-chip">{row.score.toFixed(4)}</div>
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

        <section className="shell-panel mt-4 rounded-[2rem] p-5 sm:p-6">
          <div className="grid gap-5">
            <div>
              <p className="shell-label">Methodology</p>
              <h2 className="shell-title mt-3">How scoring works</h2>
              <p className="shell-copy mt-3 max-w-3xl text-sm sm:text-base">
                Semantic Diversity asks a model to generate exactly 20 lowercase
                English words that are as semantically unrelated as possible.
                Each word is embedded, cosine similarity is computed for every
                pair, and the final benchmark score is the average of those
                similarities.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <article className="shell-card rounded-[1.5rem] p-5">
                <p className="shell-label">Prompt</p>
                <p className="shell-copy mt-3 text-sm">
                  Generate exactly 20 English words and return only a JSON array
                  of lowercase single words.
                </p>
              </article>
              <article className="shell-card rounded-[1.5rem] p-5">
                <p className="shell-label">Score</p>
                <p className="shell-copy mt-3 text-sm">
                  Lower is better. Lower scores mean the chosen words are less
                  semantically related to each other.
                </p>
              </article>
              <article className="shell-card rounded-[1.5rem] p-5">
                <p className="shell-label">Execution</p>
                <p className="shell-copy mt-3 text-sm">
                  Benchmark runners execute locally, cache results in Neon, and
                  skip recomputation for models that already have stored scores.
                </p>
              </article>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
