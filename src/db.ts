import { MongoClient, Db } from "mongodb";
let db: Db;

export const connectToDB = async (databaseUrl: string, database: string) => {
  try {
    const client = new MongoClient(databaseUrl);
    await client.connect();
    db = client.db(database);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
};

export const getDB = (): Db => {
  if (!db) throw new Error("Database not initialized");
  return db;
};
