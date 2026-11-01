import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { shortAddress } from "../utils/format";

export function ManufacturerPage() {
  const { account, role } = useWallet();
  const [events, setEvents] = useState([]);
  const [apiNote, setApiNote] = useState("");

  useEffect(() => {
    fetch("/api/events")
      .then((response) => {
        if (!response.ok) throw new Error("Event API unavailable");
        return response.json();
      })
      .then((body) => {
        const mine = (body.events || []).filter(
          (event) =>
            event.name === "ProductRegistered" &&
            account &&
            event.args.manufacturer?.toLowerCase() === account.toLowerCase()
        );
        setEvents(mine);
        setApiNote("");
      })
      .catch(() => setApiNote("The event API is not running. Registration still works through MetaMask."));
  }, [account]);

  return (
    <main className="page">
      <p className="eyebrow">Manufacturer</p>
      <h1>Register products and start custody</h1>
      <p className="lede">
        {role === 1
          ? "This wallet is an authorized manufacturer."
          : "This wallet is not a manufacturer. The contract will reject registration from it."}
      </p>
      <div className="row">
        <Link className="button" to="/register">
          Register a product
        </Link>
        <Link className="button secondary" to="/transfer">
          Transfer to a distributor
        </Link>
      </div>
      {apiNote && <p className="banner warn">{apiNote}</p>}
      <section className="card">
        <h2>Registrations from this wallet</h2>
        {events.length === 0 && <p>No ProductRegistered events for this account yet.</p>}
        <ul className="plain-list">
          {events.map((event) => (
            <li key={`${event.transactionHash}-${event.logIndex}`}>
              <Link to={`/verify?pid=${event.args.productId}`}>{event.args.name}</Link>
              <span> · batch {event.args.batchNumber} · {shortAddress(event.args.productId)}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
