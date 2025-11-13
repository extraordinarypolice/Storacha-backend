import * as Client from "@storacha/client";
import * as Proof from "@storacha/client/proof";
import { Signer } from "@storacha/client/principal/ed25519";
import { StoreMemory } from "@storacha/client/stores/memory";

let cachedClient = null;
let cachedSpace = null;

async function getClient() {
  if (cachedClient) return { client: cachedClient, space: cachedSpace };

  const principal = Signer.parse(process.env.STORACHA_PRINCIPAL);
  const proof = await Proof.parse(process.env.STORACHA_PROOF);

  const store = new StoreMemory();
  const client = await Client.create({ principal, store });

  const space = await client.addSpace(proof);
  await client.setCurrentSpace(space.did());

  cachedClient = client;
  cachedSpace = space;

  return { client, space };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const did = req.query.did;
    if (!did) return res.status(400).json({ error: "Missing ?did param" });

    const { client } = await getClient();

    const abilities = [
      "space/blob/add",
      "space/index/add",
      "filecoin/offer",
      "upload/add"
    ];

    const expiration = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;

    const delegation = await client.createDelegation(did, abilities, {
      expiration,
    });

    const archive = await delegation.archive();

    res.setHeader("Content-Type", "application/octet-stream");
    res.send(archive.ok);

  } catch (err) {
    console.error("Delegation error:", err);
    res.status(500).json({ error: err.message });
  }
}
