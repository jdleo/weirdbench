import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getBenchmarkById,
  getScoreDirectionLabel,
} from "@/lib/benchmarks";
import { getScoresForBenchmark } from "@/lib/benchmark-store";
import { siteConfig } from "@/lib/site";
import { ArrowUpRightIcon, PageShell } from "@/components/chrome";

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
    measurementTechnique: benchmark.methodology.measurementTechnique,
    variableMeasured: benchmark.scoreDirection,
  };

  return (
    <PageShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="el-hero el-hero-page">
        <div className="el-hero-inner">
          <div className="el-hero-copy">
            <div className="el-eyebrow">
              <span>{benchmark.id}</span>
              <span>{getScoreDirectionLabel(benchmark.scoreDirection)}</span>
            </div>
            <h1>{benchmark.name}</h1>
            <p className="el-hero-sub">{benchmark.description}</p>

            <div className="el-tag-row">
              <span className="el-tag">
                {getScoreDirectionLabel(benchmark.scoreDirection)}
              </span>
              <span className="el-tag">{scores.length} models scored</span>
              <span className="el-tag">Cached in Neon Postgres</span>
            </div>
          </div>
        </div>
      </section>

      <section className="el-section" aria-label="Leaderboard">
        <div className="el-list-head">
          <h3>Leaderboard</h3>
          <Link href="/intelligence-index" className="el-list-more">
            Intelligence Index
            <ArrowUpRightIcon />
          </Link>
        </div>
        {scores.length > 0 ? (
          <ul className="el-list">
            {scores.map((row, index) => (
              <li key={`${row.benchmarkId}-${row.modelId}`}>
                <div className="el-board-row">
                  <span
                    className={`el-rank${index === 0 ? " el-rank-leader" : ""}`}
                  >
                    {index + 1}
                  </span>
                  <div className="el-board-main">
                    <p className="el-board-name">{row.modelId}</p>
                  </div>
                  <span className="el-score">{row.score.toFixed(4)}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="el-empty">
            No scores yet. Run the local benchmark script to populate Neon,
            then reload this page.
          </p>
        )}
      </section>

      <section className="el-section" aria-label="Methodology">
        <div className="el-eyebrow">
          <span>Methodology</span>
          <span>How scoring works</span>
        </div>
        <div className="el-facts">
          <div>
            <p className="el-fact-label">Prompt</p>
            <p className="el-fact-copy">
              {benchmark.methodology.promptSummary}
            </p>
          </div>
          <div>
            <p className="el-fact-label">Score</p>
            <p className="el-fact-copy">
              {benchmark.methodology.scoreSummary}
            </p>
          </div>
          <div>
            <p className="el-fact-label">Execution</p>
            <p className="el-fact-copy">
              {benchmark.methodology.executionSummary}
            </p>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
