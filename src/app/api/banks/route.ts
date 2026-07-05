import { apiError, apiSuccess } from "@/lib/api";
import { BANKS } from "@/lib/banks";
import { getNombaLookupClient } from "@/lib/nomba";

let cache: { banks: { name: string; code: string }[]; at: number } | null = null;
const TTL_MS = 60 * 60 * 1000;

/**
 * Nomba's real bank list (with Nomba's own bank codes, not NIP codes). Served
 * from the lookup client so codes match the account-name lookup. Cached in
 * memory; falls back to the static curated list.
 */
export async function GET() {
  try {
    if (cache && Date.now() - cache.at < TTL_MS) {
      return apiSuccess({ banks: cache.banks });
    }
    let banks = await getNombaLookupClient().listBanks();
    if (!banks.length) {
      banks = BANKS;
    }
    cache = { banks, at: Date.now() };
    return apiSuccess({ banks });
  } catch (error) {
    return apiError(error);
  }
}
