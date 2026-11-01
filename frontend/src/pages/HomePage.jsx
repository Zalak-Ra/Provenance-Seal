import { Link } from "react-router-dom";
import { Disclaimer } from "../components/Disclaimer";

const steps = [
  ["Authorize", "The contract owner marks manufacturer, distributor, and retailer wallets."],
  ["Register", "A manufacturer commits a serial number. The chain stores the hash, name, and batch."],
  ["Hand over", "Custody moves to a distributor, then to a retailer. Each hop is an event."],
  ["Scan", "A customer opens the QR code and reads the record from Ganache."],
  ["Pay to verify", "An optional 0.001 ETH call records that this wallet checked the product. Gas is separate."],
  ["Watch repeats", "The API flags unusual scan patterns. A flag is a lead, not a verdict."]
];

export function HomePage() {
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Ethereum supply-chain record</p>
        <h1>See who claimed custody. Do not confuse that with the object itself.</h1>
        <p className="lede">
          Manufacturers register products, distributors and retailers record hand-offs, and customers inspect the
          history behind a QR code. The ledger makes those entries tamper-evident. It cannot see the package.
        </p>
        <div className="row">
          <Link className="button" to="/wallet">
            Connect MetaMask
          </Link>
          <Link className="button secondary" to="/verify">
            Check a product
          </Link>
        </div>
      </section>
      <Disclaimer />
      <section className="step-grid">
        {steps.map(([title, copy]) => (
          <article key={title}>
            <h2>{title}</h2>
            <p>{copy}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
