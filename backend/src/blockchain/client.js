import fs from "fs";
import { ethers } from "ethers";
import { ACTION_NAMES, ROLE_NAMES, STATUS_NAMES, config } from "../config/index.js";
import { HttpError } from "../utils/httpError.js";
import { revertText } from "../utils/ids.js";

let activeClient = null;

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalize(value) {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(normalize);
  return value;
}

export class BlockchainClient {
  constructor(options = {}) {
    this.rpcUrl = options.rpcUrl || config.rpcUrl;
    this.expectedChainId = options.chainId || config.chainId;
    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
    this.artifact = options.artifact || readJson(config.artifactPath);
    this.deployment = options.deployment || readJson(config.deploymentPath);
    this.addressOverride = options.address || config.contractAddress || "";
  }

  getArtifact() {
    if (!this.artifact?.abi) {
      throw new HttpError(503, "Contract artifact is missing. Compile with npx truffle compile.");
    }
    return this.artifact;
  }

  resolveAddress() {
    if (this.addressOverride) return this.addressOverride;
    if (this.deployment?.address) return this.deployment.address;
    const networks = this.artifact?.networks || {};
    const match = networks[String(this.expectedChainId)];
    return match?.address || null;
  }

  contractAt(address) {
    return new ethers.Contract(address, this.getArtifact().abi, this.provider);
  }

  async requireContract() {
    const address = this.resolveAddress();
    if (!address) {
      throw new HttpError(503, "Contract address is not configured. Deploy with npx truffle migrate --network development.");
    }
    const network = await this.provider.getNetwork();
    if (Number(network.chainId) !== this.expectedChainId) {
      throw new HttpError(409, `Connected chain ${network.chainId} does not match expected chain ${this.expectedChainId}.`);
    }
    return this.contractAt(address);
  }

  async getNetworkStatus() {
    try {
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();
      const chainId = Number(network.chainId);
      const contractAddress = this.resolveAddress();
      let verificationFeeWei = null;
      if (contractAddress && chainId === this.expectedChainId && this.artifact?.abi) {
        try {
          verificationFeeWei = (await this.contractAt(contractAddress).getVerificationFee()).toString();
        } catch {
          verificationFeeWei = null;
        }
      }
      return {
        connected: true,
        chainId,
        expectedChainId: this.expectedChainId,
        supportedNetwork: chainId === this.expectedChainId,
        blockNumber,
        contractAddress,
        verificationFeeWei
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(503, "Blockchain RPC is not reachable.");
    }
  }

  async productExists(productId) {
    const contract = await this.requireContract();
    try {
      return await contract.productExists(productId);
    } catch (error) {
      throw new HttpError(502, "Could not read product existence from the contract.");
    }
  }

  async getProduct(productId) {
    const contract = await this.requireContract();
    try {
      const product = await contract.getProduct(productId);
      return {
        name: product.name,
        batchNumber: product.batchNumber,
        productId: product.productId,
        manufacturer: product.manufacturer,
        currentCustodian: product.currentCustodian,
        registeredAt: Number(product.registeredAt),
        verificationCount: Number(product.verificationCount),
        exists: product.exists,
        status: Number(product.status),
        statusName: STATUS_NAMES[Number(product.status)] || "Unknown"
      };
    } catch (error) {
      if (revertText(error).includes("Product does not exist")) {
        throw new HttpError(404, "Product is not registered on the blockchain.");
      }
      throw new HttpError(502, "Could not read the product from the contract.");
    }
  }

  async getHistory(productId) {
    const contract = await this.requireContract();
    try {
      const history = await contract.getHistory(productId);
      return history.map((entry) => ({
        actor: entry.actor,
        from: entry.from,
        to: entry.to,
        timestamp: Number(entry.timestamp),
        action: Number(entry.action),
        actionName: ACTION_NAMES[Number(entry.action)] || "Unknown"
      }));
    } catch (error) {
      if (revertText(error).includes("Product does not exist")) {
        throw new HttpError(404, "Product is not registered on the blockchain.");
      }
      throw new HttpError(502, "Could not read product history from the contract.");
    }
  }

  async getParticipant(address) {
    const contract = await this.requireContract();
    try {
      const role = Number(await contract.getParticipantRole(address));
      const owner = await contract.owner();
      return {
        address: ethers.getAddress(address),
        role,
        roleName: ROLE_NAMES[role] || "Unknown",
        isOwner: owner.toLowerCase() === address.toLowerCase()
      };
    } catch (error) {
      throw new HttpError(502, "Could not read the participant role from the contract.");
    }
  }

  async getEvents(fromBlock = 0) {
    const contract = await this.requireContract();
    const names = [
      "ProductRegistered",
      "CustodyTransferred",
      "ProductVerified",
      "VerificationFeeUpdated",
      "ParticipantRoleUpdated",
      "FeesWithdrawn"
    ];
    try {
      const groups = await Promise.all(names.map((name) => contract.queryFilter(name, fromBlock)));
      return groups
        .flat()
        .map((event) => {
          const args = {};
          for (const input of event.fragment.inputs) {
            args[input.name] = normalize(event.args[input.name]);
          }
          return {
            name: event.fragment.name,
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            logIndex: event.index,
            args
          };
        })
        .sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);
    } catch (error) {
      throw new HttpError(502, "Could not read contract events.");
    }
  }
}

export function setClient(client) {
  activeClient = client;
}

export function getClient() {
  if (!activeClient) activeClient = new BlockchainClient();
  return activeClient;
}
