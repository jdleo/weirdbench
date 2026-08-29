import Link from "next/link";
import { benchmarkRegistry } from "@/lib/benchmarks";
import { getTopModelPreview } from "@/lib/benchmark-store";
import { siteConfig } from "@/lib/site";
import { ArrowUpRightIcon, PageShell } from "@/components/chrome";

export const revalidate = 60;

export default async function Home() {
  const benchmarks = benchmarkRegistry;
  const benchmarkPreviews = await Promise.all(
    benchmarks.map(async (benchmark) => ({
      benchmark,
      topScores: await getTopModelPreview(benchmark, 3),
    })),
  );
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
    },
    hasPart: benchmarkPreviews.map(({ benchmark }) => ({
      "@type": "Dataset",
      name: benchmark.name,
      description: benchmark.description,
      url: `${siteConfig.url}/benchmarks/${benchmark.id}`,
    })),
  };

  return (
    <PageShell activeId="home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="el-hero">
        <div className="el-hero-inner">
          <div className="el-hero-copy">
            <h1>
              WeirdBench
              <span className="el-hero-cursor" aria-hidden="true" />
            </h1>
            <p className="el-hero-sub">
              Unconventional LLM benchmarks for the weird corners other evals
              skip. Definitions and runners live locally, scores are published
              openly.
            </p>

            <div className="el-hero-actions">
              <a href="#benchmarks" className="el-btn el-btn-dark">
                Browse benchmarks
                <ArrowUpRightIcon />
              </a>
              <Link href="/intelligence-index" className="el-btn el-btn-light">
                Read the index
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="el-section" aria-label="Intelligence Index">
        <Link href="/intelligence-index" className="el-latest">
          <div className="el-eyebrow">
            <span>Consolidated ranking</span>
            <span>
              {benchmarks.length} benchmark{benchmarks.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="el-latest-row">
            <h2>WeirdBench Intelligence Index</h2>
          </div>
          <p>
            A single ranking across every WeirdBench benchmark. Raw scores are
            normalized relative to each benchmark leader, then adjusted for
            coverage — so higher-is-better and lower-is-better benchmarks share
            one honest table.
          </p>
        </Link>
      </section>

      <section id="benchmarks" className="el-section" aria-label="Benchmarks">
        <div className="el-list-head">
          <h3>Benchmarks</h3>
          <Link href="/intelligence-index" className="el-list-more">
            Full index
          </Link>
        </div>
        <div className="el-cards">
          {benchmarkPreviews.map(({ benchmark, topScores }) => {
            return (
              <Link
                key={benchmark.id}
                href={`/benchmarks/${benchmark.id}`}
                className="el-card"
              >
                <h3 className="el-card-name">{benchmark.name}</h3>
                {benchmark.description ? (
                  <p className="el-card-desc">{benchmark.description}</p>
                ) : null}
                <div className="el-card-board">
                  <p className="el-card-board-label">Leaderboard preview</p>
                  {topScores.length > 0 ? (
                    topScores.map((row, index) => (
                      <div
                        key={row.modelId}
                        className="el-card-board-row"
                      >
                        <span className="el-card-board-rank">
                          {index + 1}
                        </span>
                        <span className="el-card-board-name">
                          {row.modelId}
                        </span>
                        <span className="el-card-board-score">
                          {row.score.toFixed(3)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="el-card-empty">No scores yet.</div>
                  )}
                </div>
                <span className="el-card-foot">View benchmark</span>
              </Link>
            );
          })}
        </div>
      </section>
    </PageShell>
  );
}
