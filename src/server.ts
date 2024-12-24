import Fastify from "fastify";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import { OpenAPIV3 } from "openapi-types";
import swaggerUi from "@fastify/swagger-ui";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { handleRPCRequest } from "./handlers";
import { uploadHandler } from "./uploadHandler";
import { connectToDB } from "./db";
import { HOST, PORT, DATABASE_URL, DATABASE } from "./env";
const fastify = Fastify({
  bodyLimit: 5000000,
  logger: true,
});

const openApiSpec = yaml.load(
  fs.readFileSync(path.join(__dirname, "api.yaml"), "utf8"),
) as OpenAPIV3.Document;

fastify.register(swagger, {
  openapi: openApiSpec,
});

fastify.register(swaggerUi, {
  routePrefix: "/docs",
  uiConfig: {
    docExpansion: "full",
    deepLinking: false,
  },
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
