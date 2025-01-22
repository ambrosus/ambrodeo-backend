import Fastify, { FastifyReply, FastifyRequest } from "fastify";
import multipart from "@fastify/multipart";
import mongodb from "@fastify/mongodb";
import axios from "axios";
import crypto from "crypto";
import { ethers } from "ethers";
import yaml from "js-yaml";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { OpenAPIV3 } from "openapi-types";
import { getEnv, initFastify } from "./init";
import { docs } from "./documentation";
import cors from "@fastify/cors";
import { PinataSDK } from "pinata-web3";
import { Blob } from "buffer";

const query = `query GetToken($tokenAddress: ID!) {token(id: $tokenAddress) {id}}`;
const {
  HOST,
  PORT,
  DATABASE_URL,
  SUBGRAPHS_ENDPOINT,
  PINATA_JWT,
  PINATA_GATEWAY,
} = getEnv();
const fastify = initFastify();
const mapSecret = new Map();
const pinata = new PinataSDK({
  pinataJwt: PINATA_JWT,
  pinataGateway: PINATA_GATEWAY,
});

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
        let { address, signature } = request.headers as {
          address?: string;
          signature?: string;
        };
        address = address.toLowerCase();
        const secret = mapSecret.get(address);
        if (!signature || !address || !secret) {
          return reply.status(400).send({
            error: "Missing address or signature in headers",
          });
        }
        const recoveredAddress = ethers.verifyMessage(secret, signature);
        if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
          return reply.status(401).send({
            error: "Invalid signature",
            address: address,
            signature: signature,
            secret: secret,
          });
        }
      } catch (error) {
        request.log.error(error);
        return reply.status(400).send({ error: error });
      }
    });

    fastify.get("/", index);
    fastify.post("/api/upload", uploadFile);
    fastify.post("/api/user", addOrUpdateUser);
    fastify.post("/api/message", addMessage);
    fastify.post("/api/like", addOrDeleteLike);
    fastify.post("/api/follow", addfollow);
    fastify.get("/api/user", getUser);
    fastify.get("/api/messages", getMessages);
    fastify.get("/api/token", getToken);
    fastify.get("/api/likes", getUserLikes);
    fastify.get("/api/secret", getSecret);
    fastify.get("/api/followers", getFollowers);
    fastify.get("/api/followed", getFollowed);
    fastify.get("/api/messagesbyuser", getMessagesByUser);
    fastify.get("/api/messagereplies", getMessageReplies);

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
          $set: {
            tokenAddress,
            like: 0,
            timestamp: new Date(),
          },
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

    let { address } = request.headers as { address?: string };
    let { tokenAddress, message, id } = data as {
      tokenAddress: string;
      message: string;
      id: string;
    };

    address = address.toLowerCase();
    tokenAddress = tokenAddress.toLowerCase();
    if (!ethers.isAddress(tokenAddress)) throw new Error("Invalid address");

    if (!checkTokenExist(request, tokenAddress))
      return reply.status(404).send({ token: "Token not found" });
    await request.server.mongo.db?.collection("massage").insertOne({
      address,
      tokenAddress,
      message: message,
      id,
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

    let { address } = request.headers as { address?: string };
    const { userName, image } = data as {
      userName: string;
      image: string;
    };
    address = address.toLowerCase();

    await request.server.mongo.db?.collection("user").updateOne(
      { address },
      {
        $set: {
          address,
          userName,
          image,
          timestamp: new Date(),
        },
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

    let { address } = request.headers as { address?: string };
    let { tokenAddress, like } = data as {
      tokenAddress: string;
      like: boolean;
    };

    address = address.toLowerCase();
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
            $set: {
              address,
              tokenAddress,
              timestamp: new Date(),
            },
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
    let { address } = request.query as { address?: string };
    address = address.toLowerCase();
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
    let { tokenAddress, skip, limit } = request.query as {
      tokenAddress?: string;
      skip?: number;
      limit?: number;
    };
    tokenAddress = tokenAddress.toLowerCase();
    const messages = await request.server.mongo.db
      ?.collection("message")
      .find({ tokenAddress })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await request.server.mongo.db
      ?.collection("message")
      .countDocuments({ tokenAddress });

    return reply.send({ total: total, data: messages });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: error.message });
  }
}

async function getMessagesByUser(request: FastifyRequest, reply: FastifyReply) {
  try {
    let { address, skip, limit } = request.query as {
      address?: string;
      skip?: number;
      limit?: number;
    };
    address = address.toLowerCase();
    const messages = await request.server.mongo.db
      ?.collection("message")
      .find({ address })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await request.server.mongo.db
      ?.collection("message")
      .countDocuments({ address });

    return reply.send({ total: total, data: messages });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: error.message });
  }
}

async function getMessageReplies(request: FastifyRequest, reply: FastifyReply) {
  try {
    let { id, skip, limit } = request.query as {
      id?: string;
      skip?: number;
      limit?: number;
    };
    const messages = await request.server.mongo.db
      ?.collection("message")
      .find({ id })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await request.server.mongo.db
      ?.collection("message")
      .countDocuments({ id });

    return reply.send({ total: total, data: messages });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: error.message });
  }
}

async function getToken(request: FastifyRequest, reply: FastifyReply) {
  try {
    let { tokenAddress } = request.query as {
      tokenAddress?: string;
    };
    tokenAddress = tokenAddress.toLowerCase();
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

    const total = await request.server.mongo.db
      ?.collection("like")
      .countDocuments({ address });

    return reply.send({ total: total, data: likes });
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

    const fileBuffer = await data.toBuffer();
    const blob = new Blob([fileBuffer.buffer]);
    const file = new File([blob], data.filename, {
      type: data.mimetype,
    });

    const upload = await pinata.upload.file(file);
    console.log;
    reply.send({
      success: true,
      cid: upload.IpfsHash,
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: error.message });
  }
}

async function addfollow(request: FastifyRequest, reply: FastifyReply) {
  try {
    const data = request.body;
    if (!data || typeof data !== "object") {
      return reply.status(400).send({ error: "Invalid JSON payload" });
    }

    const { address } = request.headers as { address?: string };
    let { userAddress, add } = data as {
      userAddress: string;
      add: boolean;
    };

    userAddress = userAddress.toLowerCase();
    if (!ethers.isAddress(userAddress)) throw new Error("Invalid address");

    if (add) {
      await request.server.mongo.db?.collection("followers").updateOne(
        { address, userAddress },
        {
          $set: {
            address,
            userAddress,
          },
        },
        { upsert: true },
      );
    } else {
      await request.server.mongo.db
        ?.collection("followers")
        .deleteOne({ address, userAddress });
    }
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: error.message });
  }
  return reply.send({});
}

async function getFollowers(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { userAddress, skip, limit } = request.query as {
      userAddress?: string;
      skip?: number;
      limit?: number;
    };
    const followers = await request.server.mongo.db
      ?.collection("followers")
      .find({ userAddress }, { projection: { _id: 0 } })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await request.server.mongo.db
      ?.collection("followers")
      .countDocuments({ userAddress });

    return reply.send({ total: total, data: followers });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: error.message });
  }
}

async function getFollowed(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { address, skip, limit } = request.query as {
      address?: string;
      skip?: number;
      limit?: number;
    };
    const followerd = await request.server.mongo.db
      ?.collection("followers")
      .find({ address }, { projection: { _id: 0 } })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await request.server.mongo.db
      ?.collection("followers")
      .countDocuments({ address });

    return reply.send({ total: total, data: followerd });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: error.message });
  }
}
startServer();
