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
import { ObjectId } from "mongodb";
import sharp from "sharp";
import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";

const query = `query GetToken($tokenAddress: String!) {tokens(where: { id: $tokenAddress }) {id}}`;
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

const tables = {
  user: "user",
  token: "token",
  message: "message",
  like: "like",
  messagelike: "messagelike",
  userlike: "userlike",
  followers: "followers",
};

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

        const user = await request.server.mongo.db
          ?.collection(tables.user)
          .findOne({ address }, { projection: { _id: 0 } });

        if (!user) {
          await request.server.mongo.db
            ?.collection(tables.user)
            .updateOne(
              { address },
              { $set: { userName: "", image: "" } },
              { upsert: true },
            );
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
    fastify.post("/api/userlike", addOrDeleteUsertLike);
    fastify.post("/api/messagelike", addOrDeleteMessageLike);
    fastify.get("/api/user", getUser);
    fastify.get("/api/messages", getMessages);
    fastify.get("/api/token", getToken);
    fastify.get("/api/userlikes", getUserLikes);
    fastify.get("/api/messagelikes", getMessageLikes);
    fastify.get("/api/secret", getSecret);
    fastify.get("/api/followers", getFollowers);
    fastify.get("/api/followed", getFollowed);
    fastify.get("/api/messagesbyuser", getMessagesByUser);
    fastify.get("/api/messagereplies", getMessageReplies);
    fastify.get("/api/isfollowed", getIsFollowed);
    fastify.get("/api/isliked", getIsLiked);

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
      await request.server.mongo.db
        ?.collection(tables.token)
        .findOne({ tokenAddress })
    )
      return true;

    const response = await axios.post(
      SUBGRAPHS_ENDPOINT,
      { query, variables: { tokenAddress } },
      {
        headers: { "Content-Type": "application/json" },
      },
    );
    if (tokenAddress == response.data.data.tokens[0].id) {
      await request.server.mongo.db?.collection(tables.token).updateOne(
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
    return false;
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

    if (!(await checkTokenExist(request, tokenAddress))) {
      return reply.status(404).send({ token: "Token not found" });
    }
    await request.server.mongo.db?.collection(tables.message).insertOne({
      address,
      tokenAddress,
      message: message,
      id,
      like: 0,
      timestamp: new Date(),
    });

    if (id !== "") {
      const parentMessage = await request.server.mongo.db
        ?.collection(tables.message)
        .findOne({ _id: new ObjectId(id) });

      if (parentMessage) {
        const user = parentMessage.address;
        request.server.mongo.db
          ?.collection(tables.user)
          .updateOne({ address: user }, { $inc: { messagesReplies: 1 } });
      }
    }
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
    if (!address) {
      return reply.status(400).send({ error: "Address header is required" });
    }
    address = address.toLowerCase();

    const updateData: Record<string, any> = {
      address,
    };

    if ("userName" in data) {
      updateData.userName = (data as { userName: string }).userName;
    }

    if ("image" in data) {
      updateData.image = (data as { image: string }).image;
    }

    await request.server.mongo.db
      ?.collection(tables.user)
      .updateOne({ address }, { $set: updateData }, { upsert: true });
  } catch (error: any) {
    request.log.error(error);
    return reply.status(500).send({ error: error.message });
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
        ?.collection(tables.like)
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
          ?.collection(tables.token)
          .updateOne({ tokenAddress }, { $inc: { like: 1 } });
      }
    } else {
      const result = await request.server.mongo.db
        ?.collection(tables.like)
        .deleteOne({ address, tokenAddress });
      if (result.deletedCount == 1) {
        await request.server.mongo.db
          ?.collection(tables.token)
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
      ?.collection(tables.user)
      .findOne({ address }, { projection: { _id: 0 } });
    return reply.send(user);
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: error.message });
  }
}

async function getMessages(request: FastifyRequest, reply: FastifyReply) {
  try {
    let { address, tokenAddress, skip, limit, sort } = request.query as {
      address?: string;
      tokenAddress?: string;
      skip?: number;
      limit?: number;
      sort?: number;
    };

    skip = +skip;
    limit = +limit;
    sort = +sort;
    tokenAddress = tokenAddress.toLowerCase();
    const messages = await request.server.mongo.db
      ?.collection(tables.message)
      .find({ tokenAddress, $or: [{ id: null }, { id: { $exists: false } }] })
      .sort({ timestamp: sort === 1 ? 1 : -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await request.server.mongo.db
      ?.collection(tables.message)
      .countDocuments({ tokenAddress });

    if (address) {
      address = address.toLowerCase();
      await Promise.all(
        messages.map(async (message) => {
          const messagelike = await request.server.mongo.db
            ?.collection(tables.messagelike)
            .findOne({ address, id: message._id.toString() });

          if (messagelike) {
            message.liked = true;
          } else {
            message.liked = false;
          }
        }),
      );
    }
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
    skip = +skip;
    limit = +limit;
    address = address.toLowerCase();
    const messages = await request.server.mongo.db
      ?.collection(tables.message)
      .find({ address, $or: [{ id: null }, { id: { $exists: false } }] })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    if (address) {
      await Promise.all(
        messages.map(async (message) => {
          const messagelike = await request.server.mongo.db
            ?.collection(tables.messagelike)
            .findOne({ address, id: message._id.toString() });

          if (messagelike) {
            message.liked = true;
          } else {
            message.liked = false;
          }
        }),
      );
    }
    const total = await request.server.mongo.db
      ?.collection(tables.message)
      .countDocuments({ address });

    return reply.send({ total: total, data: messages });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: error.message });
  }
}

async function getMessageReplies(request: FastifyRequest, reply: FastifyReply) {
  try {
    let { address, id, skip, limit } = request.query as {
      address?: string;
      id?: string;
      skip?: number;
      limit?: number;
    };
    skip = +skip;
    limit = +limit;
    const messages = await request.server.mongo.db
      ?.collection(tables.message)
      .find({ id })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    if (address) {
      address = address.toLowerCase();
      await Promise.all(
        messages.map(async (message) => {
          const messagelike = await request.server.mongo.db
            ?.collection(tables.messagelike)
            .findOne({ address, id: message._id.toString() });

          if (messagelike) {
            message.liked = true;
          } else {
            message.liked = false;
          }
        }),
      );
    }
    const total = await request.server.mongo.db
      ?.collection(tables.message)
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
      ?.collection(tables.token)
      .findOne({ tokenAddress }, { projection: { _id: 0 } });
    return reply.send(token);
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: error.message });
  }
}

async function getMessageLikes(request: FastifyRequest, reply: FastifyReply) {
  try {
    let { address } = request.headers as { address?: string };
    let { skip, limit } = request.query as {
      skip?: number;
      limit?: number;
    };
    skip = +skip;
    limit = +limit;
    address = address.toLowerCase();
    const likes = await request.server.mongo.db
      ?.collection(tables.messagelike)
      .find({ address }, { projection: { _id: 0 } })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await request.server.mongo.db
      ?.collection(tables.messagelike)
      .countDocuments({ address });

    return reply.send({ total: total, data: likes });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: error.message });
  }
}

async function getUserLikes(request: FastifyRequest, reply: FastifyReply) {
  try {
    let { address, skip, limit } = request.query as {
      address?: string;
      skip?: number;
      limit?: number;
    };
    skip = +skip;
    limit = +limit;
    address = address.toLowerCase();
    const likes = await request.server.mongo.db
      ?.collection(tables.userlike)
      .find({ userAddress: address }, { projection: { _id: 0 } })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await request.server.mongo.db
      ?.collection(tables.userlike)
      .countDocuments({ userAddress: address });

    return reply.send({ total: total, data: likes });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: error.message });
  }
}

async function getSecret(request: FastifyRequest, reply: FastifyReply) {
  try {
    let { address } = request.headers as { address?: string };
    if (!ethers.isAddress(address)) throw new Error("Invalid address");
    address = address.toLowerCase();

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
    address = address?.toLowerCase();

    const data = await request.file();
    if (!data) {
      reply.code(400).send({ error: "No file uploaded" });
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (data.file.bytesRead > maxSize) {
      reply.code(400).send({ error: `File size exceeds maximum limit of ${maxSize / (1024 * 1024)}MB` });
      return;
    }

    let fileBuffer: Buffer;

    if (typeof data.file.pipe === 'function') { // Process as stream
      const chunks: Buffer[] = [];

      return new Promise<void>((resolve, reject) => {
        data.file.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        data.file.on('error', (err) => reject(err));
        data.file.on('end', async () => {
          try {
            fileBuffer = Buffer.concat(chunks);
            await processAndUploadFile();
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });
    } else {
      // Process as buffer
      fileBuffer = await data.toBuffer();
      await processAndUploadFile();
    }

    async function processAndUploadFile() {
      try {
        const metadata = await sharp(fileBuffer).metadata();
        if (!['jpeg', 'png'].includes(metadata.format)) {
          reply.code(400).send({ error: "Unsupported image format" });
          return;
        }
      } catch (err) {
        reply.code(400).send({ error: "Invalid image file" });
        return;
      }

      const tempFilePath = path.join(os.tmpdir(), `${Date.now()}-${data.filename}`);
      await fs.promises.writeFile(tempFilePath, fileBuffer);

      try {
        const readableStreamForFile = fs.createReadStream(tempFilePath);
        const options = {
          metadata: {
            name: data.filename,
            keyvalues: {
              address,
              contentType: data.mimetype
            }
          }
        };

        const upload = await pinata.upload.stream(readableStreamForFile, options);

        reply.send({
          success: true,
          cid: upload.IpfsHash,
        });
      } finally {
        try {
          await fs.promises.unlink(tempFilePath);
        } catch (cleanupError) {
          request.log.error(`Failed to cleanup temp file: ${cleanupError.message}`);
        }
      }
    }
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

    let { address } = request.headers as { address?: string };
    let { userAddress, add } = data as {
      userAddress: string;
      add: boolean;
    };

    if (!ethers.isAddress(userAddress)) throw new Error("Invalid address");
    address = address.toLowerCase();
    userAddress = userAddress.toLowerCase();

    if (add) {
      await request.server.mongo.db?.collection(tables.followers).updateOne(
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
        ?.collection(tables.followers)
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
    let { userAddress, skip, limit } = request.query as {
      userAddress?: string;
      skip?: number;
      limit?: number;
    };
    skip = +skip;
    limit = +limit;
    userAddress = userAddress.toLowerCase();
    const followers = await request.server.mongo.db
      ?.collection(tables.followers)
      .find({ userAddress }, { projection: { _id: 0 } })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await request.server.mongo.db
      ?.collection(tables.followers)
      .countDocuments({ userAddress });

    return reply.send({ total: total, data: followers });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: error.message });
  }
}

async function getFollowed(request: FastifyRequest, reply: FastifyReply) {
  try {
    let { address, skip, limit } = request.query as {
      address?: string;
      skip?: number;
      limit?: number;
    };
    skip = +skip;
    limit = +limit;
    address = address.toLowerCase();

    const followerd = await request.server.mongo.db
      ?.collection(tables.followers)
      .find({ address }, { projection: { _id: 0 } })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await request.server.mongo.db
      ?.collection(tables.followers)
      .countDocuments({ address });

    return reply.send({ total: total, data: followerd });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: error.message });
  }
}

async function getIsFollowed(request: FastifyRequest, reply: FastifyReply) {
  try {
    let { address, userAddress } = request.query as {
      address?: string;
      userAddress?: string;
    };
    address = address.toLowerCase();
    userAddress = userAddress.toLowerCase();
    const followerd = await request.server.mongo.db
      ?.collection(tables.followers)
      .findOne({ address, userAddress });

    if (followerd) {
      return reply.send({ status: true });
    }
    return reply.send({ status: false });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: error.message });
  }
}

async function getIsLiked(request: FastifyRequest, reply: FastifyReply) {
  try {
    let { address, userAddress } = request.query as {
      address?: string;
      userAddress?: string;
    };
    address = address.toLowerCase();
    userAddress = userAddress.toLowerCase();
    const liked = await request.server.mongo.db
      ?.collection(tables.userlike)
      .findOne({ address, userAddress });

    if (liked) {
      return reply.send({ status: true });
    }
    return reply.send({ status: false });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: error.message });
  }
}

async function addOrDeleteMessageLike(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const data = request.body;
    if (!data || typeof data !== "object") {
      return reply.status(400).send({ error: "Invalid JSON payload" });
    }

    let { address } = request.headers as { address?: string };
    let { id, like } = data as {
      id: string;
      like: boolean;
    };

    address = address.toLowerCase();

    if (like) {
      const result = await request.server.mongo.db
        ?.collection(tables.messagelike)
        .updateOne(
          { address, id },
          {
            $set: {
              address,
              id,
              timestamp: new Date(),
            },
          },
          { upsert: true },
        );
      if (result.upsertedCount == 1) {
        await request.server.mongo.db
          ?.collection(tables.message)
          .updateOne({ _id: new ObjectId(id) }, { $inc: { like: 1 } });

        if (id !== "") {
          const parentMessage = await request.server.mongo.db
            ?.collection(tables.message)
            .findOne({ _id: new ObjectId(id) });

          if (parentMessage) {
            const user = parentMessage.address;
            request.server.mongo.db
              ?.collection(tables.user)
              .updateOne({ address: user }, { $inc: { messagesLikes: 1 } });
          }
        }
      }
    } else {
      const result = await request.server.mongo.db
        ?.collection(tables.messagelike)
        .deleteOne({ address, id });
      if (result.deletedCount == 1) {
        await request.server.mongo.db
          ?.collection(tables.message)
          .updateOne({ _id: new ObjectId(id) }, { $inc: { like: -1 } });

        if (id !== "") {
          const parentMessage = await request.server.mongo.db
            ?.collection(tables.message)
            .findOne({ _id: new ObjectId(id) });

          if (parentMessage) {
            const user = parentMessage.address;
            request.server.mongo.db
              ?.collection(tables.user)
              .updateOne({ address: user }, { $inc: { messagesLikes: -1 } });
          }
        }
      }
    }
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: error.message });
  }
  return reply.send({});
}

async function addOrDeleteUsertLike(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const data = request.body;
    if (!data || typeof data !== "object") {
      return reply.status(400).send({ error: "Invalid JSON payload" });
    }

    let { address } = request.headers as { address?: string };
    let { userAddress, like } = data as {
      userAddress: string;
      like: boolean;
    };

    address = address.toLowerCase();
    userAddress = userAddress.toLowerCase();
    if (!ethers.isAddress(userAddress)) throw new Error("Invalid address");

    if (like) {
      const result = await request.server.mongo.db
        ?.collection(tables.userlike)
        .updateOne(
          { address, userAddress },
          {
            $set: {
              address,
              userAddress,
              timestamp: new Date(),
            },
          },
          { upsert: true },
        );
      if (result.upsertedCount == 1) {
        await request.server.mongo.db
          ?.collection(tables.user)
          .updateOne({ address: userAddress }, { $inc: { like: 1 } });
      }
    } else {
      const result = await request.server.mongo.db
        ?.collection(tables.userlike)
        .deleteOne({ address, userAddress });
      if (result.deletedCount == 1) {
        await request.server.mongo.db
          ?.collection(tables.user)
          .updateOne({ address: userAddress }, { $inc: { like: -1 } });
      }
    }
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: error.message });
  }
  return reply.send({});
}

startServer();
