import { FastifyRequest, FastifyReply } from "fastify";
import fs from "fs";
import path from "path";

export const uploadHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const data = await request.file();
  if (!data) {
    reply.code(400).send({ error: "No image uploaded" });
    return;
  }

  const uploadDir = path.join(__dirname, "images");
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
