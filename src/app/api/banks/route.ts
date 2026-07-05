import { apiSuccess } from "@/lib/api";
import { BANKS } from "@/lib/banks";
import { getNombaLookupClient } from "@/lib/nomba";

let cache: { banks: { name: string; code: string }[]; at: number } | null = null;
const TTL_MS = 60 * 60 * 1000;

/**
 * Nomba's real bank list (with Nomba's own bank codes, not NIP codes). Served
 * from the lookup client so codes match the account-name lookup. Cached in
 * memory; NEVER fails — falls back to the static curated list on any error so
 * the dropdown always loads.
 */
export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return apiSuccess({ banks: cache.banks });
  }
  try {
    const banks = await getNombaLookupClient().listBanks();
    if (banks.length) {
      cache = { banks, at: Date.now() };
      return apiSuccess({ banks });
    }
  } catch {
    // fall through to the static list
  }
  return apiSuccess({ banks: BANKS });
}
