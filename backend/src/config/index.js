import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../../..");

dotenv.config({ path: path.join(root, ".env") });

export const config = {
  root,
  rpcUrl: process.env.GANACHE_RPC_URL || "http://127.0.0.1:8545",
  chainId: Number(process.env.CHAIN_ID || 1337),
  contractAddress: process.env.CONTRACT_ADDRESS || "",
  port: Number(process.env.PORT || 4000),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  scanWindowMs: Number(process.env.SCAN_WINDOW_MS || 10 * 60 * 1000),
  scanDayMs: Number(process.env.SCAN_DAY_MS || 24 * 60 * 60 * 1000),
  suspiciousRecentScans: Number(process.env.SUSPICIOUS_RECENT_SCANS || 3),
  suspiciousDistinctClients: Number(process.env.SUSPICIOUS_DISTINCT_CLIENTS || 3),
  dataFile: path.join(root, "backend", "data", "scans.json"),
  artifactPath: path.join(root, "build", "contracts", "ProductAuthentication.json"),
  deploymentPath: path.join(root, "deployment.json")
};

export const ROLE_NAMES = {
  0: "None",
  1: "Manufacturer",
  2: "Distributor",
  3: "Retailer"
};

export const STATUS_NAMES = {
  0: "None",
  1: "With manufacturer",
  2: "With distributor",
  3: "With retailer"
};

export const ACTION_NAMES = {
  1: "Registered",
  2: "Custody transferred",
  3: "Verified"
};
