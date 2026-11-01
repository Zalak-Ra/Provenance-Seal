import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RecordPanel } from "../components/RecordPanel";
import { TxStatus } from "../components/TxStatus";
import { useProductLookup } from "../hooks/useProductLookup";
import { useTrackedTx } from "../hooks/useTrackedTx";
import { useWallet } from "../context/WalletContext";
import { formatEther } from "../utils/format";

export function VerifyPage() {
  const [params] = useSearchParams();
  const initial = params.get("pid") || "";
  const [input, setInput] = useState(initial);
  const { loading, error, record, lookup } = useProductLookup();
  const { account, network } = useWallet();
  const { tx, run } = useTrackedTx();

  useEffect(() => {
    if (initial) lookup(initial);
  }, [initial]);

  async function pay() {
    if (!record?.found) return;
    try {
      await run("verify", "verifyProduct", [record.productId], { value: BigInt(record.feeWei) }, { productId: record.productId });
      await lookup(record.productId);
    } catch {
      // Receipt status is shown separately from the read-only record.
    }
  }

  return (
    <main className="page">
      <p className="eyebrow">Verification</p>
      <h1>Read the record, then optionally pay to log the check</h1>
      <p className="lede">
        Looking up a product is free and does not call the payable function. Paying the verification fee writes a
        ProductVerified event. MetaMask will also estimate a separate gas fee.
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
          {loading ? "Reading chain…" : "Read record"}
        </button>
        {error && <p className="form-error">{error}</p>}
      </form>
      <RecordPanel record={record} />
      {record?.found && (
        <section className="card">
          <h2>Paid verification</h2>
          <p>
            The contract currently requires <strong>{formatEther(record.feeWei)}</strong>. An underpayment or overpayment
            is rejected and is not counted.
          </p>
          <button type="button" onClick={pay} disabled={!account || !network.ok || tx?.state === "signing" || tx?.state === "confirming"}>
            Verify and pay test ETH
          </button>
          {(!account || !network.ok) && <p className="hint">Connect MetaMask to Ganache. The payment is not sent on the wrong network.</p>}
          <TxStatus tx={tx} />
        </section>
      )}
    </main>
  );
}
