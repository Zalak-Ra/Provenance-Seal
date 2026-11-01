import { getClient } from "../blockchain/client.js";
import { assertProductId } from "../utils/ids.js";

export async function getEvents(req, res) {
  const events = await getClient().getEvents(0);
  const productId = req.query.productId;
  const filtered = productId
    ? events.filter((event) => {
        assertProductId(String(productId));
        return String(event.args.productId || "").toLowerCase() === String(productId).toLowerCase();
      })
    : events;
  const limit = Math.min(Number(req.query.limit || 100), 200);
  res.json({ events: filtered.slice(-limit), source: "blockchain" });
}
