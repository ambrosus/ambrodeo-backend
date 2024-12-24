import * as dotenv from "dotenv";
dotenv.config();

export const HOST = process.env.HOST || "localhost";
export const PORT = Number(process.env.PORT || 3000);
export const DATABASE_URL =
  process.env.DATABASE_URL || "mongodb://localhost:27017";
export const DATABASE = process.env.DATABASE || "ambrodeo";
export const SUBGRAPHS_ENDPOINT = process.env.SUBGRAPHS_ENDPOINT || "";
