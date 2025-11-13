import http from "http";
import multiparty from "multiparty";
import * as Client from "@storacha/client";
import * as Proof from "@storacha/client/proof";
import { Signer } from "@storacha/client/principal/ed25519";
import { StoreMemory } from "@storacha/client/stores/memory";

const PORT = process.env.PORT || 3000;

const principal = Signer.parse(process.env.STORACHA_PRINCIPAL);
const proof = await Proof.parse(process.env.STORACHA_PROOF);
const store = new StoreMemory();
const client = await Client.create({ principal, store });
const space = await client.addSpace(proof);
await client.setCurrentSpace(space.did());

console.log("✅ Server DID:", principal.did());
console.log("✅ Space DID:", space.did());

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith("/api/delegation")) {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const did = url.searchParams.get("did");
      if (!did) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Missing ?did param" }));
      }

      const abilities = [
        "space/blob/add",
        "space/index/add",
        "filecoin/offer",
        "upload/add",
      ];

      const expiration = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
      const delegation = await client.createDelegation(did, abilities, {
        expiration,
      });

      const archive = await delegation.archive();
      res.writeHead(200, { "Content-Type": "application/octet-stream" });
      res.end(archive.ok);
    } catch (err) {
      console.error("Delegation error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Storacha backend is running ✅");
  }
});

server.listen(PORT, () =>
  console.log(`🚀 Storacha backend running on port ${PORT}`)
);
