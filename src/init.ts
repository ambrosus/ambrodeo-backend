import * as dotenv from "dotenv";
import Fastify, { FastifyInstance } from "fastify";
dotenv.config();

export function getEnv(): {
  HOST: string;
  PORT: number;
  DATABASE_URL: string;
  SUBGRAPHS_ENDPOINT: string;
  UPLOAD_DIR: string;
  PINATA_API_KEY: string;
  PINATA_SECRET_API_KEY: string;
  PINATA_ENDPOINT: string;
} {
  const HOST = process.env.HOST || "localhost";
  const PORT = Number(process.env.PORT || 3000);
  const DATABASE_URL =
    process.env.DATABASE_URL || "mongodb://localhost:27017/ambrodeo";
  const SUBGRAPHS_ENDPOINT = process.env.SUBGRAPHS_ENDPOINT || "";
  const UPLOAD_DIR = process.env.UPLOAD_DIR || __dirname;
  const PINATA_API_KEY = process.env.PINATA_API_KEY || "";
  const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY || "";
  const PINATA_ENDPOINT = process.env.PINATA_ENDPOINT || "";
  return {
    HOST,
    PORT,
    DATABASE_URL,
    SUBGRAPHS_ENDPOINT,
    UPLOAD_DIR,
    PINATA_API_KEY,
    PINATA_SECRET_API_KEY,
    PINATA_ENDPOINT,
  };
}

export function initFastify(): FastifyInstance {
  return Fastify({
    bodyLimit: 5000000,
    logger: true,
  });
}
