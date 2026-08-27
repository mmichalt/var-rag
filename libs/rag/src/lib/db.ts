import type { PrismaClient } from '@var-rag/database';

export type Db = PrismaClient;
export type Tx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;
