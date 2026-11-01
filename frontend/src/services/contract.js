import { ethers } from "ethers";

export async function loadChainConfig() {
  try {
    const response = await fetch("/api/config");
    if (response.ok) {
      const body = await response.json();
      if (body.abi) return normalizeConfig(body);
    }
  } catch {
    // The API is optional for reading a previously synced ABI.
  }

  const abiResponse = await fetch("/abi/ProductAuthentication.json");
  if (!abiResponse.ok) {
    throw new Error("Contract ABI was not found. Compile the contract and run node scripts/sync-abi.js.");
  }
  const abiFile = await abiResponse.json();
  let deployment = {};
  const deploymentResponse = await fetch("/deployment.json");
  if (deploymentResponse.ok) deployment = await deploymentResponse.json();
  return normalizeConfig({
    abi: abiFile.abi,
    contractAddress: deployment.address || "",
    expectedChainId: Number(import.meta.env.VITE_EXPECTED_CHAIN_ID || 1337),
    rpcUrl: import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545"
  });
}

function normalizeConfig(body) {
  return {
    abi: body.abi,
    contractAddress: body.contractAddress || "",
    expectedChainId: Number(body.expectedChainId || import.meta.env.VITE_EXPECTED_CHAIN_ID || 1337),
    rpcUrl: body.rpcUrl || import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545"
  };
}

export function getReadProvider(rpcUrl) {
  return new ethers.JsonRpcProvider(rpcUrl);
}

export function getContract(config, signerOrProvider) {
  if (!config?.contractAddress || !config?.abi) {
    throw new Error("The contract address is not loaded. Deploy it to Ganache and restart the API.");
  }
  return new ethers.Contract(config.contractAddress, config.abi, signerOrProvider);
}
