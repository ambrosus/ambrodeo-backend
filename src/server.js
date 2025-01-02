"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const multipart_1 = __importDefault(require("@fastify/multipart"));
const mongodb_1 = __importDefault(require("@fastify/mongodb"));
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const ethers_1 = __importDefault(require("ethers"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const swagger_1 = __importDefault(require("@fastify/swagger"));
const swagger_ui_1 = __importDefault(require("@fastify/swagger-ui"));
const init_1 = require("./init");
const documentation_1 = require("./documentation");
const query = `query GetToken($tokenAddress: ID!) {token(id: $tokenAddress) {id}}`;
const { HOST, PORT, DATABASE_URL, SUBGRAPHS_ENDPOINT, UPLOAD_DIR } = (0, init_1.getEnv)();
const fastify = (0, init_1.initFastify)();
const mapSecret = new Map();
const startServer = async () => {
    try {
        const openApiSpec = js_yaml_1.default.load(documentation_1.docs);
        fastify.register(swagger_1.default, {
            openapi: openApiSpec,
        });
        fastify.register(swagger_ui_1.default, {
            routePrefix: "/docs",
            uiConfig: {
                docExpansion: "full",
                deepLinking: false,
            },
        });
        fastify.register(mongodb_1.default, {
            forceClose: true,
            url: DATABASE_URL,
        });
        fastify.register(multipart_1.default);
        fastify.addHook("preHandler", async (request, reply) => {
            if (request.method != "POST") {
                return;
            }
            try {
                const { address, signature } = request.headers;
                const secret = mapSecret.get(address);
                if (!signature || !address || !secret) {
                    return reply.status(400).send({
                        error: "Missing address or signature in headers",
                    });
                }
                const recoveredAddress = ethers_1.default.verifyMessage(secret, signature);
                if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
                    return reply.status(401).send({ error: "Invalid signature" });
                }
            }
            catch (error) {
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
    }
    catch (error) {
        fastify.log.error(error);
        process.exit(1);
    }
};
async function checkTokenExist(request, tokenAddress) {
    try {
        if ((await request.server.mongo.db
            ?.collection("token")
            .findOne({ tokenAddress })) != null)
            return true;
        const response = await axios_1.default.post(SUBGRAPHS_ENDPOINT, { query, variables: { tokenAddress } }, {
            headers: { "Content-Type": "application/json" },
        });
        if (tokenAddress == response.data.data.token.id) {
            await request.server.mongo.db?.collection("token").updateOne({ tokenAddress }, {
                tokenAddress,
                like: 0,
                timestamp: new Date(),
            }, { upsert: true });
            return true;
        }
    }
    catch (error) {
        request.log.error(error);
        return false;
    }
}
async function index(request, reply) {
    return reply.send({});
}
async function addMessage(request, reply) {
    try {
        const data = request.body;
        if (!data || typeof data !== "object") {
            return reply.status(400).send({ error: "Invalid JSON payload" });
        }
        const { address } = request.headers;
        let { tokenAddress, message } = data;
        tokenAddress = tokenAddress.toLowerCase();
        if (!ethers_1.default.isAddress(tokenAddress))
            throw new Error("Invalid address");
        if (!checkTokenExist(request, tokenAddress))
            return reply.status(404).send({ token: "Token not found" });
        await request.server.mongo.db?.collection("massage").insertOne({
            address,
            tokenAddress,
            message: message,
            timestamp: new Date(),
        });
    }
    catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: error.message });
    }
    return reply.send({});
}
async function addOrUpdateUser(request, reply) {
    try {
        const data = request.body;
        if (!data || typeof data !== "object") {
            return reply.status(400).send({ error: "Invalid JSON payload" });
        }
        const { address } = request.headers;
        const { userName, image } = data;
        await request.server.mongo.db?.collection("user").updateOne({ address }, {
            address,
            userName,
            image,
            timestamp: new Date(),
        }, { upsert: true });
    }
    catch (error) {
        request.log.error(error);
        return reply
            .status(500)
            .send({ error: error.message });
    }
    return reply.send({});
}
async function addOrDeleteLike(request, reply) {
    try {
        const data = request.body;
        if (!data || typeof data !== "object") {
            return reply.status(400).send({ error: "Invalid JSON payload" });
        }
        const { address } = request.headers;
        let { tokenAddress, like } = data;
        tokenAddress = tokenAddress.toLowerCase();
        if (!ethers_1.default.isAddress(tokenAddress))
            throw new Error("Invalid address");
        if (!checkTokenExist(request, tokenAddress))
            return reply.status(404).send({ token: "Token not found" });
        if (like) {
            const result = await request.server.mongo.db
                ?.collection("like")
                .updateOne({ address, tokenAddress }, {
                address,
                tokenAddress,
                timestamp: new Date(),
            }, { upsert: true });
            if (result.upsertedCount == 1) {
                await request.server.mongo.db
                    ?.collection("token")
                    .updateOne({ tokenAddress }, { $inc: { like: 1 } });
            }
        }
        else {
            const result = await request.server.mongo.db
                ?.collection("token")
                .deleteOne({ address, tokenAddress });
            if (result.deletedCount == 1) {
                await request.server.mongo.db
                    ?.collection("token")
                    .updateOne({ tokenAddress }, { $inc: { like: -1 } });
            }
        }
    }
    catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: error.message });
    }
    return reply.send({});
}
async function getUser(request, reply) {
    try {
        const { address } = request.headers;
        const user = await request.server.mongo.db
            ?.collection("user")
            .findOne({ address }, { projection: { _id: 0 } });
        return reply.send(user);
    }
    catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: error.message });
    }
}
async function getMessages(request, reply) {
    try {
        const { tokenAddress, skip, limit } = request.query;
        const messages = await request.server.mongo.db
            ?.collection("message")
            .find({ tokenAddress }, { projection: { _id: 0 } })
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();
        return reply.send(messages);
    }
    catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: error.message });
    }
}
async function getToken(request, reply) {
    try {
        const { tokenAddress } = request.query;
        const token = await request.server.mongo.db
            ?.collection("token")
            .findOne({ tokenAddress }, { projection: { _id: 0 } });
        return reply.send(token);
    }
    catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: error.message });
    }
}
async function getUserLikes(request, reply) {
    try {
        const { address } = request.headers;
        const { skip, limit } = request.query;
        const likes = await request.server.mongo.db
            ?.collection("like")
            .find({ address }, { projection: { _id: 0 } })
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();
        return reply.send(likes);
    }
    catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: error.message });
    }
}
async function getSecret(request, reply) {
    try {
        let { address } = request.headers;
        address = address.toLowerCase();
        console.log("----------------");
        console.log(address);
        if (!ethers_1.default.isAddress(address))
            throw new Error("Invalid address");
        const secret = "AMBRodeo authorization secret: ";
        secret.concat(crypto_1.default
            .createHash("sha256")
            .update(crypto_1.default.getRandomValues(new Uint8Array(32)))
            .digest("hex"));
        mapSecret.set(address, secret);
        reply.send({ secret: secret });
    }
    catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: error.message });
    }
}
async function uploadFile(request, reply) {
    try {
        let { address } = request.headers;
        address = address.toLowerCase();
        const data = await request.file();
        if (!data) {
            reply.code(400).send({ error: "No file uploaded" });
            return;
        }
        const uploadDir = path_1.default.join(UPLOAD_DIR, "files", address);
        if (!fs_1.default.existsSync(uploadDir)) {
            fs_1.default.mkdirSync(uploadDir, { recursive: true });
        }
        const filePath = path_1.default.join(uploadDir, data.filename);
        await new Promise((resolve, reject) => {
            const writeStream = fs_1.default.createWriteStream(filePath);
            data.file.pipe(writeStream);
            writeStream.on("finish", resolve);
            writeStream.on("error", reject);
        });
        reply.send({
            success: true,
            message: "File uploaded",
            filename: data.filename,
        });
    }
    catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: error.message });
    }
}
startServer();
