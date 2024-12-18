import Fastify from "fastify";
import * as dotenv from "dotenv";
import multipart from "@fastify/multipart";
import { uploadHandler } from "./uploadHandler";
import { connectToDB } from "./db";
import { handleRPCRequest } from "./handlers";

dotenv.config();
const HOST = process.env.HOST || "localhost";
const PORT = Number(process.env.PORT || 3000);
const DATABASE_URL = process.env.DATABASE_URL || "mongodb://localhost:27017";
const DATABASE = process.env.DATABASE || "ambrodeo";
const fastify = Fastify({
  bodyLimit: 5000000,
  logger: true,
});

fastify.register(multipart);

const startServer = async () => {
  try {
    await connectToDB(DATABASE_URL, DATABASE);
    fastify.post("/", async (request, reply) => {
      const result = await handleRPCRequest(request.body);
      return reply.send(result);
    });

    fastify.post("/image", uploadHandler);

    await fastify.listen({ host: HOST, port: PORT });
    console.log(`Server running on http://${HOST}:${PORT}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};

startServer();
