import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const { backfillEmbeddings } = await import("../src/lib/embed-listings");
  let total = 0;
  for (;;) {
    const { embedded, failed } = await backfillEmbeddings({ limit: 500 });
    total += embedded;
    console.log(`embedded ${embedded} (failed ${failed}); total ${total}`);
    if (embedded === 0 || failed > 0) break;
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
