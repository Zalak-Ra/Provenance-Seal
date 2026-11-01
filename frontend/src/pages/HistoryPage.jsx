import { useState } from "react";
import { RecordPanel } from "../components/RecordPanel";
import { useProductLookup } from "../hooks/useProductLookup";

export function HistoryPage() {
  const [input, setInput] = useState("");
  const { loading, error, record, lookup } = useProductLookup();

  return (
    <main className="page">
      <p className="eyebrow">History</p>
      <h1>Registration, custody, and paid checks</h1>
      <p className="lede">History entries are stored in the contract and also emitted as events. This page reads the contract.</p>
      <form
        className="card form"
        onSubmit={(event) => {
          event.preventDefault();
          lookup(input);
        }}
      >
        <label>
          Serial, product id, or verification link
          <input value={input} onChange={(event) => setInput(event.target.value)} />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Reading chain…" : "Load history"}
        </button>
        {error && <p className="form-error">{error}</p>}
      </form>
      <RecordPanel record={record} />
    </main>
  );
}
