-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('DRAFT', 'AWAITING_CRYPTO_LOCK', 'CRYPTO_LOCKED', 'AWAITING_BUYER', 'AWAITING_FIAT', 'FIAT_SECURED', 'RELEASING_CRYPTO', 'CRYPTO_RELEASED', 'PAYOUT_PENDING', 'COMPLETED', 'CANCELLED', 'REFUND_PENDING', 'FAILED_NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "CryptoAsset" AS ENUM ('STX');

-- CreateEnum
CREATE TYPE "FiatCurrency" AS ENUM ('NGN');

-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('NOT_STARTED', 'LOCK_PENDING', 'LOCK_CONFIRMED', 'RELEASE_PENDING', 'RELEASE_CONFIRMED', 'REFUND_PENDING', 'REFUND_CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "FiatTransactionStatus" AS ENUM ('RECEIVED', 'CONFIRMED', 'IGNORED', 'REVERSED', 'FAILED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'nomba',
    "bankCode" TEXT NOT NULL,
    "bankName" TEXT,
    "accountNumberMasked" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "recipientReference" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT,
    "sellerBankAccountId" TEXT,
    "cryptoAsset" "CryptoAsset" NOT NULL DEFAULT 'STX',
    "cryptoAmountMicro" BIGINT NOT NULL,
    "fiatCurrency" "FiatCurrency" NOT NULL DEFAULT 'NGN',
    "fiatExpectedMinor" BIGINT NOT NULL,
    "fiatReceivedMinor" BIGINT NOT NULL DEFAULT 0,
    "status" "TradeStatus" NOT NULL DEFAULT 'DRAFT',
    "expiresAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VirtualAccount" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'nomba',
    "providerAccountId" TEXT,
    "accountReference" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountName" TEXT,
    "expectedAmountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "expiresAt" TIMESTAMP(3),
    "rawProviderPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VirtualAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowLock" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "chain" TEXT NOT NULL DEFAULT 'stacks',
    "network" TEXT NOT NULL DEFAULT 'testnet',
    "contractAddress" TEXT NOT NULL,
    "contractName" TEXT NOT NULL,
    "escrowIdOnChain" TEXT,
    "lockTxId" TEXT,
    "releaseTxId" TEXT,
    "refundTxId" TEXT,
    "sellerAddress" TEXT NOT NULL,
    "buyerAddress" TEXT,
    "oracleAddress" TEXT,
    "amountMicro" BIGINT NOT NULL,
    "status" "EscrowStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "rawLockPayload" JSONB,
    "rawReleasePayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscrowLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiatTransaction" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'nomba',
    "providerTransactionId" TEXT,
    "sessionId" TEXT,
    "accountReference" TEXT,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "FiatTransactionStatus" NOT NULL DEFAULT 'RECEIVED',
    "providerStatus" TEXT,
    "payerName" TEXT,
    "payerAccountMasked" TEXT,
    "rawProviderPayload" JSONB,
    "receivedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiatTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "bankAccountId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'nomba',
    "providerTransferId" TEXT,
    "merchantTxRef" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "PayoutStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "providerStatus" TEXT,
    "failureReason" TEXT,
    "rawProviderPayload" JSONB,
    "initiatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'nomba',
    "eventType" TEXT NOT NULL,
    "requestId" TEXT,
    "providerEventId" TEXT,
    "providerTransactionId" TEXT,
    "sessionId" TEXT,
    "signatureValid" BOOLEAN NOT NULL DEFAULT false,
    "status" "WebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "rawHeaders" JSONB,
    "rawPayload" JSONB NOT NULL,
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE INDEX "BankAccount_userId_idx" ON "BankAccount"("userId");

-- CreateIndex
CREATE INDEX "Trade_sellerId_idx" ON "Trade"("sellerId");

-- CreateIndex
CREATE INDEX "Trade_buyerId_idx" ON "Trade"("buyerId");

-- CreateIndex
CREATE INDEX "Trade_status_idx" ON "Trade"("status");

-- CreateIndex
CREATE INDEX "Trade_createdAt_idx" ON "Trade"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VirtualAccount_tradeId_key" ON "VirtualAccount"("tradeId");

-- CreateIndex
CREATE UNIQUE INDEX "VirtualAccount_providerAccountId_key" ON "VirtualAccount"("providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "VirtualAccount_accountReference_key" ON "VirtualAccount"("accountReference");

-- CreateIndex
CREATE INDEX "VirtualAccount_accountNumber_idx" ON "VirtualAccount"("accountNumber");

-- CreateIndex
CREATE INDEX "VirtualAccount_accountReference_idx" ON "VirtualAccount"("accountReference");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowLock_tradeId_key" ON "EscrowLock"("tradeId");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowLock_lockTxId_key" ON "EscrowLock"("lockTxId");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowLock_releaseTxId_key" ON "EscrowLock"("releaseTxId");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowLock_refundTxId_key" ON "EscrowLock"("refundTxId");

-- CreateIndex
CREATE UNIQUE INDEX "FiatTransaction_providerTransactionId_key" ON "FiatTransaction"("providerTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "FiatTransaction_sessionId_key" ON "FiatTransaction"("sessionId");

-- CreateIndex
CREATE INDEX "FiatTransaction_tradeId_idx" ON "FiatTransaction"("tradeId");

-- CreateIndex
CREATE INDEX "FiatTransaction_accountReference_idx" ON "FiatTransaction"("accountReference");

-- CreateIndex
CREATE INDEX "FiatTransaction_createdAt_idx" ON "FiatTransaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_providerTransferId_key" ON "Payout"("providerTransferId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_merchantTxRef_key" ON "Payout"("merchantTxRef");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_idempotencyKey_key" ON "Payout"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payout_tradeId_idx" ON "Payout"("tradeId");

-- CreateIndex
CREATE INDEX "Payout_sellerId_idx" ON "Payout"("sellerId");

-- CreateIndex
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_requestId_key" ON "WebhookEvent"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_providerEventId_key" ON "WebhookEvent"("providerEventId");

-- CreateIndex
CREATE INDEX "WebhookEvent_eventType_idx" ON "WebhookEvent"("eventType");

-- CreateIndex
CREATE INDEX "WebhookEvent_providerTransactionId_idx" ON "WebhookEvent"("providerTransactionId");

-- CreateIndex
CREATE INDEX "WebhookEvent_sessionId_idx" ON "WebhookEvent"("sessionId");

-- CreateIndex
CREATE INDEX "WebhookEvent_createdAt_idx" ON "WebhookEvent"("createdAt");

-- CreateIndex
CREATE INDEX "Job_type_status_runAfter_idx" ON "Job"("type", "status", "runAfter");

-- CreateIndex
CREATE INDEX "AuditLog_tradeId_idx" ON "AuditLog"("tradeId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_sellerBankAccountId_fkey" FOREIGN KEY ("sellerBankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualAccount" ADD CONSTRAINT "VirtualAccount_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowLock" ADD CONSTRAINT "EscrowLock_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiatTransaction" ADD CONSTRAINT "FiatTransaction_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
