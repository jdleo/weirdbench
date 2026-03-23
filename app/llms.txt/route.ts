import { benchmarkRegistry } from "@/lib/benchmarks";
import { siteConfig } from "@/lib/site";

export function GET() {
  const body = [
    "# WeirdBench",
    "",
    "> WeirdBench is an open-source benchmark site for unconventional LLM evaluations.",
    "",
    "## Home",
    `- ${siteConfig.url}/`,
    "",
    "## Intelligence Index",
    `- ${siteConfig.url}/intelligence-index | WeirdBench Intelligence Index`,
    "",
    "## Benchmarks",
    ...benchmarkRegistry.map(
      (benchmark) =>
        `- ${siteConfig.url}/benchmarks/${benchmark.id} | ${benchmark.name}`,
    ),
    "",
    "## Source",
    `- ${siteConfig.githubUrl}`,
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
