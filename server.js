import http from "http";
import multiparty from "multiparty";
import * as Client from "@storacha/client";
import * as Proof from "@storacha/client/proof";
import { Signer } from "@storacha/client/principal/ed25519";
import { StoreMemory } from "@storacha/client/stores/memory";

const SERVER_PORT = process.env.SERVER_PORT || 3000;
const PRIVATE_KEY = process.env.STORACHA_PRINCIPAL;
const PROOF = process.env.STORACHA_PROOF;

if (!PRIVATE_KEY || !PROOF) {
  console.error("❌ Missing STORACHA_PRINCIPAL or STORACHA_PROOF in environment variables.");
  process.exit(1);
}

// Helper to parse uploaded files
async function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = new multiparty.Form();
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

async function handleUpload(req, res) {
  try {
    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    const { files } = await parseForm(req);
    const file = files.file?.[0];
    if (!file) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "No file uploaded" }));
      return;
    }

    const principal = Signer.parse(PRIVATE_KEY);
    const store = new StoreMemory();
    const client = await Client.create({ principal, store });
    const proof = await Proof.parse(PROOF);
    const space = await client.addSpace(proof);
    await client.setCurrentSpace(space.did());

    const fileBuffer = await Bun.file(file.path).arrayBuffer();
    const blob = new Uint8Array(fileBuffer);

    const result = await client.uploadFile(blob);
    const cid = result.root.toString();

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ cid, gateway: `https://${cid}.ipfs.dweb.link` }));
  } catch (error) {
    console.error("Upload failed:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error.message }));
  }
}

const server = http.createServer(async (req, res) => {
  if (req.url === "/upload" && req.method === "POST") {
    await handleUpload(req, res);
  } else {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("✅ Storacha backend running");
  }
});

server.listen(SERVER_PORT, () => {
  console.log(`✅ Storacha backend running on port ${SERVER_PORT}`);
});
