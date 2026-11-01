import { config } from "../config/index.js";
import { HttpError } from "../utils/httpError.js";
import { hashValue } from "../utils/ids.js";
import { getClient } from "../blockchain/client.js";
import { assessScans } from "./analytics.js";
import { addScan, scansForProduct } from "./scanStore.js";

export async function assessmentFor(productId) {
  const scans = await scansForProduct(productId);
  return assessScans(scans, Date.now(), config);
}

export async function listProductScans(productId) {
  const scans = await scansForProduct(productId);
  return {
    productId,
    scans: scans.map(publicScan),
    assessment: assessScans(scans, Date.now(), config)
  };
}

/**
 * Record an off-chain scan. This does not submit a blockchain transaction.
 * Raw client ids and IP addresses are hashed before they are stored.
 */
export async function recordProductScan({ productId, clientId, region, remoteAddress }) {
  const client = getClient();
  let found = false;
  try {
    found = await client.productExists(productId);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "Blockchain RPC is not reachable.");
  }

  const entry = {
    productId: productId.toLowerCase(),
    timestamp: Date.now(),
    clientHash: clientId ? hashValue(clientId) : null,
    addressHash: hashValue(remoteAddress || "unknown"),
    region: region || null,
    found
  };
  await addScan(entry);

  let product = null;
  if (found) {
    product = await client.getProduct(productId);
  }

  const assessment = await assessmentFor(productId);
  return {
    found,
    paymentSubmitted: false,
    product,
    assessment,
    recordedAt: entry.timestamp
  };
}

function publicScan(scan) {
  return {
    timestamp: scan.timestamp,
    region: scan.region,
    found: scan.found,
    clientHashPrefix: scan.clientHash ? scan.clientHash.slice(0, 10) : null
  };
}
