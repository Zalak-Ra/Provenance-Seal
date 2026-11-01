import { ethers } from "ethers";

export const ROLE_NAMES = {
  0: "Unassigned",
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

export function generateProductId(serialNumber) {
  const serial = String(serialNumber ?? "");
  if (!serial.trim() || serial.length > 128) {
    throw new Error("Invalid serial number");
  }
  return ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["string"], [serial]));
}

export function resolveProductId(input) {
  const text = String(input || "").trim();
  if (!text) throw new Error("Enter a serial number or product identifier.");
  const fromUrl = text.match(/[?&]pid=(0x[0-9a-fA-F]{64})/i);
  if (fromUrl) return fromUrl[1];
  if (/^0x[0-9a-fA-F]{64}$/.test(text)) return text;
  return generateProductId(text);
}

export function parseQrPayload(text) {
  const match = String(text || "").match(/0x[0-9a-fA-F]{64}/);
  return match ? match[0] : null;
}

export function parseChainId(value) {
  if (typeof value === "string" && value.startsWith("0x")) return Number.parseInt(value, 16);
  return Number(value);
}

export function networkStatus(chainId, expected = 1337) {
  if (chainId == null || Number.isNaN(Number(chainId))) {
    return { ok: false, label: "Wallet not connected" };
  }
  if (Number(chainId) !== Number(expected)) {
    return { ok: false, label: `Unsupported network (${chainId})` };
  }
  return { ok: true, label: `Ganache Local (${expected})` };
}

export function shortAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatEther(value) {
  if (value == null) return "—";
  return `${ethers.formatEther(value)} ETH`;
}

export function formatTime(unixSeconds) {
  if (!unixSeconds) return "—";
  return new Date(Number(unixSeconds) * 1000).toLocaleString();
}

export function explainError(error) {
  if (error?.code === 4001 || error?.code === "ACTION_REJECTED") {
    return "The wallet request was rejected.";
  }
  const text = error?.shortMessage || error?.reason || error?.message || "Something went wrong.";
  const quoted = String(text).match(/"([^"]+)"/);
  if (quoted) return quoted[1];
  return String(text).replace(/^execution reverted:?\s*/i, "");
}

export function validateRegistration({ name, batchNumber, serialNumber }) {
  const errors = {};
  const productName = name.trim();
  const batch = batchNumber.trim();
  const serial = serialNumber.trim();
  if (!productName || productName.length > 100) errors.name = "Enter a product name up to 100 characters.";
  if (!batch || batch.length > 64) errors.batchNumber = "Enter a batch number up to 64 characters.";
  if (!serial || serial.length > 128) errors.serialNumber = "Enter a serial number up to 128 characters.";
  return errors;
}

export function validateAddress(value) {
  return ethers.isAddress(value);
}

export function mapProduct(product) {
  const status = Number(product.status);
  return {
    name: product.name,
    batchNumber: product.batchNumber,
    productId: product.productId,
    manufacturer: product.manufacturer,
    currentCustodian: product.currentCustodian,
    registeredAt: Number(product.registeredAt),
    verificationCount: Number(product.verificationCount),
    status,
    statusName: STATUS_NAMES[status] || "Unknown"
  };
}

export function mapHistory(history) {
  return [...history].map((entry) => ({
    actor: entry.actor,
    from: entry.from,
    to: entry.to,
    timestamp: Number(entry.timestamp),
    action: Number(entry.action),
    actionName: ACTION_NAMES[Number(entry.action)] || "Unknown"
  }));
}

const TX_KEY = "provenance.transactions";

export function readTxLog() {
  try {
    return JSON.parse(localStorage.getItem(TX_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveTx(entry) {
  const next = [entry, ...readTxLog()].slice(0, 40);
  localStorage.setItem(TX_KEY, JSON.stringify(next));
  return next;
}

export function getClientId() {
  const key = "provenance.clientId";
  let value = localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(key, value);
  }
  return value;
}
