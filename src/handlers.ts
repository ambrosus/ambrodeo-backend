import { getDB } from "./db";
import * as jsonrpc from "jsonrpc-lite";
import * as dotenv from "dotenv";
import axios from "axios";
import { ethers, recoverAddress } from "ethers";
import crypto from "crypto";

const query = `
  query GetToken($tokenAddress: ID!) {
    token(id: $tokenAddress) {
      id
    }
  }
`;

dotenv.config();

interface RPCParams {
  address: string;
  signature?: string;
  userName?: string;
  tokenAddress?: string;
  image?: string;
  message?: string;
  like?: boolean;
  limit?: number;
  skip?: number;
}

const SUBGRAPHS_ENDPOINT = process.env.SUBGRAPHS_ENDPOINT || "";
const mapSecret = new Map();

async function addToken(tokenAddress: string): Promise<boolean> {
  try {
    const response = await axios.post(
      SUBGRAPHS_ENDPOINT,
      {
        query,
        variables: { tokenAddress },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (tokenAddress == response.data.data.token.id) {
      await getDB().collection("token").updateOne(
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
    return false;
  } catch (error) {
    console.log(error);
    throw jsonrpc.JsonRpcError.internalError(error);
  }
}

export function validateSignature(
  address: string,
  signature: string | undefined,
): boolean {
  address = address.toLowerCase();
  if (!address || !ethers.isAddress(address))
    throw jsonrpc.JsonRpcError.invalidParams("Invalid address");

  const secret = mapSecret.get(address);
  const validSignature = signature || "0x";
  const recoveredAddress = ethers.verifyMessage(secret, validSignature);
  return address == recoveredAddress;
}

export const handleRPCRequest = async (requestBody: any) => {
  const rpc = jsonrpc.parseObject(requestBody);

  if (rpc.type !== "request") {
    return jsonrpc.error(null, jsonrpc.JsonRpcError.invalidRequest(""));
  }

  const { method, params, id } = rpc.payload;

  try {
    switch (method) {
      case "getSecret":
        return jsonrpc.success(id, await getSecret(params as RPCParams));
      case "addUser":
        return jsonrpc.success(id, await addUser(params as RPCParams));
      case "addMessage":
        return jsonrpc.success(id, await addMessage(params as RPCParams));
      case "addLike":
        return jsonrpc.success(id, await addLike(params as RPCParams));
      case "getToken":
        return jsonrpc.success(id, await getToken(params as RPCParams));
      case "getMessages":
        return jsonrpc.success(id, await getMessages(params as RPCParams));
      case "getUserLikes":
        return jsonrpc.success(id, await getUserLikes(params as RPCParams));
      case "getUser":
        return jsonrpc.success(id, await getUser(params as RPCParams));
      default:
        return jsonrpc.error(
          id,
          jsonrpc.JsonRpcError.methodNotFound("Not found"),
        );
    }
  } catch (error) {
    console.error("Error processing RPC request:", error);
    return jsonrpc.error(
      id,
      jsonrpc.JsonRpcError.internalError("Internal error"),
    );
  }
};

const getSecret = async ({ address }: RPCParams) => {
  if (!address || !ethers.isAddress(address))
    throw jsonrpc.JsonRpcError.invalidParams("Invalid address");

  const secret = crypto
    .createHash("sha256")
    .update(crypto.getRandomValues(new Uint8Array(32)))
    .digest("hex");

  mapSecret.set("address", secret);
  return { address: address, secret: secret };
};

const addUser = async ({ address, signature, userName, image }: RPCParams) => {
  address = address.toLowerCase();
  if (validateSignature(address, signature))
    throw jsonrpc.JsonRpcError.invalidParams("Invalid signature");
  try {
    await getDB()
      .collection("user")
      .updateOne(
        { address },
        { address, userName, image, timestamp: new Date() },
        { upsert: true },
      );
    return { message: "User add successfully" };
  } catch (error) {
    console.log(error);
    throw jsonrpc.JsonRpcError.internalError(error);
  }
};

const addMessage = async ({
  address,
  signature,
  tokenAddress,
  message,
}: RPCParams) => {
  address = address.toLowerCase();
  tokenAddress = tokenAddress || "0x";
  tokenAddress = tokenAddress.toLowerCase();

  if (validateSignature(address, signature))
    throw jsonrpc.JsonRpcError.invalidParams("Invalid signature");

  if (!tokenAddress || !ethers.isAddress(tokenAddress))
    throw jsonrpc.JsonRpcError.invalidParams("Invalid address");

  if (message == undefined || message == "")
    throw jsonrpc.JsonRpcError.invalidParams("Message is empty");

  try {
    const token = await getDB().collection("token").findOne({ tokenAddress });
    if (token == null) {
      if (!(await addToken(tokenAddress)))
        throw jsonrpc.JsonRpcError.invalidParams("Token not found");
    }

    await getDB().collection("message").insertOne({
      address,
      tokenAddress,
      message: message,
      timestamp: new Date(),
    });
    return { message: "Message add successfully" };
  } catch (error) {
    console.log(error);
    throw jsonrpc.JsonRpcError.internalError(error);
  }
};

const addLike = async ({
  address,
  signature,
  tokenAddress,
  like,
}: RPCParams) => {
  address = address.toLowerCase();
  tokenAddress = tokenAddress || "0x";
  tokenAddress = tokenAddress.toLowerCase();

  if (validateSignature(address, signature))
    throw jsonrpc.JsonRpcError.invalidParams("Invalid signature");

  if (!tokenAddress || !ethers.isAddress(tokenAddress))
    throw jsonrpc.JsonRpcError.invalidParams("Invalid address");

  const token = await getDB().collection("token").findOne({ tokenAddress });
  if (token == null) {
    if (!(await addToken(tokenAddress)))
      throw jsonrpc.JsonRpcError.invalidParams("Token not found");
  }

  try {
    if (!like) {
      const result = await getDB()
        .collection("like")
        .deleteOne({ address, tokenAddress });
      if (result.deletedCount == 1) {
        await getDB()
          .collection("token")
          .updateOne({ tokenAddress }, { $inc: { like: -1 } });
      }
    } else if (like) {
      const result = await getDB()
        .collection("like")
        .updateOne(
          { address, tokenAddress },
          { address, tokenAddress, timestamp: new Date() },
          { upsert: true },
        );
      if (result.upsertedCount == 1) {
        await getDB()
          .collection("token")
          .updateOne({ tokenAddress }, { $inc: { like: 1 } });
      }
    }
    return { message: "Like successfully" };
  } catch (error) {
    console.log(error);
    throw jsonrpc.JsonRpcError.internalError(error);
  }
};

const getToken = async ({ tokenAddress }: RPCParams) => {
  tokenAddress = tokenAddress || "0x";
  tokenAddress = tokenAddress.toLowerCase();

  if (!tokenAddress || !ethers.isAddress(tokenAddress))
    throw jsonrpc.JsonRpcError.invalidParams("Invalid address");

  try {
    const token = await getDB()
      .collection("token")
      .findOne({ tokenAddress }, { projection: { _id: 0 } });
    return { token };
  } catch (error) {
    console.log(error);
    throw jsonrpc.JsonRpcError.internalError(error);
  }
};

const getMessages = async ({ tokenAddress, limit, skip }: RPCParams) => {
  tokenAddress = tokenAddress || "0x";
  tokenAddress = tokenAddress.toLowerCase();
  skip = skip || 0;
  limit = limit || 0;

  if (!tokenAddress || !ethers.isAddress(tokenAddress))
    throw jsonrpc.JsonRpcError.invalidParams("Invalid address");

  try {
    const message = await getDB()
      .collection("message")
      .find({ tokenAddress }, { projection: { _id: 0 } })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    return { message };
  } catch (error) {
    console.log(error);
    throw jsonrpc.JsonRpcError.internalError(error);
  }
};

const getUserLikes = async ({ address, signature, limit, skip }: RPCParams) => {
  address = address.toLowerCase();
  skip = skip || 0;
  limit = limit || 0;

  if (validateSignature(address, signature))
    throw jsonrpc.JsonRpcError.invalidParams("Invalid signature");

  try {
    const like = await getDB()
      .collection("like")
      .find({ address }, { projection: { _id: 0 } })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    return { like };
  } catch (error) {
    console.log(error);
    throw jsonrpc.JsonRpcError.internalError(error);
  }
};

const getUser = async ({ address }: RPCParams) => {
  address = address.toLowerCase();
  try {
    const user = await getDB()
      .collection("user")
      .findOne({ address }, { projection: { _id: 0 } });
    return { user };
  } catch (error) {
    console.log(error);
    throw jsonrpc.JsonRpcError.internalError(error);
  }
};
