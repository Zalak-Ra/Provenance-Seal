import { getClient } from "../blockchain/client.js";
import { assertAddress } from "../utils/ids.js";

export async function getParticipant(req, res) {
  const address = assertAddress(req.params.address);
  const participant = await getClient().getParticipant(address);
  res.json(participant);
}
