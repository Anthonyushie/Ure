import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  APP_SECRET: z.string().min(24).optional(),
  DATABASE_URL: z.string().min(1),
  NOMBA_BASE_URL: z.url().optional(),
  NOMBA_CLIENT_ID: z.string().optional(),
  NOMBA_CLIENT_SECRET: z.string().optional(),
  NOMBA_ACCOUNT_ID: z.string().optional(),
  NOMBA_SUBACCOUNT_ID: z.string().optional(),
  NOMBA_WEBHOOK_SECRET: z.string().optional(),
  STACKS_NETWORK: z.enum(["testnet", "mainnet", "devnet"]).default("testnet"),
  STACKS_API_URL: z.url().optional(),
  ESCROW_CONTRACT_ADDRESS: z.string().optional(),
  ESCROW_CONTRACT_NAME: z.string().default("ure-escrow"),
  ESCROW_ORACLE_PRIVATE_KEY: z.string().optional(),
  QUEUE_DRIVER: z.enum(["database"]).default("database"),
  JOB_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  CRON_SECRET: z.string().optional(),
  ADMIN_WALLET_ADDRESSES: z.string().default(""),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (!cachedEnv) {
    cachedEnv = serverEnvSchema.parse(process.env);
  }

  return cachedEnv;
}
