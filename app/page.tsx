import Link from "next/link";
import {
  benchmarkRegistry,
  getScoreDirectionLabel,
} from "@/lib/benchmarks";
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
  const leader = benchmarkPreviews[0]?.topScores[0];
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

            <div className="el-hero-meta">
              <span>Open source</span>
              <span className="el-meta-dot" aria-hidden="true" />
              <span>{benchmarks.length} benchmarks</span>
              <span className="el-meta-dot" aria-hidden="true" />
              <span>Runners execute locally</span>
              {leader ? (
                <>
                  <span className="el-meta-dot" aria-hidden="true" />
                  <span>
                    Current leader: {leader.modelId} · {leader.score.toFixed(3)}
                  </span>
                </>
              ) : null}
            </div>
          </div>

          <div className="el-hero-art">
            <div className="el-ghost-fallback" aria-hidden="true" />
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
            <span className="el-arrow" aria-hidden="true">
              <ArrowUpRightIcon />
            </span>
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
            <ArrowUpRightIcon />
          </Link>
        </div>
        <ul className="el-list">
          {benchmarkPreviews.map(({ benchmark, topScores }) => {
            const top = topScores[0];
            return (
              <li key={benchmark.id}>
                <Link
                  href={`/benchmarks/${benchmark.id}`}
                  className="el-row el-post-row"
                >
                  <div>
                    <div className="el-post-meta">
                      <span>{benchmark.id}</span>
                      <span>{getScoreDirectionLabel(benchmark.scoreDirection)}</span>
                      {top ? (
                        <span>
                          top: {top.modelId} · {top.score.toFixed(3)}
                        </span>
                      ) : (
                        <span>no scores yet</span>
                      )}
                    </div>
                    <h2>{benchmark.name}</h2>
                    {benchmark.description ? <p>{benchmark.description}</p> : null}
                  </div>
                  <span className="el-arrow" aria-hidden="true">
                    <ArrowUpRightIcon />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </PageShell>
  );
}
