import { getDB } from "./db";
import * as jsonrpc from "jsonrpc-lite";
import * as dotenv from "dotenv";
import { ethers, recoverAddress } from "ethers";
import crypto from "crypto";

const abi = ["function getTokenCreator(address) view returns (address)"];
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

const PROVIDER = process.env.PROVIDER || "";
const CONTRACT = process.env.CONTRACT || "0x";

const mapSecret = new Map();

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
      case "addToken":
        return jsonrpc.success(id, await addToken(params as RPCParams));
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
      case "getUserTokens":
        return jsonrpc.success(id, await getUserLikes(params as RPCParams));
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

function validateSignature(
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

const addToken = async ({ address, signature, tokenAddress }: RPCParams) => {
  address = address.toLowerCase();
  tokenAddress = tokenAddress || "0x";
  tokenAddress = tokenAddress.toLowerCase();

  if (validateSignature(address, signature))
    throw jsonrpc.JsonRpcError.invalidParams("Invalid signature");

  if (!tokenAddress || !ethers.isAddress(tokenAddress))
    throw jsonrpc.JsonRpcError.invalidParams("Invalid address");

  if (PROVIDER == "" || CONTRACT == "0x")
    throw jsonrpc.JsonRpcError.internalError("Internal server error");

  try {
    const provider = new ethers.JsonRpcProvider(PROVIDER);
    const contract = new ethers.Contract(CONTRACT, abi, provider);
    const creator = await contract.getTokenCreator(tokenAddress);

    if (creator.toLowerCase() != address)
      throw jsonrpc.JsonRpcError.invalidParams("Invalid token");
    await getDB().collection("token").updateOne(
      { address, tokenAddress },
      {
        address,
        tokenAddress,
        like: 0,
        timestamp: new Date(),
      },
      { upsert: true },
    );
    return { message: "Token add successfully" };
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
    if (token == null)
      throw jsonrpc.JsonRpcError.invalidParams("Token not found");

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
  if (token == null)
    throw jsonrpc.JsonRpcError.invalidParams("Token not found");

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
          { address, tokenAddress, like, timestamp: new Date() },
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

const getUserTokens = async ({
  address,
  signature,
  limit,
  skip,
}: RPCParams) => {
  address = address.toLowerCase();
  skip = skip || 0;
  limit = limit || 0;

  if (validateSignature(address, signature))
    throw jsonrpc.JsonRpcError.invalidParams("Invalid signature");

  try {
    const like = await getDB()
      .collection("token")
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
