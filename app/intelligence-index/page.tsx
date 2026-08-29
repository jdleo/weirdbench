import type { Metadata } from "next";
import { siteConfig } from "@/lib/site";
import { getIntelligenceIndex } from "@/lib/intelligence-index";
import { PageShell } from "@/components/chrome";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "WeirdBench Intelligence Index",
  description:
    "A consolidated WeirdBench ranking across all benchmarks, normalized relative to each benchmark leader and adjusted for benchmark coverage.",
  alternates: {
    canonical: "/intelligence-index",
  },
  openGraph: {
    type: "website",
    url: `${siteConfig.url}/intelligence-index`,
    title: "WeirdBench Intelligence Index",
    description:
      "A consolidated WeirdBench ranking across all benchmarks, normalized relative to each benchmark leader and adjusted for benchmark coverage.",
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
      "A consolidated WeirdBench ranking across all benchmarks, normalized relative to each benchmark leader and adjusted for benchmark coverage.",
    images: [siteConfig.ogImage],
    creator: siteConfig.xHandle,
  },
};

export default async function IntelligenceIndexPage() {
  const entries = await getIntelligenceIndex();
  const benchmarkCount = entries[0]?.totalBenchmarks ?? 0;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "WeirdBench Intelligence Index",
    description:
      "A consolidated WeirdBench ranking across all benchmarks, normalized relative to each benchmark leader and adjusted for benchmark coverage.",
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
      "Each benchmark score is normalized relative to that benchmark leader, then each model's average is multiplied by benchmark coverage ratio.",
  };

  return (
    <PageShell activeId="index">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="el-hero el-hero-page">
        <div className="el-hero-inner">
          <div className="el-hero-copy">
            <div className="el-eyebrow">
              <span>index</span>
              <span>
                {benchmarkCount} benchmark{benchmarkCount === 1 ? "" : "s"}
              </span>
            </div>
            <h1>WeirdBench Intelligence Index</h1>
            <p className="el-hero-sub">
              A single ranking across every WeirdBench benchmark. Raw scores
              are first converted into benchmark-local scores relative to the
              leader, so small raw gaps stay small while lower-is-better and
              higher-is-better benchmarks can still live in the same table.
            </p>
          </div>
        </div>
      </section>

      <section className="el-section" aria-label="Index ranking">
        <div className="el-list-head">
          <h3>Ranking</h3>
          <span className="el-list-more">
            {entries.length} model{entries.length === 1 ? "" : "s"}
          </span>
        </div>
        {entries.length > 0 ? (
          <ul className="el-list">
            {entries.map((entry, index) => (
              <li key={entry.modelId}>
                <div className="el-board-row">
                  <span
                    className={`el-rank${index === 0 ? " el-rank-leader" : ""}`}
                  >
                    {index + 1}
                  </span>
                  <div className="el-board-main">
                    <p className="el-board-name">{entry.modelId}</p>
                    <p className="el-board-sub">
                      Coverage {entry.coverageCount}/{entry.totalBenchmarks}
                      {" · "}
                      Avg benchmark score{" "}
                      {entry.averageNormalizedScore.toFixed(1)}
                    </p>
                  </div>
                  <span className="el-score">{entry.overallScore.toFixed(2)}</span>
                </div>
                <div className="el-mini-list">
                  {entry.benchmarkScores.map((score) => (
                    <div
                      key={`${entry.modelId}-${score.benchmarkId}`}
                      className="el-mini-row"
                    >
                      <span className="el-mini-label">{score.benchmarkName}</span>
                      <span className="el-mini-value">
                        raw {score.rawScore.toFixed(4)} · idx{" "}
                        {score.normalizedScore.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="el-empty">
            No scores yet. Run local benchmark scripts to populate Neon, then
            reload this page.
          </p>
        )}
      </section>

      <section className="el-section" aria-label="Methodology">
        <div className="el-eyebrow">
          <span>Methodology</span>
          <span>How index scoring works</span>
        </div>
        <div className="el-facts">
          <div>
            <p className="el-fact-label">Normalization</p>
            <p className="el-fact-copy">
              Higher-is-better benchmarks are scored relative to the leader.
              Lower-is-better benchmarks use the inverse ratio to the leader,
              with a safe fallback if scores cross zero.
            </p>
          </div>
          <div>
            <p className="el-fact-label">Coverage</p>
            <p className="el-fact-copy">
              Models missing benchmarks are not dropped. Their average is
              multiplied by benchmark coverage ratio so partial coverage is
              visible and penalized.
            </p>
          </div>
          <div>
            <p className="el-fact-label">Final Score</p>
            <p className="el-fact-copy">
              Final index = average normalized benchmark score × coverage
              ratio. Higher is better.
            </p>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
