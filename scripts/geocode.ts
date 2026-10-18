import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const { backfillGeocodes } = await import("../src/lib/geocode");
  for (;;) {
    const result = await backfillGeocodes({ limit: 5000 });
    console.log(JSON.stringify(result));
    if (result.processed === 0 || result.failed > 0) break;
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
