import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { getIntelligenceIndex } from "@/lib/intelligence-index";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "WeirdBench Intelligence Index",
  description:
    "A consolidated WeirdBench ranking across all benchmarks, normalized across mixed score directions and adjusted for benchmark coverage.",
  alternates: {
    canonical: "/intelligence-index",
  },
  openGraph: {
    type: "website",
    url: `${siteConfig.url}/intelligence-index`,
    title: "WeirdBench Intelligence Index",
    description:
      "A consolidated WeirdBench ranking across all benchmarks, normalized across mixed score directions and adjusted for benchmark coverage.",
    siteName: siteConfig.name,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: "WeirdBench Intelligence Index preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "WeirdBench Intelligence Index",
    description:
      "A consolidated WeirdBench ranking across all benchmarks, normalized across mixed score directions and adjusted for benchmark coverage.",
    images: [siteConfig.ogImage],
    creator: siteConfig.xHandle,
  },
};

export default async function IntelligenceIndexPage() {
  const entries = await getIntelligenceIndex();
  const benchmarkCount =
    entries[0]?.totalBenchmarks ?? 0;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "WeirdBench Intelligence Index",
    description:
      "A consolidated WeirdBench ranking across all benchmarks, normalized into a shared 0-100 scale and adjusted for benchmark coverage.",
    url: `${siteConfig.url}/intelligence-index`,
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
      "Each benchmark leaderboard is converted into a 0-100 normalized rank score, then each model's average is multiplied by benchmark coverage ratio.",
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
                  Consolidated leaderboard
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
              <p className="shell-label">index</p>
              <h1 className="mt-3 text-[2rem] font-medium tracking-[var(--tracking-tight)] text-[var(--color-text)] sm:text-[2.4rem]">
                WeirdBench Intelligence Index
              </h1>
              <p className="shell-copy mt-3 max-w-2xl text-sm sm:text-base">
                A single ranking across every WeirdBench benchmark. Raw scores are
                first converted into benchmark-local rank scores so lower-is-better
                and higher-is-better benchmarks can live in the same table.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="shell-pill px-3 py-1 text-xs">
                {benchmarkCount} benchmark{benchmarkCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </section>

        <section className="shell-panel mt-4 rounded-[2rem] p-4 sm:p-5">
          <div className="grid gap-3">
            {entries.length > 0 ? (
              <div className="grid gap-3">
                {entries.map((entry, index) => (
                  <article
                    key={entry.modelId}
                    className="shell-card rounded-[1.5rem] p-5"
                  >
                    <div className="flex flex-col gap-4">
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
                              {entry.modelId}
                            </p>
                            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                              Coverage {entry.coverageCount}/{entry.totalBenchmarks}
                              {" · "}
                              Avg benchmark score {entry.averageNormalizedScore.toFixed(1)}
                            </p>
                          </div>
                        </div>
                        <div className="score-chip">
                          {entry.overallScore.toFixed(2)}
                        </div>
                      </div>

                      <div className="grid gap-2">
                        {entry.benchmarkScores.map((score) => (
                          <div
                            key={`${entry.modelId}-${score.benchmarkId}`}
                            className="result-row"
                          >
                            <span>
                              {score.benchmarkName}
                              <span className="ml-2 text-[var(--color-text-muted)]">
                                {score.rawScore.toFixed(4)}
                              </span>
                            </span>
                            <span>{score.normalizedScore.toFixed(1)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <section className="shell-card rounded-[1.5rem] p-5 sm:p-6">
                <p className="shell-copy text-sm sm:text-base">
                  Run local benchmark scripts to populate Neon, then reload this
                  page.
                </p>
              </section>
            )}
          </div>
        </section>

        <section className="shell-panel mt-4 rounded-[2rem] p-5 sm:p-6">
          <div className="grid gap-5">
            <div>
              <p className="shell-label">Methodology</p>
              <h2 className="shell-title mt-3">How index scoring works</h2>
              <p className="shell-copy mt-3 max-w-3xl text-sm sm:text-base">
                Each benchmark is ranked independently and converted into a
                normalized 0-100 scale, where 100 is first place and 0 is last
                place for that benchmark. This avoids mixing incompatible raw
                score scales and automatically respects both lower-is-better and
                higher-is-better benchmarks.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <article className="shell-card rounded-[1.5rem] p-5">
                <p className="shell-label">Normalization</p>
                <p className="shell-copy mt-3 text-sm">
                  A model gets a benchmark-local rank score from 0 to 100 based
                  on its leaderboard position within that benchmark.
                </p>
              </article>
              <article className="shell-card rounded-[1.5rem] p-5">
                <p className="shell-label">Coverage</p>
                <p className="shell-copy mt-3 text-sm">
                  Models missing benchmarks are not dropped. Their average is
                  multiplied by benchmark coverage ratio so partial coverage is
                  visible and penalized.
                </p>
              </article>
              <article className="shell-card rounded-[1.5rem] p-5">
                <p className="shell-label">Final Score</p>
                <p className="shell-copy mt-3 text-sm">
                  Final index = average normalized benchmark score × coverage
                  ratio. Higher is better.
                </p>
              </article>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
