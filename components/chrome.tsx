import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

export function ArrowUpRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </svg>
  );
}

export function SiteNav({ activeId }: { activeId?: "home" | "index" }) {
  return (
    <header className="el-nav">
      <Link href="/" className="el-logo" aria-label="WeirdBench home">
        <Image
          src="/weirdbench-mark.png"
          alt=""
          width={28}
          height={28}
          className="el-logo-mark"
          priority
        />
        WeirdBench
      </Link>
      <nav className="el-nav-links" aria-label="Primary">
        <Link href="/#benchmarks" className="el-nav-link">
          Benchmarks
        </Link>
        <Link
          href="/intelligence-index"
          className={`el-nav-link${activeId === "index" ? " el-nav-link-active" : ""}`}
        >
          Intelligence Index
        </Link>
        <a
          href="https://github.com/jdleo/weirdbench"
          target="_blank"
          rel="noopener noreferrer"
          className="el-nav-link"
        >
          GitHub
        </a>
      </nav>
      <div className="el-nav-actions">
        <a
          href="https://github.com/jdleo/weirdbench"
          target="_blank"
          rel="noopener noreferrer"
          className="el-nav-link"
        >
          GitHub
        </a>
        <Link href="/intelligence-index" className="el-btn el-btn-dark el-btn-sm">
          Intelligence Index
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="el-footer">
      <div className="el-footer-inner">
        <span className="el-footer-logo">WeirdBench</span>
        <div className="el-footer-links">
          <Link href="/#benchmarks">Benchmarks</Link>
          <Link href="/intelligence-index">Intelligence Index</Link>
          <a
            href="https://github.com/jdleo/weirdbench"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <a
            href="https://x.com/jdleo_"
            target="_blank"
            rel="noopener noreferrer"
          >
            X
          </a>
        </div>
        <span className="el-footer-copy">
          © {new Date().getFullYear()}. Open-source benchmarks.
        </span>
      </div>
    </footer>
  );
}

export function PageShell({
  activeId,
  children,
}: {
  activeId?: "home" | "index";
  children: ReactNode;
}) {
  return (
    <main className="el-page">
      <SiteNav activeId={activeId} />
      {children}
      <SiteFooter />
    </main>
  );
}
