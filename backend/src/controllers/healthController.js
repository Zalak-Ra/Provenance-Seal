import { config } from "../config/index.js";
import { getClient } from "../blockchain/client.js";

export async function getHealth(req, res) {
  const blockchain = await getClient().getNetworkStatus();
  const degraded = !blockchain.supportedNetwork || !blockchain.contractAddress;
  res.status(degraded ? 200 : 200).json({
    status: degraded ? "degraded" : "ok",
    service: "product-authentication-api",
    blockchain
  });
}

export async function getPublicConfig(req, res) {
  const artifact = getClient().getArtifact();
  const address = getClient().resolveAddress();
  res.json({
    expectedChainId: config.chainId,
    rpcUrl: config.rpcUrl,
    contractAddress: address,
    abi: artifact.abi,
    note: "Writes are signed in MetaMask. This API does not hold a private key."
  });
}
