import { createHmac, timingSafeEqual } from "node:crypto";
import { BANKS } from "@/lib/banks";
import { getEnv } from "@/lib/env";
import { formatKoboAsNgn, koboToNairaNumber, nairaToKobo } from "@/lib/money";

/**
 * Nomba provider adapter. All provider-specific request/response shapes stay in
 * this file (per spec §9). When sandbox credentials are absent we fall back to a
 * deterministic MOCK driver so the full trade loop is demoable end-to-end
 * without a live Nomba account. Swap in real credentials to activate the HTTP
 * driver.
 *
 * TODO(nomba-sandbox): verify exact endpoint paths, request bodies, response
 * field names, event type strings, and the signature header against the current
 * Nomba API docs before using the real driver in production.
 */

export type InternalProviderEvent =
  | "PAYMENT_SUCCESS"
  | "PAYMENT_REVERSED"
  | "PAYOUT_SUCCESS"
  | "PAYOUT_FAILED"
  | "UNKNOWN";

export function mapNombaEventType(
  providerEventType: string,
): InternalProviderEvent {
  switch (providerEventType) {
    case "payment_success":
    case "payment.success":
      return "PAYMENT_SUCCESS";
    case "payment_reversal":
    case "payment.reversal":
      return "PAYMENT_REVERSED";
    case "payout_success":
    case "payout.success":
      return "PAYOUT_SUCCESS";
    case "payout_failed":
    case "payout.failed":
      return "PAYOUT_FAILED";
    default:
      return "UNKNOWN";
  }
}

export type CreateVirtualAccountInput = {
  tradeId: string;
  amountMinor: bigint;
  accountReference: string;
  customerName?: string;
};

export type CreateVirtualAccountResult = {
  providerAccountId: string;
  accountNumber: string;
  bankName: string;
  accountName: string;
  accountReference: string;
  expiresAt: Date | null;
  raw: unknown;
};

export type NombaTransaction = {
  transactionId: string;
  status: "SUCCESS" | "PENDING" | "FAILED";
  amountMinor: bigint;
  currency: string;
  accountReference: string | null;
  payerName: string | null;
  raw: unknown;
};

export type InitiateTransferInput = {
  merchantTxRef: string;
  idempotencyKey: string;
  amountMinor: bigint;
  bankCode: string;
  accountNumber: string;
  accountName: string;
};

export type InitiateTransferResult = {
  providerTransferId: string;
  status: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";
  raw: unknown;
};

export type NombaTransfer = {
  providerTransferId: string;
  status: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";
  raw: unknown;
};

export type BankAccountLookupResult = {
  accountName: string;
  raw: unknown;
};

export type NombaBank = { name: string; code: string };

export type VerifyWebhookInput = {
  /** Exact request bytes as received. */
  rawBody: string;
  /** Parsed payload (used by the real field-concatenation scheme). */
  payload: unknown;
  /** Value of the `x-nomba-signature` header. */
  signatureHeader: string | null;
  /** Value of the timestamp header used in the real signature. */
  timestampHeader: string | null;
};

export interface NombaClient {
  readonly driver: "mock" | "http";
  getAccessToken(): Promise<string>;
  createVirtualAccount(
    input: CreateVirtualAccountInput,
  ): Promise<CreateVirtualAccountResult>;
  verifyWebhookSignature(input: VerifyWebhookInput): boolean;
  fetchTransactionByReference(
    accountReference: string,
  ): Promise<NombaTransaction | null>;
  listBanks(): Promise<NombaBank[]>;
  lookupBankAccount(input: {
    accountNumber: string;
    bankCode: string;
  }): Promise<BankAccountLookupResult | null>;
  initiateTransfer(
    input: InitiateTransferInput,
  ): Promise<InitiateTransferResult>;
  fetchTransfer(merchantTxRef: string): Promise<NombaTransfer | null>;
}

/** Stable idempotency key for a payout, per spec §9. */
export function payoutIdempotencyKey(tradeId: string, payoutId: string): string {
  return `ure:payout:${tradeId}:${payoutId}`;
}

/** HMAC-SHA256 hex of the raw body under a secret (mock convention + tests). */
export function computeWebhookSignature(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function pick(obj: unknown, path: string[]): string {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur && typeof cur === "object" && key in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[key];
    } else {
      return "";
    }
  }
  return cur == null ? "" : String(cur);
}

/**
 * Build the string Nomba HMACs for webhook signatures. Confirmed against the
 * Nomba "Signature verification" docs: these exact fields joined with ":",
 * followed by the `nomba-timestamp` header value, HMAC-SHA256'd with the
 * signature key and base64-encoded, compared against the `nomba-signature`
 * header.
 */
export function buildNombaSignatureMessage(
  payload: unknown,
  timestamp: string,
): string {
  // Per Nomba docs, responseCode collapses to "" when the value is the literal
  // string "null" (not just a JSON null / missing key, which pick already maps
  // to ""). Missing this makes the signature mismatch and the webhook 401s.
  const responseCode = pick(payload, ["data", "transaction", "responseCode"]);
  const fields = [
    pick(payload, ["event_type"]),
    pick(payload, ["requestId"]),
    pick(payload, ["data", "merchant", "userId"]),
    pick(payload, ["data", "merchant", "walletId"]),
    pick(payload, ["data", "transaction", "transactionId"]),
    pick(payload, ["data", "transaction", "type"]),
    pick(payload, ["data", "transaction", "time"]),
    responseCode === "null" ? "" : responseCode,
  ];
  return `${fields.join(":")}:${timestamp}`;
}

/** HMAC-SHA256 base64 of the Nomba signature message under the signature key. */
export function computeNombaSignature(
  message: string,
  signatureKey: string,
): string {
  return createHmac("sha256", signatureKey).update(message, "utf8").digest("base64");
}

// ---------------------------------------------------------------------------
// MOCK driver — deterministic, keyed by tradeId/reference.
// ---------------------------------------------------------------------------

class MockNombaClient implements NombaClient {
  readonly driver = "mock" as const;

  constructor(private readonly webhookSecret: string) {}

  async getAccessToken(): Promise<string> {
    return "mock-access-token";
  }

  async createVirtualAccount(
    input: CreateVirtualAccountInput,
  ): Promise<CreateVirtualAccountResult> {
    // Deterministic 10-digit NUBAN derived from the trade id.
    const digits = BigInt(
      "0x" + Buffer.from(input.tradeId).toString("hex").slice(0, 12),
    )
      .toString()
      .padStart(10, "0")
      .slice(-10);

    return {
      providerAccountId: `mock-va-${input.tradeId}`,
      accountNumber: digits,
      bankName: "Ure Mock Bank",
      accountName: `URE TRADE ${input.tradeId.slice(0, 8).toUpperCase()}`,
      accountReference: input.accountReference,
      expiresAt: null,
      raw: { mock: true, tradeId: input.tradeId },
    };
  }

  verifyWebhookSignature(input: VerifyWebhookInput): boolean {
    if (!this.webhookSecret) {
      // No secret configured: accept in mock mode so local simulation works.
      return true;
    }
    if (!input.signatureHeader) {
      return false;
    }
    // Mock convention: hex HMAC over the raw body (simpler for local testing).
    return safeEqual(
      computeWebhookSignature(input.rawBody, this.webhookSecret),
      input.signatureHeader,
    );
  }

  async fetchTransactionByReference(
    accountReference: string,
  ): Promise<NombaTransaction | null> {
    // In mock mode the requery simply trusts the reference; the amount is
    // filled in by the webhook payload path, so we return a PENDING marker the
    // worker replaces. Real driver would hit Nomba here.
    return {
      transactionId: `mock-txn-${accountReference}`,
      status: "SUCCESS",
      amountMinor: 0n,
      currency: "NGN",
      accountReference,
      payerName: "MOCK PAYER",
      raw: { mock: true, accountReference },
    };
  }

  async listBanks(): Promise<NombaBank[]> {
    return BANKS;
  }

  async lookupBankAccount(input: {
    accountNumber: string;
    bankCode: string;
  }): Promise<BankAccountLookupResult | null> {
    return {
      accountName: "URE VERIFIED ACCOUNT",
      raw: { mock: true, ...input },
    };
  }

  async initiateTransfer(
    input: InitiateTransferInput,
  ): Promise<InitiateTransferResult> {
    return {
      providerTransferId: `mock-transfer-${input.merchantTxRef}`,
      status: "SUCCESS",
      raw: { mock: true, merchantTxRef: input.merchantTxRef },
    };
  }

  async fetchTransfer(merchantTxRef: string): Promise<NombaTransfer | null> {
    return {
      providerTransferId: `mock-transfer-${merchantTxRef}`,
      status: "SUCCESS",
      raw: { mock: true, merchantTxRef },
    };
  }
}

// ---------------------------------------------------------------------------
// HTTP driver — real Nomba. Endpoint shapes are best-effort and must be
// confirmed against sandbox before production use.
// ---------------------------------------------------------------------------

type HttpConfig = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  /** Parent account id — sent in the `accountId` header. */
  accountId: string;
  /** Sub-account id — used to scope transfers in the URL path. */
  subAccountId: string;
  webhookSecret: string;
};

class HttpNombaClient implements NombaClient {
  readonly driver = "http" as const;
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(private readonly config: HttpConfig) {}

  async getAccessToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 30_000) {
      return this.tokenCache.token;
    }

    // TODO(nomba-sandbox): confirm token endpoint + payload.
    const res = await fetch(`${this.config.baseUrl}/v1/auth/token/issue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accountId: this.config.accountId,
      },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });

    if (!res.ok) {
      throw new Error(`Nomba token request failed: ${res.status}`);
    }

    const json = (await res.json()) as {
      data?: { access_token?: string; expiresAt?: string };
      access_token?: string;
    };
    const token = json.data?.access_token ?? json.access_token;
    if (!token) {
      throw new Error("Nomba token response missing access_token.");
    }

    // Prefer the provider-reported expiry; fall back to 25 minutes.
    const expiresAt = json.data?.expiresAt
      ? Date.parse(json.data.expiresAt)
      : Date.now() + 25 * 60 * 1000;
    this.tokenCache = { token, expiresAt };
    return token;
  }

  private async authedHeaders(): Promise<Record<string, string>> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await this.getAccessToken()}`,
      accountId: this.config.accountId,
    };
  }

  async createVirtualAccount(
    input: CreateVirtualAccountInput,
  ): Promise<CreateVirtualAccountResult> {
    // POST /v1/accounts/virtual (confirmed). accountRef must be 16-64 chars.
    // expectedAmount is in Naira as a 2-decimal string (docs example: "200.00").
    const res = await fetch(`${this.config.baseUrl}/v1/accounts/virtual`, {
      method: "POST",
      headers: await this.authedHeaders(),
      body: JSON.stringify({
        accountRef: input.accountReference,
        accountName: input.customerName ?? "Ure Trade",
        expectedAmount: formatKoboAsNgn(input.amountMinor),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      // Idempotency: if the account for this ref already exists (e.g. a prior
      // accept created it on Nomba but failed to persist locally), fetch and
      // return the existing one instead of throwing — otherwise the trade is
      // permanently stuck (accept keeps 400ing on the duplicate accountRef).
      if (res.status === 400 && /already exists/i.test(body)) {
        const existing = await this.getVirtualAccountByRef(input.accountReference);
        if (existing) {
          return existing;
        }
      }
      throw new Error(
        `Nomba createVirtualAccount failed: ${res.status} ${body.slice(0, 300)}`,
      );
    }

    return this.mapVirtualAccountResponse(await res.json(), input.accountReference);
  }

  /** GET an existing virtual account by its accountRef. */
  private async getVirtualAccountByRef(
    accountRef: string,
  ): Promise<CreateVirtualAccountResult | null> {
    const res = await fetch(
      `${this.config.baseUrl}/v1/accounts/virtual/${encodeURIComponent(accountRef)}`,
      { headers: await this.authedHeaders() },
    );
    if (!res.ok) {
      return null;
    }
    return this.mapVirtualAccountResponse(await res.json(), accountRef);
  }

  private mapVirtualAccountResponse(
    json: unknown,
    accountReference: string,
  ): CreateVirtualAccountResult {
    const data =
      ((json as { data?: Record<string, unknown> })?.data ?? {}) as {
        accountHolderId?: string;
        bankAccountNumber?: string;
        bankName?: string;
        bankAccountName?: string;
        accountName?: string;
        accountRef?: string;
        expiryDate?: string;
      };

    return {
      providerAccountId: data.accountHolderId ?? accountReference,
      accountNumber: data.bankAccountNumber ?? "",
      bankName: data.bankName ?? "Nomba",
      // The per-account name (bankAccountName) is what the buyer transfers to;
      // accountName on a GET is the parent account, so prefer bankAccountName.
      accountName: data.bankAccountName ?? data.accountName ?? "Ure Trade",
      accountReference: data.accountRef ?? accountReference,
      expiresAt: data.expiryDate ? new Date(data.expiryDate) : null,
      raw: json,
    };
  }

  verifyWebhookSignature(input: VerifyWebhookInput): boolean {
    if (!input.signatureHeader || !input.timestampHeader) {
      return false;
    }
    const message = buildNombaSignatureMessage(
      input.payload,
      input.timestampHeader,
    );
    return safeEqual(
      computeNombaSignature(message, this.config.webhookSecret),
      input.signatureHeader,
    );
  }

  async fetchTransactionByReference(
    accountReference: string,
  ): Promise<NombaTransaction | null> {
    // TODO(nomba-sandbox): confirm transaction lookup endpoint + query.
    const res = await fetch(
      `${this.config.baseUrl}/v1/transactions?accountRef=${encodeURIComponent(accountReference)}`,
      { headers: await this.authedHeaders() },
    );
    if (!res.ok) {
      return null;
    }
    const json = (await res.json()) as {
      data?: Array<{
        id?: string;
        status?: string;
        amount?: string;
        currency?: string;
        payerName?: string;
      }>;
    };
    const txn = json.data?.[0];
    if (!txn) {
      return null;
    }
    return {
      transactionId: txn.id ?? "",
      status:
        txn.status === "SUCCESS" || txn.status === "success"
          ? "SUCCESS"
          : txn.status === "FAILED"
            ? "FAILED"
            : "PENDING",
      // Nomba reports amounts in Naira; convert to our internal kobo.
      amountMinor: nairaToKobo(txn.amount ?? "0"),
      currency: txn.currency ?? "NGN",
      accountReference,
      payerName: txn.payerName ?? null,
      raw: json,
    };
  }

  async listBanks(): Promise<NombaBank[]> {
    // GET /v1/transfers/banks → [{ name, code, nipCode, ... }]. Uses Nomba's
    // own bank codes (NOT NIP codes) — required for lookup/transfer to match.
    const res = await fetch(`${this.config.baseUrl}/v1/transfers/banks`, {
      headers: await this.authedHeaders(),
    });
    if (!res.ok) {
      return [];
    }
    const json = (await res.json()) as
      | { data?: Array<{ name?: string; code?: string }> }
      | Array<{ name?: string; code?: string }>;
    const arr = Array.isArray(json) ? json : (json.data ?? []);
    return arr
      .filter((b) => b.name && b.code)
      .map((b) => ({ name: b.name!.trim(), code: b.code! }));
  }

  async lookupBankAccount(input: {
    accountNumber: string;
    bankCode: string;
  }): Promise<BankAccountLookupResult | null> {
    // POST /v1/transfers/bank/lookup → data.accountName (confirmed via docs).
    const res = await fetch(`${this.config.baseUrl}/v1/transfers/bank/lookup`, {
      method: "POST",
      headers: await this.authedHeaders(),
      body: JSON.stringify({
        accountNumber: input.accountNumber,
        bankCode: input.bankCode,
      }),
    });
    if (!res.ok) {
      return null;
    }
    const json = (await res.json()) as {
      data?: { accountName?: string };
    };
    const accountName = json.data?.accountName;
    if (!accountName) {
      return null;
    }
    return { accountName, raw: json };
  }

  async initiateTransfer(
    input: InitiateTransferInput,
  ): Promise<InitiateTransferResult> {
    if (!this.config.subAccountId) {
      throw new Error("NOMBA_SUBACCOUNT_ID is required to initiate transfers.");
    }
    // POST /v2/transfers/bank/{subAccountId}. Idempotency is via merchantTxRef
    // (reused on retry), not an Idempotency-Key header. Amount is in Naira.
    const res = await fetch(
      `${this.config.baseUrl}/v2/transfers/bank/${this.config.subAccountId}`,
      {
        method: "POST",
        headers: await this.authedHeaders(),
        body: JSON.stringify({
          amount: koboToNairaNumber(input.amountMinor),
          accountNumber: input.accountNumber,
          accountName: input.accountName,
          bankCode: input.bankCode,
          merchantTxRef: input.merchantTxRef,
          senderName: "Ure Escrow",
          narration: `Ure payout ${input.merchantTxRef}`,
        }),
      },
    );

    if (!res.ok) {
      throw new Error(`Nomba initiateTransfer failed: ${res.status}`);
    }

    const json = (await res.json()) as {
      data?: { id?: string; status?: string };
    };
    const data = json.data ?? {};
    return {
      providerTransferId: data.id ?? input.merchantTxRef,
      status: normalizeTransferStatus(data.status),
      raw: json,
    };
  }

  async fetchTransfer(merchantTxRef: string): Promise<NombaTransfer | null> {
    const res = await fetch(
      `${this.config.baseUrl}/v1/transfers?merchantTxRef=${encodeURIComponent(merchantTxRef)}`,
      { headers: await this.authedHeaders() },
    );
    if (!res.ok) {
      return null;
    }
    const json = (await res.json()) as {
      data?: { id?: string; status?: string };
    };
    const data = json.data ?? {};
    return {
      providerTransferId: data.id ?? merchantTxRef,
      status: normalizeTransferStatus(data.status),
      raw: json,
    };
  }
}

function normalizeTransferStatus(
  status: string | undefined,
): "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED" {
  switch ((status ?? "").toUpperCase()) {
    case "SUCCESS":
    case "COMPLETED":
      return "SUCCESS";
    case "FAILED":
      return "FAILED";
    case "PROCESSING":
      return "PROCESSING";
    default:
      return "PENDING";
  }
}

let cachedClient: NombaClient | null = null;

export function isNombaConfigured(): boolean {
  const env = getEnv();
  return Boolean(
    env.NOMBA_BASE_URL &&
      !env.NOMBA_BASE_URL.includes(".example") &&
      env.NOMBA_CLIENT_ID &&
      env.NOMBA_CLIENT_SECRET &&
      env.NOMBA_ACCOUNT_ID,
  );
}

export function getNombaClient(): NombaClient {
  if (cachedClient) {
    return cachedClient;
  }

  const env = getEnv();
  if (isNombaConfigured()) {
    cachedClient = new HttpNombaClient({
      baseUrl: env.NOMBA_BASE_URL!,
      clientId: env.NOMBA_CLIENT_ID!,
      clientSecret: env.NOMBA_CLIENT_SECRET!,
      accountId: env.NOMBA_ACCOUNT_ID!,
      subAccountId: env.NOMBA_SUBACCOUNT_ID ?? "",
      webhookSecret: env.NOMBA_WEBHOOK_SECRET ?? "",
    });
  } else {
    cachedClient = new MockNombaClient(env.NOMBA_WEBHOOK_SECRET ?? "");
  }

  return cachedClient;
}

let cachedLookupClient: NombaClient | null = null;

/**
 * Client used for the read-only bank-name lookup. If dedicated LIVE lookup
 * credentials are configured, a separate live client resolves REAL account
 * names (name enquiry moves no money) while the main client (sandbox) still
 * handles virtual accounts and payouts. Falls back to the main client.
 */
export function getNombaLookupClient(): NombaClient {
  const env = getEnv();
  const hasLookupCreds = Boolean(
    env.NOMBA_LOOKUP_BASE_URL &&
      env.NOMBA_LOOKUP_CLIENT_ID &&
      env.NOMBA_LOOKUP_CLIENT_SECRET &&
      env.NOMBA_LOOKUP_ACCOUNT_ID,
  );

  if (!hasLookupCreds) {
    return getNombaClient();
  }

  if (!cachedLookupClient) {
    cachedLookupClient = new HttpNombaClient({
      baseUrl: env.NOMBA_LOOKUP_BASE_URL!,
      clientId: env.NOMBA_LOOKUP_CLIENT_ID!,
      clientSecret: env.NOMBA_LOOKUP_CLIENT_SECRET!,
      accountId: env.NOMBA_LOOKUP_ACCOUNT_ID!,
      subAccountId: "",
      webhookSecret: "",
    });
  }
  return cachedLookupClient;
}

/** Test/reset seam. */
export function resetNombaClient(): void {
  cachedClient = null;
  cachedLookupClient = null;
}
