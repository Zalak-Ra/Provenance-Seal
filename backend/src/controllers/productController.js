import { getClient } from "../blockchain/client.js";
import { assertProductId } from "../utils/ids.js";
import { assessmentFor, listProductScans, recordProductScan } from "../services/scanService.js";
import { HttpError } from "../utils/httpError.js";
import { normalizeRegion } from "../utils/ids.js";

export async function getProduct(req, res) {
  const productId = assertProductId(req.params.productId);
  const product = await getClient().getProduct(productId);
  const assessment = await assessmentFor(productId);
  res.json({ product, assessment });
}

export async function getHistory(req, res) {
  const productId = assertProductId(req.params.productId);
  const history = await getClient().getHistory(productId);
  res.json({ productId, history, source: "blockchain" });
}

/**
 * Read the chain record. This handler never sends a transaction and never takes a fee.
 */
export async function readVerification(req, res) {
  const productId = assertProductId(req.params.productId);
  const product = await getClient().getProduct(productId);
  const history = await getClient().getHistory(productId);
  const assessment = await assessmentFor(productId);
  res.json({
    recordFound: true,
    paymentSubmitted: false,
    note: "This response reads the on-chain record. It does not call verifyProduct and it does not pay the verification fee. A registered record does not prove the physical item is genuine.",
    product,
    history,
    assessment
  });
}

export async function postScan(req, res) {
  const productId = assertProductId(req.body?.productId);
  const clientId = typeof req.body?.clientId === "string" ? req.body.clientId.slice(0, 80) : "";
  const region = normalizeRegion(req.body?.region);
  const result = await recordProductScan({
    productId,
    clientId,
    region,
    remoteAddress: req.socket?.remoteAddress || ""
  });

  if (!result.found) {
    throw new HttpError(404, "Product is not registered on the blockchain.", {
      found: false,
      paymentSubmitted: false,
      assessment: result.assessment
    });
  }

  res.status(201).json(result);
}

export async function getScans(req, res) {
  const productId = assertProductId(req.params.productId);
  res.json(await listProductScans(productId));
}
