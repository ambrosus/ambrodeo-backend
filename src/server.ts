import Fastify, { FastifyReply, FastifyRequest } from "fastify";
import multipart from "@fastify/multipart";
import mongodb from "@fastify/mongodb";
import axios from "axios";
import crypto from "crypto";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { OpenAPIV3 } from "openapi-types";
import { getEnv, initFastify } from "./init";
import { docs } from "./documentation";
import cors from "@fastify/cors";

const query = `query GetToken($tokenAddress: ID!) {token(id: $tokenAddress) {id}}`;
const { HOST, PORT, DATABASE_URL, SUBGRAPHS_ENDPOINT, UPLOAD_DIR } = getEnv();
const fastify = initFastify();
const mapSecret = new Map();

const startServer = async () => {
  try {
    const openApiSpec = yaml.load(docs) as OpenAPIV3.Document;

    fastify.register(cors, {
      origin: "*",
    });

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

    fastify.register(mongodb, {
      forceClose: true,
      url: DATABASE_URL,
    });

    fastify.register(multipart);
    fastify.addHook("preHandler", async (request, reply) => {
      if (request.method != "POST") {
        return;
      }

      try {
        const { address, signature } = request.headers as {
          address?: string;
          signature?: string;
        };
        const secret = mapSecret.get(address);

        if (!signature || !address || !secret) {
          return reply.status(400).send({
            error: "Missing address or signature in headers",
          });
        }
        const recoveredAddress = ethers.verifyMessage(secret, signature);
        if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
          return reply.status(401).send({ error: "Invalid signature" });
        }
      } catch (error) {
        request.log.error(error);
        return reply.status(400).send({ error: error });
      }
    });

    fastify.get("/", index);
    fastify.post("/upload", uploadFile);
    fastify.post("/api/user", addOrUpdateUser);
    fastify.post("/api/message", addMessage);
    fastify.post("/api/like", addOrDeleteLike);
    fastify.get("/api/user", getUser);
    fastify.get("/api/messages", getMessages);
    fastify.get("/api/token", getToken);
    fastify.get("/api/likes", getUserLikes);
    fastify.get("/api/secret", getSecret);

    await fastify.listen({ host: HOST, port: PORT });
    console.log(`Server running on http://${HOST}:${PORT}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};

async function checkTokenExist(
  request: FastifyRequest,
  tokenAddress: string,
): Promise<boolean> {
  try {
    if (
      (await request.server.mongo.db
        ?.collection("token")
        .findOne({ tokenAddress })) != null
    )
      return true;

    const response = await axios.post(
      SUBGRAPHS_ENDPOINT,
      { query, variables: { tokenAddress } },
      {
        headers: { "Content-Type": "application/json" },
      },
    );

    if (tokenAddress == response.data.data.token.id) {
      await request.server.mongo.db?.collection("token").updateOne(
        { tokenAddress },
        {
          tokenAddress,
          like: 0,
          timestamp: new Date(),
        },
        { upsert: true },
      );
      return true;
    }
  } catch (error) {
    request.log.error(error);
    return false;
  }
}

async function index(request: FastifyRequest, reply: FastifyReply) {
  return reply.send({});
}

async function addMessage(request: FastifyRequest, reply: FastifyReply) {
  try {
    const data = request.body;
    if (!data || typeof data !== "object") {
      return reply.status(400).send({ error: "Invalid JSON payload" });
    }

    const { address } = request.headers as { address?: string };
    let { tokenAddress, message } = data as {
      tokenAddress: string;
      message: string;
    };

    tokenAddress = tokenAddress.toLowerCase();
    if (!ethers.isAddress(tokenAddress)) throw new Error("Invalid address");

    if (!checkTokenExist(request, tokenAddress))
      return reply.status(404).send({ token: "Token not found" });
    await request.server.mongo.db?.collection("massage").insertOne({
      address,
      tokenAddress,
      message: message,
      timestamp: new Date(),
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: error.message });
  }

  return reply.send({});
}

async function addOrUpdateUser(request: FastifyRequest, reply: FastifyReply) {
  try {
    const data = request.body;
    if (!data || typeof data !== "object") {
      return reply.status(400).send({ error: "Invalid JSON payload" });
    }

    const { address } = request.headers as { address?: string };
    const { userName, image } = data as {
      userName: string;
      image: string;
    };

    await request.server.mongo.db?.collection("user").updateOne(
      { address },
      {
        address,
        userName,
        image,
        timestamp: new Date(),
      },
      { upsert: true },
    );
  } catch (error) {
    request.log.error(error);
    return reply
      .status(500)

      .send({ error: error.message });
  }
  return reply.send({});
}

async function addOrDeleteLike(request: FastifyRequest, reply: FastifyReply) {
  try {
    const data = request.body;
    if (!data || typeof data !== "object") {
      return reply.status(400).send({ error: "Invalid JSON payload" });
    }

    const { address } = request.headers as { address?: string };
    let { tokenAddress, like } = data as {
      tokenAddress: string;
      like: boolean;
    };

    tokenAddress = tokenAddress.toLowerCase();
    if (!ethers.isAddress(tokenAddress)) throw new Error("Invalid address");

    if (!checkTokenExist(request, tokenAddress))
      return reply.status(404).send({ token: "Token not found" });
    if (like) {
      const result = await request.server.mongo.db
        ?.collection("like")
        .updateOne(
          { address, tokenAddress },
          {
            address,
            tokenAddress,
            timestamp: new Date(),
          },
          { upsert: true },
        );
      if (result.upsertedCount == 1) {
        await request.server.mongo.db
          ?.collection("token")
          .updateOne({ tokenAddress }, { $inc: { like: 1 } });
      }
    } else {
      const result = await request.server.mongo.db
        ?.collection("token")
        .deleteOne({ address, tokenAddress });
      if (result.deletedCount == 1) {
        await request.server.mongo.db
          ?.collection("token")
          .updateOne({ tokenAddress }, { $inc: { like: -1 } });
      }
    }
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: error.message });
  }
  return reply.send({});
}

async function getUser(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { address } = request.headers as { address?: string };
    const user = await request.server.mongo.db
      ?.collection("user")
      .findOne({ address }, { projection: { _id: 0 } });
    return reply.send(user);
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: error.message });
  }
}

async function getMessages(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { tokenAddress, skip, limit } = request.query as {
      tokenAddress?: string;
      skip?: number;
      limit?: number;
    };
    const messages = await request.server.mongo.db
      ?.collection("message")
      .find({ tokenAddress }, { projection: { _id: 0 } })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    return reply.send(messages);
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: error.message });
  }
}

async function getToken(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { tokenAddress } = request.query as {
      tokenAddress?: string;
    };
    const token = await request.server.mongo.db
      ?.collection("token")
      .findOne({ tokenAddress }, { projection: { _id: 0 } });
    return reply.send(token);
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: error.message });
  }
}

async function getUserLikes(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { address } = request.headers as { address?: string };
    const { skip, limit } = request.query as {
      skip?: number;
      limit?: number;
    };
    const likes = await request.server.mongo.db
      ?.collection("like")
      .find({ address }, { projection: { _id: 0 } })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    return reply.send(likes);
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: error.message });
  }
}

async function getSecret(request: FastifyRequest, reply: FastifyReply) {
  try {
    let { address } = request.headers as { address?: string };
    address = address.toLowerCase();
    if (!ethers.isAddress(address)) throw new Error("Invalid address");

    let secret = "AMBRodeo authorization secret: ";
    secret = secret.concat(
      crypto
        .createHash("sha256")
        .update(crypto.getRandomValues(new Uint8Array(32)))
        .digest("hex"),
    );

    mapSecret.set(address, secret);
    reply.send({ secret: secret });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: error.message });
  }
}

async function uploadFile(request: FastifyRequest, reply: FastifyReply) {
  try {
    let { address } = request.headers as { address?: string };
    address = address.toLowerCase();
    const data = await request.file();
    if (!data) {
      reply.code(400).send({ error: "No file uploaded" });
      return;
    }

    const uploadDir = path.join(UPLOAD_DIR, "files", address);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, data.filename);
    await new Promise<void>((resolve, reject) => {
      const writeStream = fs.createWriteStream(filePath);
      data.file.pipe(writeStream);

      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    reply.send({
      success: true,
      message: "File uploaded",
      filename: data.filename,
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: error.message });
  }
}

startServer();
