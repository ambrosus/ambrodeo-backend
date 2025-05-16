import * as dotenv from "dotenv";
import Fastify, { FastifyInstance } from "fastify";
dotenv.config();

export function getEnv(): {
  HOST: string;
  PORT: number;
  DATABASE_URL: string;
  SUBGRAPHS_ENDPOINT: string;
  PINATA_JWT: string;
  PINATA_GATEWAY: string;
} {
  const HOST = process.env.HOST || "localhost";
  const PORT = Number(process.env.PORT || 3000);
  const DATABASE_URL =
    process.env.DATABASE_URL || "mongodb://localhost:27017/ambrodeo";
  const SUBGRAPHS_ENDPOINT = process.env.SUBGRAPHS_ENDPOINT || "";
  const PINATA_JWT = process.env.PINATA_JWT || "";
  const PINATA_GATEWAY = process.env.PINATA_GATEWAY || "";

  return {
    HOST,
    PORT,
    DATABASE_URL,
    SUBGRAPHS_ENDPOINT,
    PINATA_JWT,
    PINATA_GATEWAY,
  };
}

export function initFastify(): FastifyInstance {
  return Fastify({
    bodyLimit: 10000000,
    logger: true,
  });
}
