import { shortAddress, formatTime } from "../utils/format";
import { Assessment, Disclaimer } from "./Disclaimer";

export function RecordPanel({ record }) {
  if (!record) return null;
  if (!record.found) {
    return (
      <section className="card">
        <h3>No on-chain record</h3>
        <p>
          Identifier <code>{record.productId}</code> is not registered. That does not by itself prove a counterfeit, but
          there is no custody history to show.
        </p>
      </section>
    );
  }

  const { product, history } = record;
  const notes = historyNotes(product, history);
  return (
    <section className="stack">
      <Disclaimer />
      {notes.length > 0 && (
        <aside className="banner warn">
          <strong>Incomplete history signal</strong>
          <ul>
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <p>This is a consistency check on the stored record. It is not proof that a physical item is counterfeit.</p>
        </aside>
      )}
      <article className="card product-sheet">
        <header>
          <p className="eyebrow">Chain record</p>
          <h3>{product.name}</h3>
          <span className={`status status-${product.status}`}>{product.statusName}</span>
        </header>
        <dl>
          <div>
            <dt>Product identifier</dt>
            <dd>
              <code>{product.productId}</code>
            </dd>
          </div>
          <div>
            <dt>Batch</dt>
            <dd>{product.batchNumber}</dd>
          </div>
          <div>
            <dt>Manufacturer</dt>
            <dd>{shortAddress(product.manufacturer)}</dd>
          </div>
          <div>
            <dt>Current custodian</dt>
            <dd>{shortAddress(product.currentCustodian)}</dd>
          </div>
          <div>
            <dt>Registered</dt>
            <dd>{formatTime(product.registeredAt)}</dd>
          </div>
          <div>
            <dt>Paid verifications</dt>
            <dd>{product.verificationCount}</dd>
          </div>
        </dl>
        <p className="hint">Read from the configured Ganache RPC through ethers.js. Cached API data is not treated as the record.</p>
      </article>
      <HistoryTimeline history={history} />
      <Assessment assessment={record.assessment} />
    </section>
  );
}

function historyNotes(product, history) {
  const notes = [];
  const entries = history || [];
  if (!entries.length) {
    notes.push("The product exists, but no history entries were returned.");
    return notes;
  }
  if (Number(entries[0].action) !== 1) {
    notes.push("The stored history does not start with a registration entry.");
  }
  const transfers = entries.filter((entry) => Number(entry.action) === 2).length;
  if (Number(product.status) >= 2 && transfers < 1) {
    notes.push("Status says the product left the manufacturer, but no custody transfer is in the history.");
  }
  if (Number(product.status) >= 3 && transfers < 2) {
    notes.push("Status says the product is with a retailer, but the history has fewer than two custody transfers.");
  }
  return notes;
}

export function HistoryTimeline({ history }) {
  if (!history?.length) return null;
  return (
    <ol className="timeline">
      {history.map((entry, index) => (
        <li key={`${entry.timestamp}-${entry.action}-${index}`}>
          <span>{entry.actionName}</span>
          <strong>{formatTime(entry.timestamp)}</strong>
          <p>
            {shortAddress(entry.actor)}
            {entry.action === 2 ? ` moved custody from ${shortAddress(entry.from)} to ${shortAddress(entry.to)}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}
