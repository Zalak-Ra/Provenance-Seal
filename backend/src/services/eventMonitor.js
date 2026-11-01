import { getClient } from "../blockchain/client.js";

let timer = null;
const seen = new Set();

/**
 * Poll contract logs and log newly observed events.
 * Polling keeps the process compatible with Ganache without a websocket subscription.
 */
export function startEventMonitor(client = getClient(), intervalMs = 15000) {
  if (timer) clearInterval(timer);

  const tick = async () => {
    try {
      const events = await client.getEvents(0);
      for (const event of events) {
        const key = `${event.transactionHash}:${event.logIndex}:${event.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        console.log(`[chain-event] ${event.name} block=${event.blockNumber} tx=${event.transactionHash}`);
      }
    } catch (error) {
      console.error(`[chain-event] monitor waiting: ${error.message}`);
    }
  };

  timer = setInterval(tick, intervalMs);
  tick();
  return () => {
    clearInterval(timer);
    timer = null;
  };
}
