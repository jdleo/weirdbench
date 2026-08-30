import Link from "next/link";
import { ArrowUpRightIcon, PageShell } from "@/components/chrome";

const quickLinks = [
  {
    label: "Benchmarks",
    description: "Unconventional evals for modern LLMs.",
    href: "/#benchmarks",
  },
  {
    label: "Intelligence Index",
    description: "One consolidated ranking across every benchmark.",
    href: "/intelligence-index",
  },
  {
    label: "GitHub",
    description: "Definitions, runners, and the whole pipeline.",
    href: "https://github.com/jdleo/weirdbench",
  },
];

export default function NotFound() {
  return (
    <PageShell>
      <section className="el-hero el-hero-page">
        <div className="el-hero-inner">
          <div className="el-hero-copy">
            <div className="el-eyebrow">
              <span>error 404</span>
              <span>page not found</span>
            </div>
            <h1>
              No such page
              <span className="el-hero-cursor" aria-hidden="true" />
            </h1>
            <p className="el-hero-sub">
              This URL doesn&apos;t match any benchmark, model, or page on
              WeirdBench. It may have been moved, or it never existed.
            </p>

            <div className="el-hero-actions">
              <Link href="/" className="el-btn el-btn-dark">
                Back home
                <ArrowUpRightIcon />
              </Link>
              <Link
                href="/intelligence-index"
                className="el-btn el-btn-light"
              >
                Intelligence Index
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="el-section" aria-label="Quick links">
        <div className="el-list-head">
          <h3>Quick links</h3>
        </div>
        <ul className="el-list">
          {quickLinks.map((link) =>
            link.href.startsWith("http") ? (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="el-row"
                >
                  <span className="el-row-label">{link.label}</span>
                  <span className="el-row-desc">{link.description}</span>
                </a>
              </li>
            ) : (
              <li key={link.href}>
                <Link href={link.href} className="el-row">
                  <span className="el-row-label">{link.label}</span>
                  <span className="el-row-desc">{link.description}</span>
                </Link>
              </li>
            ),
          )}
        </ul>
      </section>
    </PageShell>
  );
}
