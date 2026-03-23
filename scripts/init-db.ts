import { ensureBenchmarkScoreTable } from "@/lib/benchmark-store";

async function main() {
  await ensureBenchmarkScoreTable();
  console.log("benchmark_scores table is ready");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
