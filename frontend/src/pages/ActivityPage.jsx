import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { readTxLog, shortAddress } from "../utils/format";

export function ActivityPage() {
  const [localTx, setLocalTx] = useState([]);
  const [events, setEvents] = useState([]);
  const [apiNote, setApiNote] = useState("");

  useEffect(() => {
    setLocalTx(readTxLog());
    let cancelled = false;
    fetch("/api/events")
      .then((response) => {
        if (!response.ok) throw new Error("Event API unavailable");
        return response.json();
      })
      .then((body) => {
        if (!cancelled) {
          setEvents(body.events || []);
          setApiNote("");
        }
      })
      .catch(() => {
        if (!cancelled) setApiNote("The event API is not running. Confirmed hashes from this browser are still listed below.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="page">
      <p className="eyebrow">Activity</p>
      <h1>Confirmed transactions and contract events</h1>
      <p className="lede">
        A row appears in this browser only after Ganache returns a successful receipt. The chain list is read from the API and is the shared record.
      </p>
      {apiNote && <p className="banner warn">{apiNote}</p>}
      <section className="card">
        <h2>This browser</h2>
        {localTx.length === 0 && <p>No confirmed transactions have been saved in this browser yet.</p>}
        <ul className="plain-list">
          {localTx.map((entry) => (
            <li key={entry.hash}>
              <strong>{entry.type}</strong>
              <span> · {entry.status} · {new Date(entry.at).toLocaleString()}</span>
              <p>
                <code>{entry.hash}</code>
              </p>
              {entry.productId && (
                <p>
                  <Link to={`/verify?pid=${entry.productId}`}>{shortAddress(entry.productId)}</Link>
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section className="card">
        <h2>Contract events</h2>
        {events.length === 0 && <p>No events were returned. Deploy the contract and perform an action to populate this list.</p>}
        <ul className="plain-list">
          {events.map((event) => (
            <li key={`${event.transactionHash}-${event.logIndex}-${event.name}`}>
              <strong>{event.name}</strong>
              <span> · block {event.blockNumber}</span>
              <p>
                <code>{event.transactionHash}</code>
              </p>
              {event.args?.productId && (
                <p>
                  <Link to={`/verify?pid=${event.args.productId}`}>{shortAddress(event.args.productId)}</Link>
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
