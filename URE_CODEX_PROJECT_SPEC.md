# Ure — Codex Project Specification

> **Purpose:** This file is the implementation brief for Codex or another coding agent. It converts the Ure product concept into a buildable engineering plan with architecture decisions, database models, route contracts, workflows, test requirements, and implementation order.

---

## 0. Executive Summary

**Ure** is a peer-to-peer fiat-to-crypto escrow bridge for local markets. A seller locks crypto into a Stacks escrow contract. A buyer accepts the trade and receives a dedicated single-use NUBAN through Nomba. When the buyer sends the exact fiat amount to that NUBAN, a verified webhook and reconciliation step mark the trade as fiat-secured. The backend then releases the escrowed crypto to the buyer and pays the seller through Nomba.

The MVP should focus on proving one clean flow:

```text
Seller locks STX → Buyer pays exact NGN amount → Ure confirms fiat → Ure releases STX → Ure pays seller → Trade completed
```

### MVP Constraints

Implement these constraints first. Do not expand scope until the core loop is stable.

```text
Asset: STX only
Fiat currency: NGN only
Payment rule: exact amount only
Payment provider: Nomba
Blockchain: Stacks testnet 
Escrow model: backend-authorized oracle release for MVP
Wallets: Leather and Xverse
Frontend: Next.js App Router + Tailwind CSS
Backend: Next.js route handlers + background workers
Database: PostgreSQL + Prisma
```

### Non-MVP / Deferred Features

```text
sBTC support
Partial payments
Overpayment refunds
Multi-currency support
Public order book
Advanced dispute marketplace
Mobile app
Multi-chain support
Decentralized arbitration
```

---

## 1. Critical Architecture Decisions

### 1.1 Use Exact-Payment Virtual Accounts in MVP

The original concept allows underpayment and overpayment handling. For MVP, do **not** support partial payments. Create the virtual account with an expected amount where the provider supports it, and require the buyer to transfer the exact NGN amount.

Reason:

```text
Partial payments create complicated reconciliation, timeout, refund, and UI edge cases.
Exact-payment trades are much easier to secure, test, and launch.
```

### 1.2 Treat Virtual Accounts as Reconciliation References, Not Wallets

Do not model the Nomba virtual account as a bank account that holds a separate balance. Internally, treat it as a unique payment rail/reference for one trade. The ledger should track how much was received for that trade, but seller payout should be modeled as a transfer from the platform/provider balance to the seller bank account.

### 1.3 Webhook Must Not Release Crypto Directly

The webhook route must only:

```text
1. Receive the payload.
2. Verify provider authenticity.
3. Persist the raw event.
4. Idempotently enqueue processing.
5. Return 2XX quickly.
```

Do **not** perform Stacks release transactions inside the webhook HTTP request.

### 1.4 Reconcile Before Release

Never release crypto based only on a webhook payload. Before moving a trade to `FIAT_SECURED`, the backend must requery/fetch the payment from Nomba or otherwise confirm the transaction through a provider-trusted read API.

### 1.5 Backend-Oracle Escrow Is Accepted for MVP

For MVP, the backend may hold a release authority key that calls the escrow contract once fiat is verified. This is not fully trustless. The product copy should avoid claiming complete decentralization. Later versions can reduce trust with seller pre-signed release permits, multisig, or arbitration.

### 1.6 Use Integer Minor Units for Money

Do not use JavaScript floating-point numbers for fiat or crypto amounts.

```text
NGN fiat: store in kobo as BigInt where possible.
STX: store in micro-STX as BigInt.
Display conversion should happen at the UI boundary only.
```

---

## 2. Target Architecture

```text
ure/
├── contracts/
│   ├── escrow.clar
│   └── tests/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── scripts/
│   ├── seed.ts
│   ├── dev-reconcile.ts
│   └── deploy-contract.ts
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/session/route.ts
│   │   │   ├── health/route.ts
│   │   │   ├── nomba/webhook/route.ts
│   │   │   ├── trades/route.ts
│   │   │   ├── trades/[id]/route.ts
│   │   │   ├── trades/[id]/accept/route.ts
│   │   │   ├── trades/[id]/lock/route.ts
│   │   │   ├── trades/[id]/status/route.ts
│   │   │   └── admin/trades/[id]/route.ts
│   │   ├── admin/
│   │   │   └── page.tsx
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── trade/
│   │   │   └── [id]/page.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ConnectWallet.tsx
│   │   ├── TradeCard.tsx
│   │   ├── TradeStatusTimeline.tsx
│   │   ├── PaymentInstructionCard.tsx
│   │   ├── CreateTradeForm.tsx
│   │   └── AdminTradeInspector.tsx
│   ├── jobs/
│   │   ├── queue.ts
│   │   ├── process-fiat-secured-trade.ts
│   │   ├── release-crypto.ts
│   │   ├── confirm-crypto-release.ts
│   │   ├── initiate-seller-payout.ts
│   │   └── reconcile-stale-trades.ts
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── env.ts
│   │   ├── logger.ts
│   │   ├── money.ts
│   │   ├── state-machine.ts
│   │   ├── audit.ts
│   │   ├── nomba.ts
│   │   ├── stacks.ts
│   │   ├── escrow-engine.ts
│   │   ├── webhook-verification.ts
│   │   └── idempotency.ts
│   ├── server/
│   │   ├── trade-service.ts
│   │   ├── payment-service.ts
│   │   ├── escrow-service.ts
│   │   ├── payout-service.ts
│   │   └── admin-service.ts
│   └── types/
│       ├── api.ts
│       ├── nomba.ts
│       ├── stacks.ts
│       └── trades.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## 3. Environment Variables

Create `.env.example` with the following keys.

```bash
# App
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
APP_SECRET="replace-with-long-random-secret"

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/ure"

# Nomba
NOMBA_BASE_URL="https://api.nomba.example"
NOMBA_CLIENT_ID=""
NOMBA_CLIENT_SECRET=""
NOMBA_ACCOUNT_ID=""
NOMBA_WEBHOOK_SECRET=""

# Stacks
STACKS_NETWORK="testnet"
STACKS_API_URL="https://api.testnet.hiro.so"
ESCROW_CONTRACT_ADDRESS=""
ESCROW_CONTRACT_NAME="ure-escrow"
ESCROW_ORACLE_PRIVATE_KEY=""

# Jobs / Queue
QUEUE_DRIVER="database"
JOB_POLL_INTERVAL_MS="5000"

# Admin
ADMIN_WALLET_ADDRESSES=""
```

Implementation notes:

```text
- Validate env variables at startup in src/lib/env.ts.
- Never expose private keys or provider secrets to the browser.
- Only variables prefixed with NEXT_PUBLIC_ may be used client-side.
```

---

## 4. Database Schema Draft

Use this as the starting Prisma schema. Adjust provider-specific fields only if the actual API response requires it.

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  USER
  ADMIN
}

enum TradeStatus {
  DRAFT
  AWAITING_CRYPTO_LOCK
  CRYPTO_LOCKED
  AWAITING_BUYER
  AWAITING_FIAT
  FIAT_SECURED
  RELEASING_CRYPTO
  CRYPTO_RELEASED
  PAYOUT_PENDING
  COMPLETED
  CANCELLED
  REFUND_PENDING
  FAILED_NEEDS_REVIEW
}

enum CryptoAsset {
  STX
}

enum FiatCurrency {
  NGN
}

enum EscrowStatus {
  NOT_STARTED
  LOCK_PENDING
  LOCK_CONFIRMED
  RELEASE_PENDING
  RELEASE_CONFIRMED
  REFUND_PENDING
  REFUND_CONFIRMED
  FAILED
}

enum FiatTransactionStatus {
  RECEIVED
  CONFIRMED
  IGNORED
  REVERSED
  FAILED
}

enum PayoutStatus {
  NOT_STARTED
  PENDING
  PROCESSING
  SUCCESS
  FAILED
  REVERSED
}

enum WebhookStatus {
  RECEIVED
  PROCESSED
  IGNORED
  FAILED
}

enum JobStatus {
  PENDING
  RUNNING
  SUCCEEDED
  FAILED
  CANCELLED
}

model User {
  id              String        @id @default(uuid())
  walletAddress   String        @unique
  role            UserRole      @default(USER)
  displayName     String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  sellerTrades    Trade[]       @relation("SellerTrades")
  buyerTrades     Trade[]       @relation("BuyerTrades")
  bankAccounts    BankAccount[]
}

model BankAccount {
  id                  String   @id @default(uuid())
  userId              String
  provider            String   @default("nomba")
  bankCode            String
  bankName            String?
  accountNumberMasked String
  accountName         String
  recipientReference  String?
  isPrimary           Boolean  @default(false)
  verifiedAt          DateTime?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  user                User     @relation(fields: [userId], references: [id])
  payouts             Payout[]

  @@index([userId])
}

model Trade {
  id                    String        @id @default(uuid())
  sellerId              String
  buyerId               String?
  sellerBankAccountId   String?

  cryptoAsset           CryptoAsset   @default(STX)
  cryptoAmountMicro     BigInt
  fiatCurrency          FiatCurrency  @default(NGN)
  fiatExpectedMinor     BigInt
  fiatReceivedMinor     BigInt        @default(0)

  status                TradeStatus   @default(DRAFT)
  expiresAt             DateTime?
  acceptedAt            DateTime?
  completedAt           DateTime?
  cancelledAt           DateTime?
  failureReason         String?

  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt

  seller                User          @relation("SellerTrades", fields: [sellerId], references: [id])
  buyer                 User?         @relation("BuyerTrades", fields: [buyerId], references: [id])
  virtualAccount        VirtualAccount?
  escrowLock            EscrowLock?
  fiatTransactions      FiatTransaction[]
  payouts               Payout[]
  auditLogs             AuditLog[]

  @@index([sellerId])
  @@index([buyerId])
  @@index([status])
  @@index([createdAt])
}

model VirtualAccount {
  id                    String   @id @default(uuid())
  tradeId               String   @unique
  provider              String   @default("nomba")
  providerAccountId     String?  @unique
  accountReference      String   @unique
  accountNumber         String
  bankName              String
  accountName           String?
  expectedAmountMinor   BigInt
  currency              String   @default("NGN")
  expiresAt             DateTime?
  rawProviderPayload    Json?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  trade                 Trade    @relation(fields: [tradeId], references: [id])

  @@index([accountNumber])
  @@index([accountReference])
}

model EscrowLock {
  id                    String       @id @default(uuid())
  tradeId               String       @unique
  chain                 String       @default("stacks")
  network               String       @default("testnet")
  contractAddress       String
  contractName          String
  escrowIdOnChain       String?
  lockTxId              String?      @unique
  releaseTxId           String?      @unique
  refundTxId            String?      @unique
  sellerAddress         String
  buyerAddress          String?
  oracleAddress         String?
  amountMicro           BigInt
  status                EscrowStatus @default(NOT_STARTED)
  confirmations         Int          @default(0)
  rawLockPayload        Json?
  rawReleasePayload     Json?
  createdAt             DateTime     @default(now())
  updatedAt             DateTime     @updatedAt

  trade                 Trade        @relation(fields: [tradeId], references: [id])
}

model FiatTransaction {
  id                    String                  @id @default(uuid())
  tradeId               String
  provider              String                  @default("nomba")
  providerTransactionId String?                 @unique
  sessionId             String?                 @unique
  accountReference      String?
  amountMinor           BigInt
  currency              String                  @default("NGN")
  status                FiatTransactionStatus   @default(RECEIVED)
  providerStatus        String?
  payerName             String?
  payerAccountMasked    String?
  rawProviderPayload    Json?
  receivedAt            DateTime?
  confirmedAt           DateTime?
  createdAt             DateTime                @default(now())
  updatedAt             DateTime                @updatedAt

  trade                 Trade                   @relation(fields: [tradeId], references: [id])

  @@index([tradeId])
  @@index([accountReference])
  @@index([createdAt])
}

model Payout {
  id                    String       @id @default(uuid())
  tradeId               String
  sellerId              String
  bankAccountId         String?
  provider              String       @default("nomba")
  providerTransferId    String?      @unique
  merchantTxRef         String       @unique
  idempotencyKey        String       @unique
  amountMinor           BigInt
  currency              String       @default("NGN")
  status                PayoutStatus @default(NOT_STARTED)
  providerStatus        String?
  failureReason         String?
  rawProviderPayload    Json?
  initiatedAt           DateTime?
  completedAt           DateTime?
  createdAt             DateTime     @default(now())
  updatedAt             DateTime     @updatedAt

  trade                 Trade        @relation(fields: [tradeId], references: [id])
  seller                User         @relation(fields: [sellerId], references: [id])
  bankAccount           BankAccount? @relation(fields: [bankAccountId], references: [id])

  @@index([tradeId])
  @@index([sellerId])
  @@index([status])
}

model WebhookEvent {
  id                    String        @id @default(uuid())
  provider              String        @default("nomba")
  eventType             String
  requestId             String?       @unique
  providerEventId       String?       @unique
  providerTransactionId String?
  sessionId             String?
  signatureValid        Boolean       @default(false)
  status                WebhookStatus @default(RECEIVED)
  rawHeaders            Json?
  rawPayload            Json
  errorMessage          String?
  processedAt           DateTime?
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt

  @@index([eventType])
  @@index([providerTransactionId])
  @@index([sessionId])
  @@index([createdAt])
}

model Job {
  id             String    @id @default(uuid())
  type           String
  status         JobStatus @default(PENDING)
  payload        Json
  attempts       Int       @default(0)
  maxAttempts    Int       @default(5)
  runAfter       DateTime  @default(now())
  lockedAt       DateTime?
  lockedBy       String?
  errorMessage   String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([type, status, runAfter])
}

model AuditLog {
  id          String   @id @default(uuid())
  tradeId     String?
  actorType   String
  actorId     String?
  action      String
  metadata    Json?
  createdAt   DateTime @default(now())

  trade       Trade?   @relation(fields: [tradeId], references: [id])

  @@index([tradeId])
  @@index([action])
  @@index([createdAt])
}
```

---

## 5. Trade State Machine

Create `src/lib/state-machine.ts` with explicit allowed transitions.

### Status Meanings

| Status | Meaning |
|---|---|
| `DRAFT` | Trade created locally but not ready. |
| `AWAITING_CRYPTO_LOCK` | Seller has submitted/started escrow lock flow. |
| `CRYPTO_LOCKED` | On-chain lock confirmed. Trade is available or accepted depending on buyer state. |
| `AWAITING_BUYER` | Seller offer is public/private and waiting for buyer acceptance. |
| `AWAITING_FIAT` | Buyer accepted; virtual account created; waiting for exact fiat payment. |
| `FIAT_SECURED` | Fiat confirmed by provider requery. Safe to release crypto. |
| `RELEASING_CRYPTO` | Crypto release transaction submitted or being prepared. |
| `CRYPTO_RELEASED` | Crypto release confirmed on-chain. |
| `PAYOUT_PENDING` | Seller payout is pending or processing. |
| `COMPLETED` | Crypto released and seller payout successful. |
| `CANCELLED` | Trade cancelled before completion. |
| `REFUND_PENDING` | Refund/cancellation path is in progress. |
| `FAILED_NEEDS_REVIEW` | Automated flow failed; admin review required. |

### Allowed Transitions

```ts
export const allowedTradeTransitions: Record<TradeStatus, TradeStatus[]> = {
  DRAFT: ["AWAITING_CRYPTO_LOCK", "CANCELLED"],
  AWAITING_CRYPTO_LOCK: ["CRYPTO_LOCKED", "FAILED_NEEDS_REVIEW", "CANCELLED"],
  CRYPTO_LOCKED: ["AWAITING_BUYER", "AWAITING_FIAT", "REFUND_PENDING", "CANCELLED"],
  AWAITING_BUYER: ["AWAITING_FIAT", "REFUND_PENDING", "CANCELLED"],
  AWAITING_FIAT: ["FIAT_SECURED", "REFUND_PENDING", "FAILED_NEEDS_REVIEW", "CANCELLED"],
  FIAT_SECURED: ["RELEASING_CRYPTO", "FAILED_NEEDS_REVIEW"],
  RELEASING_CRYPTO: ["CRYPTO_RELEASED", "FAILED_NEEDS_REVIEW"],
  CRYPTO_RELEASED: ["PAYOUT_PENDING", "FAILED_NEEDS_REVIEW"],
  PAYOUT_PENDING: ["COMPLETED", "FAILED_NEEDS_REVIEW"],
  COMPLETED: [],
  CANCELLED: [],
  REFUND_PENDING: ["CANCELLED", "FAILED_NEEDS_REVIEW"],
  FAILED_NEEDS_REVIEW: ["RELEASING_CRYPTO", "PAYOUT_PENDING", "COMPLETED", "CANCELLED", "REFUND_PENDING"],
};
```

### Rules

```text
- Every status change must be performed through a service function.
- Every status change must create an AuditLog entry.
- Direct Prisma updates to Trade.status are not allowed outside trade-service.ts.
- State transitions must run inside database transactions when updating related records.
```

---

## 6. Core Workflows

## 6.1 Seller Creates Trade

### User Story

As a seller, I connect my Stacks wallet and create an offer to sell STX for NGN.

### Flow

```text
1. Seller connects Leather or Xverse.
2. App creates or retrieves User by walletAddress.
3. Seller enters STX amount and NGN expected amount.
4. Backend creates Trade with status DRAFT.
5. Backend returns lock transaction parameters.
6. Seller signs lock transaction in wallet.
7. Frontend submits tx id to /api/trades/:id/lock.
8. Backend stores EscrowLock with LOCK_PENDING.
9. Chain watcher confirms lock.
10. Trade moves to CRYPTO_LOCKED or AWAITING_BUYER.
```

### Acceptance Criteria

```text
- Seller cannot create trade with zero or negative amounts.
- Seller cannot create trade without connected wallet.
- Fiat amount is stored as integer minor units.
- Crypto amount is stored as micro-STX.
- Trade cannot be accepted until lock is confirmed.
```

---

## 6.2 Buyer Accepts Trade

### User Story

As a buyer, I accept a seller's locked trade and receive bank transfer instructions.

### Flow

```text
1. Buyer connects wallet.
2. Buyer opens /trade/:id.
3. Buyer clicks Accept Trade.
4. Backend verifies trade is CRYPTO_LOCKED or AWAITING_BUYER.
5. Backend sets buyerId and acceptedAt.
6. Backend creates a Nomba virtual account for the exact expected amount.
7. Backend stores VirtualAccount.
8. Trade moves to AWAITING_FIAT.
9. UI displays account number, bank name, account name, amount, expiry, and warning to pay exact amount.
```

### Acceptance Criteria

```text
- Seller cannot accept their own trade.
- A trade can have only one buyer.
- A trade can have only one virtual account.
- Duplicate accept requests must not create duplicate virtual accounts.
- Buyer sees clear exact-payment instructions.
```

---

## 6.3 Fiat Webhook and Reconciliation

### User Story

As the platform, I need to safely confirm fiat payment before releasing crypto.

### Flow

```text
1. Nomba sends webhook to POST /api/nomba/webhook.
2. Route reads raw body and headers.
3. Route verifies webhook signature.
4. Route stores WebhookEvent.
5. If duplicate event, return 2XX and do nothing else.
6. Route enqueues payment-processing job.
7. Worker maps event to trade using accountReference, provider transaction id, session id, or virtual account number.
8. Worker requeries Nomba transaction endpoint.
9. Worker verifies:
   - provider transaction exists
   - status is successful/settled
   - amount equals fiatExpectedMinor
   - currency is NGN
   - account reference or virtual account matches trade
   - trade is AWAITING_FIAT
10. Worker creates FiatTransaction.
11. Worker updates Trade.fiatReceivedMinor.
12. Worker moves Trade to FIAT_SECURED.
13. Worker enqueues crypto release job.
```

### Acceptance Criteria

```text
- Invalid signature does not process payment.
- Duplicate webhook does not double-release crypto.
- Wrong amount does not release crypto.
- Wrong account reference does not release crypto.
- Webhook route returns quickly.
```

---

## 6.4 Crypto Release

### User Story

As the platform, once fiat is secured, I release the escrowed STX to the buyer.

### Flow

```text
1. Worker picks up FIAT_SECURED trade.
2. Worker verifies trade has buyerId, escrow lock, fiat transaction, and correct status.
3. Worker moves trade to RELEASING_CRYPTO.
4. Worker calls Stacks release function with escrow id/trade id and buyer address.
5. Worker stores releaseTxId.
6. Chain watcher confirms release.
7. Worker updates EscrowLock to RELEASE_CONFIRMED.
8. Worker moves Trade to CRYPTO_RELEASED.
9. Worker enqueues seller payout job.
```

### Acceptance Criteria

```text
- Release cannot run before fiat is secured.
- Release cannot run twice for the same trade.
- Release tx id is unique.
- Failed release moves trade to FAILED_NEEDS_REVIEW.
```

---

## 6.5 Seller Payout

### User Story

As the seller, after crypto is released, I receive the fiat amount in my bank account.

### Flow

```text
1. Worker picks up CRYPTO_RELEASED trade.
2. Worker verifies seller bank account exists and is verified.
3. Worker creates Payout with merchantTxRef and idempotencyKey.
4. Worker calls Nomba transfer/payout API.
5. Worker updates Payout status to PENDING/PROCESSING.
6. Nomba sends payout webhook.
7. Webhook handler stores event and enqueues payout processing.
8. Worker confirms payout status with provider.
9. If successful, Trade moves to COMPLETED.
10. If failed, Trade moves to FAILED_NEEDS_REVIEW.
```

### Acceptance Criteria

```text
- Payout cannot begin before crypto release is confirmed.
- Payout calls use idempotency keys.
- Failed payout does not attempt to reverse crypto automatically.
- Admin can retry failed payout safely.
```

---

## 7. API Route Contracts

Use JSON responses in this shape:

```ts
export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiError = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
```

### 7.1 `GET /api/health`

Returns basic health.

```json
{
  "ok": true,
  "data": {
    "status": "healthy"
  }
}
```

### 7.2 `POST /api/trades`

Creates seller trade.

Request:

```json
{
  "sellerWalletAddress": "ST...",
  "cryptoAsset": "STX",
  "cryptoAmountMicro": "100000000",
  "fiatExpectedMinor": "15000000",
  "sellerBankAccountId": "bank_account_uuid"
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "tradeId": "uuid",
    "status": "DRAFT"
  }
}
```

### 7.3 `GET /api/trades`

Query params:

```text
status optional
sellerId optional
buyerId optional
limit optional
cursor optional
```

Response:

```json
{
  "ok": true,
  "data": {
    "items": [],
    "nextCursor": null
  }
}
```

### 7.4 `GET /api/trades/:id`

Returns trade detail, status timeline, virtual account if current user is buyer/seller, and escrow info.

### 7.5 `POST /api/trades/:id/lock`

Stores submitted escrow lock tx id.

Request:

```json
{
  "sellerWalletAddress": "ST...",
  "lockTxId": "0x..."
}
```

### 7.6 `POST /api/trades/:id/accept`

Accepts trade and creates virtual account.

Request:

```json
{
  "buyerWalletAddress": "ST..."
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "tradeId": "uuid",
    "status": "AWAITING_FIAT",
    "payment": {
      "accountNumber": "1234567890",
      "bankName": "Provider Bank",
      "accountName": "URE TRADE ABC123",
      "amountMinor": "15000000",
      "currency": "NGN",
      "expiresAt": "2026-07-01T12:00:00.000Z"
    }
  }
}
```

### 7.7 `GET /api/trades/:id/status`

Lightweight polling endpoint for UI.

Response:

```json
{
  "ok": true,
  "data": {
    "tradeId": "uuid",
    "status": "AWAITING_FIAT",
    "fiatReceivedMinor": "0",
    "escrowStatus": "LOCK_CONFIRMED",
    "payoutStatus": "NOT_STARTED"
  }
}
```

### 7.8 `POST /api/nomba/webhook`

Receives raw provider webhook.

Rules:

```text
- Must read raw body.
- Must verify signature before trusting payload.
- Must store raw headers and raw payload.
- Must be idempotent.
- Must return 2XX for duplicate already-seen valid events.
- Must not release crypto directly.
```

Response:

```json
{
  "ok": true,
  "data": {
    "received": true
  }
}
```

### 7.9 `GET /api/admin/trades/:id`

Admin-only trade inspection endpoint.

Returns:

```text
Trade
VirtualAccount
EscrowLock
FiatTransactions
Payouts
WebhookEvents linked by transaction/session/reference
AuditLogs
Jobs
```

---

## 8. Service Layer Requirements

### 8.1 `trade-service.ts`

Responsibilities:

```text
- Create trade
- Accept trade
- Validate state transitions
- Update status with audit log
- Fetch trade detail
- Cancel trade when allowed
```

Required functions:

```ts
createTrade(input): Promise<Trade>
acceptTrade(input): Promise<TradeWithVirtualAccount>
transitionTradeStatus(input): Promise<Trade>
getTradeDetail(id): Promise<TradeDetail>
assertCanTransition(from, to): void
```

### 8.2 `payment-service.ts`

Responsibilities:

```text
- Create virtual account
- Parse provider payment webhook
- Requery provider transaction
- Create fiat transaction records
- Decide if fiat is secured
```

Required functions:

```ts
createVirtualAccountForTrade(tradeId): Promise<VirtualAccount>
processPaymentWebhookEvent(webhookEventId): Promise<void>
confirmFiatTransaction(providerTransactionId): Promise<FiatTransaction>
```

### 8.3 `escrow-service.ts`

Responsibilities:

```text
- Build lock transaction data for wallet
- Store lock tx id
- Confirm lock
- Release escrow
- Confirm release
- Handle refund path later
```

Required functions:

```ts
buildLockTransaction(tradeId): Promise<LockTxPayload>
recordLockTransaction(tradeId, txId): Promise<void>
confirmLock(tradeId): Promise<void>
releaseEscrow(tradeId): Promise<void>
confirmRelease(tradeId): Promise<void>
```

### 8.4 `payout-service.ts`

Responsibilities:

```text
- Create payout records
- Call provider payout API
- Confirm payout status
- Retry failed payout safely
```

Required functions:

```ts
initiateSellerPayout(tradeId): Promise<Payout>
processPayoutWebhookEvent(webhookEventId): Promise<void>
retryPayout(payoutId): Promise<Payout>
```

---

## 9. Provider Adapter: Nomba

Create `src/lib/nomba.ts` as a provider adapter. Keep provider-specific request/response details isolated in this file.

### Required Methods

```ts
export interface NombaClient {
  getAccessToken(): Promise<string>;
  createVirtualAccount(input: CreateVirtualAccountInput): Promise<CreateVirtualAccountResult>;
  verifyWebhook(input: VerifyWebhookInput): Promise<boolean>;
  fetchTransaction(input: FetchTransactionInput): Promise<NombaTransaction>;
  initiateTransfer(input: InitiateTransferInput): Promise<InitiateTransferResult>;
  fetchTransfer(input: FetchTransferInput): Promise<NombaTransfer>;
}
```

### Idempotency

All transfer/payout calls must include a stable idempotency key generated from the trade id and payout id.

Example:

```ts
const idempotencyKey = `ure:payout:${tradeId}:${payoutId}`;
```

### Event Mapping

Create a provider event mapper instead of scattering string checks across the app.

```ts
export type InternalProviderEvent =
  | "PAYMENT_SUCCESS"
  | "PAYMENT_REVERSED"
  | "PAYOUT_SUCCESS"
  | "PAYOUT_FAILED"
  | "UNKNOWN";

export function mapNombaEventType(providerEventType: string): InternalProviderEvent {
  switch (providerEventType) {
    case "payment_success":
      return "PAYMENT_SUCCESS";
    case "payment_reversal":
      return "PAYMENT_REVERSED";
    case "payout_success":
      return "PAYOUT_SUCCESS";
    case "payout_failed":
      return "PAYOUT_FAILED";
    default:
      return "UNKNOWN";
  }
}
```

Before production, verify the exact provider event names, signature headers, and transfer endpoint payload against the current Nomba docs and sandbox responses.

---

## 10. Stacks Escrow Contract Requirements

### MVP Contract Behavior

Implement a Clarity contract that supports:

```text
- Lock STX for a trade id.
- Store seller, amount, buyer if known, oracle, expiry.
- Release STX to buyer only through authorized release path.
- Refund seller after expiry if fiat was not secured.
- Prevent double release or double refund.
- Emit useful print events for indexers/watchers.
```

### Suggested Contract State

```clarity
(define-map escrows
  { trade-id: (buff 36) }
  {
    seller: principal,
    buyer: (optional principal),
    amount: uint,
    oracle: principal,
    expires-at: uint,
    status: (string-ascii 20)
  }
)
```

### Suggested Public Functions

```clarity
(define-public (lock (trade-id (buff 36)) (amount uint) (expires-at uint)))
(define-public (assign-buyer (trade-id (buff 36)) (buyer principal)))
(define-public (release (trade-id (buff 36))))
(define-public (refund-after-expiry (trade-id (buff 36))))
(define-read-only (get-escrow (trade-id (buff 36))))
```

### Security Rules

```text
- Seller cannot lock amount of zero.
- Trade id cannot be reused.
- Release fails unless escrow exists.
- Release fails unless buyer is assigned.
- Release fails if already released/refunded.
- Refund fails before expiry.
- Refund fails after release.
- Only oracle can release in MVP.
```

---

## 11. Frontend Requirements

### Design Direction

```text
Theme: dark mode, high contrast
Style: modern fintech/Web3
Tone: clear, trust-building, minimal noise
Priority: make state and next action obvious
```

### Pages

#### `/`

Landing page.

Sections:

```text
- Hero: "P2P crypto trades without screenshot fraud"
- How it works
- Safety model
- CTA: Connect Wallet
```

#### `/dashboard`

User dashboard.

Features:

```text
- Connected wallet display
- Create trade button
- User's selling trades
- User's buying trades
- Status badges
```

#### `/trade/[id]`

Trade detail page.

Seller view:

```text
- Trade amount
- Escrow lock status
- Buyer status
- Fiat payment status
- Payout status
```

Buyer view:

```text
- Trade amount
- Accept button if not accepted
- NUBAN payment card after acceptance
- Exact amount warning
- Status timeline
```

#### `/admin`

Admin dashboard.

Features:

```text
- Search trade by id
- Filter stuck trades
- View webhooks
- View payouts
- Retry failed payout
- Mark for review
```

### Components

```text
ConnectWallet.tsx
CreateTradeForm.tsx
TradeCard.tsx
TradeStatusTimeline.tsx
PaymentInstructionCard.tsx
AmountDisplay.tsx
StatusBadge.tsx
AdminTradeInspector.tsx
```

---

## 12. Background Jobs

For MVP, a database-backed queue is acceptable. Do not introduce Redis/BullMQ unless needed.

### Job Types

```text
PROCESS_PAYMENT_WEBHOOK
RELEASE_CRYPTO
CONFIRM_CRYPTO_RELEASE
INITIATE_SELLER_PAYOUT
PROCESS_PAYOUT_WEBHOOK
RECONCILE_STALE_TRADE
```

### Job Rules

```text
- Jobs must be idempotent.
- Jobs must use row locking or atomic status updates to avoid duplicate workers.
- Jobs must track attempts and error messages.
- Failed jobs should retry with backoff until maxAttempts.
- After maxAttempts, move related trade to FAILED_NEEDS_REVIEW where appropriate.
```

### Database Queue Claim Pattern

Use a transaction:

```text
1. Find first PENDING job where runAfter <= now.
2. Update status to RUNNING, set lockedAt, lockedBy.
3. Commit.
4. Execute job.
5. Mark SUCCEEDED or FAILED.
```

---

## 13. Security Requirements

### Webhook Security

```text
- Verify HMAC/signature using raw body.
- Reject invalid signatures.
- Store invalid attempts for audit, but do not process them.
- Enforce idempotency by request id/event id/transaction id/session id.
- Requery provider before state transition.
```

### API Security

```text
- Validate all inputs with zod.
- Never trust wallet address from body without session/signature model.
- Admin endpoints must require admin wallet or server-side admin auth.
- Rate-limit trade creation and accept endpoints.
- Use CSRF-safe patterns for authenticated browser actions.
```

### Money Safety

```text
- Use integer minor units.
- Never compare floats.
- Confirm exact amount before release.
- Do not release crypto for partial payment in MVP.
- Do not start payout before crypto release confirmation.
```

### Key Management

```text
- ESCROW_ORACLE_PRIVATE_KEY must never enter frontend bundle.
- Rotate compromised oracle key by contract upgrade or admin mechanism.
- Avoid logging secrets, tokens, signatures, or private keys.
```

### Logging

```text
- Log event ids, trade ids, status changes, and provider refs.
- Do not log full bank account numbers.
- Do not log provider access tokens.
```

---

## 14. Validation Requirements

Use `zod` schemas for all route inputs.

### Example Trade Create Schema

```ts
import { z } from "zod";

export const createTradeSchema = z.object({
  sellerWalletAddress: z.string().min(10),
  cryptoAsset: z.literal("STX"),
  cryptoAmountMicro: z.string().regex(/^\d+$/),
  fiatExpectedMinor: z.string().regex(/^\d+$/),
  sellerBankAccountId: z.string().uuid(),
});
```

### Amount Validation

```text
- cryptoAmountMicro > 0
- fiatExpectedMinor > 0
- fiatExpectedMinor must fit in database BigInt
- cryptoAmountMicro must fit in database BigInt
```

---

## 15. Testing Plan

### Unit Tests

```text
state-machine.test.ts
- allows valid transitions
- rejects invalid transitions
- terminal states cannot move

money.test.ts
- parses NGN to kobo
- formats kobo to NGN
- parses STX to micro-STX
- rejects floats with too many decimals

webhook-verification.test.ts
- accepts valid signature
- rejects invalid signature
- rejects replay if event id already exists

idempotency.test.ts
- same trade/payout generates same idempotency key
```

### Integration Tests

```text
trade-service.integration.test.ts
- create trade
- accept trade
- prevent duplicate acceptance
- prevent seller accepting own trade

payment-service.integration.test.ts
- create virtual account
- process payment webhook
- reject wrong amount
- ignore duplicate webhook

payout-service.integration.test.ts
- create payout
- idempotent retry
- process success webhook
- process failed webhook
```

### Contract Tests

```text
escrow-contract.test.ts
- seller locks STX
- cannot lock zero amount
- cannot reuse trade id
- oracle releases to buyer
- non-oracle cannot release
- cannot release twice
- seller can refund after expiry
- seller cannot refund before expiry
```

### End-to-End Happy Path

```text
1. Seller connects wallet.
2. Seller creates trade.
3. Seller locks STX.
4. App confirms lock.
5. Buyer accepts trade.
6. App creates virtual account.
7. Simulated Nomba payment webhook arrives.
8. Worker confirms fiat.
9. Worker releases STX.
10. Chain confirmation marks crypto released.
11. Worker initiates seller payout.
12. Simulated payout success webhook arrives.
13. Trade becomes COMPLETED.
```

### Failure E2E Tests

```text
- Duplicate payment webhook does not release twice.
- Wrong amount does not release.
- Invalid signature does not release.
- Release transaction failure moves trade to review.
- Payout failure moves trade to review.
- Expired unpaid trade becomes cancellable/refundable.
```

---

## 16. Implementation Order for Codex

Follow this order. Do not jump ahead.

### Step 1 — Project Setup

```text
- Create or update Next.js App Router project.
- Add TypeScript strict mode.
- Add Tailwind CSS.
- Add Prisma and PostgreSQL config.
- Add zod.
- Add test framework.
- Create .env.example.
```

Done when:

```text
npm run lint passes
npm run test passes with placeholder tests
Prisma client generates
```

### Step 2 — Prisma Schema and State Machine

```text
- Implement Prisma schema from this file.
- Run migration.
- Implement state-machine.ts.
- Add state-machine unit tests.
- Add audit log helper.
```

Done when:

```text
State transition tests pass.
Trade status cannot be updated except through service function.
```

### Step 3 — Trade Service and Routes

```text
- Implement createTrade.
- Implement getTradeDetail.
- Implement acceptTrade skeleton without real Nomba first.
- Implement API routes with zod validation.
- Implement dashboard and trade detail placeholder UI.
```

Done when:

```text
Seller can create a trade.
Buyer cannot accept invalid trade.
API errors are consistent.
```

### Step 4 — Wallet Connect UI

```text
- Add Leather/Xverse connect component.
- Store wallet address in app state/session.
- Use connected wallet for trade creation and acceptance.
```

Done when:

```text
User can connect wallet.
Wallet address appears in dashboard.
```

### Step 5 — Escrow Contract MVP

```text
- Create escrow.clar.
- Add contract tests.
- Add lock/release/refund functions.
- Add Stacks client wrapper.
- Add record lock tx endpoint.
```

Done when:

```text
Contract tests pass.
Seller lock tx can be recorded.
Mock/testnet confirmation updates escrow status.
```

### Step 6 — Nomba Adapter

```text
- Implement Nomba auth.
- Implement createVirtualAccount.
- Implement webhook verification.
- Implement fetch/requery transaction.
- Implement initiateTransfer.
- Add mocked integration tests.
```

Done when:

```text
acceptTrade creates and stores VirtualAccount.
PaymentInstructionCard shows correct account info.
```

### Step 7 — Webhook and Job Queue

```text
- Implement WebhookEvent persistence.
- Implement database job queue.
- Implement PROCESS_PAYMENT_WEBHOOK.
- Make webhook route idempotent.
```

Done when:

```text
Simulated payment webhook creates WebhookEvent.
Duplicate webhook is ignored safely.
Exact successful payment moves trade to FIAT_SECURED.
```

### Step 8 — Crypto Release Worker

```text
- Implement RELEASE_CRYPTO job.
- Implement CONFIRM_CRYPTO_RELEASE job.
- Store release tx id.
- Move trade through RELEASING_CRYPTO → CRYPTO_RELEASED.
```

Done when:

```text
Fiat-secured trade releases crypto once.
Release failure moves trade to FAILED_NEEDS_REVIEW.
```

### Step 9 — Seller Payout Worker

```text
- Implement INITIATE_SELLER_PAYOUT job.
- Implement PROCESS_PAYOUT_WEBHOOK job.
- Use idempotency key.
- Move trade through PAYOUT_PENDING → COMPLETED.
```

Done when:

```text
Crypto-released trade starts payout.
Payout success completes trade.
Payout failure moves trade to review.
```

### Step 10 — Admin Dashboard

```text
- Implement admin trade inspector.
- Show audit logs, webhooks, fiat txs, escrow, payouts, jobs.
- Add retry failed payout action.
- Add manual mark-for-review action.
```

Done when:

```text
Admin can understand and recover stuck trades.
Admin actions create audit logs.
```

### Step 11 — Hardening

```text
- Add rate limits.
- Add structured logs.
- Add monitoring hooks.
- Add database indexes.
- Add test coverage for failure cases.
- Remove unsafe console logs.
- Verify environment variable validation.
```

Done when:

```text
All unit/integration tests pass.
Happy-path E2E passes.
Duplicate/replay/failure E2E tests pass.
```

---

## 17. Codex Working Rules

When implementing this project, follow these rules:

```text
1. Prefer small, reviewable commits/patches.
2. Do not invent provider API fields when unsure; isolate assumptions inside adapter types.
3. Add tests for every state transition and money movement.
4. Never update Trade.status directly outside trade-service.ts.
5. Never release crypto in a webhook route.
6. Never use JS floats for money.
7. Never expose provider secrets or oracle private keys to client code.
8. Keep UI simple until the happy path works.
9. Make all external side-effect operations idempotent.
10. Put TODO comments where sandbox/provider confirmation is required.
```

---

## 18. Initial Package Suggestions

```json
{
  "dependencies": {
    "@prisma/client": "latest",
    "@stacks/connect": "latest",
    "@stacks/network": "latest",
    "@stacks/transactions": "latest",
    "zod": "latest",
    "clsx": "latest",
    "lucide-react": "latest"
  },
  "devDependencies": {
    "prisma": "latest",
    "typescript": "latest",
    "vitest": "latest",
    "tsx": "latest",
    "eslint": "latest",
    "prettier": "latest"
  }
}
```

Before installing, verify the current Stacks package names and versions for the selected Stacks.js release.

---

## 19. README Outline

Create `README.md` with:

```text
# Ure

## What it does
## MVP scope
## Architecture
## Local setup
## Environment variables
## Database setup
## Running tests
## Running workers
## Nomba sandbox setup
## Stacks testnet setup
## Security model
## Known limitations
## Roadmap
```

---

## 20. Known Limitations to Document

```text
- MVP uses backend-authorized escrow release.
- MVP supports only STX, not sBTC.
- MVP supports only exact NGN payments.
- MVP does not provide fully decentralized dispute resolution.
- MVP depends on Nomba webhook and reconciliation reliability.
- MVP requires admin review for failed payouts or failed chain releases.
```

---

## 21. Launch Checklist

```text
[ ] Provider webhook signature verification tested with real sandbox payloads
[ ] Provider payment requery tested
[ ] Provider payout idempotency tested
[ ] Duplicate webhook replay tested
[ ] Stacks escrow lock tested on testnet
[ ] Stacks escrow release tested on testnet
[ ] Failed release recovery path tested
[ ] Failed payout recovery path tested
[ ] Admin dashboard protected
[ ] Secrets excluded from logs and repo
[ ] Database backups configured
[ ] Monitoring and alerts configured
[ ] Legal/compliance review completed
[ ] User-facing copy accurately describes the trust model
```

---

## 22. Final MVP Definition of Done

The MVP is done when this full flow works on testnet/sandbox without manual intervention:

```text
1. Seller connects wallet.
2. Seller creates trade to sell STX for NGN.
3. Seller locks STX in escrow contract.
4. Buyer connects wallet.
5. Buyer accepts trade.
6. Ure creates a dedicated virtual account for the trade.
7. Buyer pays the exact NGN amount.
8. Nomba webhook arrives and is verified.
9. Ure requeries provider transaction and confirms payment.
10. Ure releases STX to buyer.
11. Ure confirms chain release.
12. Ure initiates seller payout.
13. Ure confirms payout success.
14. Trade status becomes COMPLETED.
15. Full audit trail is visible in admin.
```

