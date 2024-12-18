import { FastifyRequest, FastifyReply } from "fastify";
import fs from "fs";
import path from "path";
import { validateSignature } from "./handlers";

export const uploadHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  let address = request.headers["authorization-address"];
  let signature = request.headers["authorization-secret"];

  address = String(Array.isArray(address) ? "0x" : address);
  signature = String(Array.isArray(signature) ? "" : signature);

  if (!validateSignature(address, signature)) {
    reply.code(401).send({ error: "Authorization Required" });
    return;
  }

  const data = await request.file();
  if (!data) {
    reply.code(400).send({ error: "No image uploaded" });
    return;
  }

  const uploadDir = path.join(__dirname, "images", address);
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
    message: "Image uploaded",
    filename: data.filename,
  });
};
