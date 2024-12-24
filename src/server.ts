import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { handleRPCRequest } from "./handlers";
import { uploadHandler } from "./uploadHandler";
import { connectToDB } from "./db";
import { HOST, PORT, DATABASE_URL, DATABASE } from "./env";
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

    fastify.post("/images", uploadHandler);

    await fastify.listen({ host: HOST, port: PORT });
    console.log(`Server running on http://${HOST}:${PORT}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};

startServer();
