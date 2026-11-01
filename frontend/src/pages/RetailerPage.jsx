import { useState } from "react";
import { RecordPanel } from "../components/RecordPanel";
import { useProductLookup } from "../hooks/useProductLookup";
import { useWallet } from "../context/WalletContext";
import { shortAddress } from "../utils/format";

export function RetailerPage() {
  const { account, role } = useWallet();
  const { loading, error, record, lookup } = useProductLookup();
  const [input, setInput] = useState("");

  const holds =
    record?.found && account && record.product.currentCustodian.toLowerCase() === account.toLowerCase();

  return (
    <main className="page">
      <p className="eyebrow">Retailer</p>
      <h1>Check what this shop currently holds</h1>
      <p className="lede">
        {role === 3
          ? "This wallet is an authorized retailer. Custody stops here in the current contract."
          : "This wallet is not a retailer. You can still read public product records."}
      </p>
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
          {loading ? "Reading chain…" : "Look up product"}
        </button>
        {error && <p className="form-error">{error}</p>}
      </form>
      {record?.found && (
        <p className={holds ? "banner ok" : "banner warn"}>
          {holds
            ? "The connected wallet is the current custodian."
            : `Current custodian is ${shortAddress(record.product.currentCustodian)}.`}
        </p>
      )}
      <RecordPanel record={record} />
    </main>
  );
}
