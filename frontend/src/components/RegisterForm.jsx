import { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { useTrackedTx } from "../hooks/useTrackedTx";
import { generateProductId, validateRegistration } from "../utils/format";
import { QrPanel } from "./QrPanel";
import { TxStatus } from "./TxStatus";

export function RegisterForm() {
  const { account, role, network } = useWallet();
  const { tx, run } = useTrackedTx();
  const [form, setForm] = useState({ name: "", batchNumber: "", serialNumber: "" });
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const blocked = !account || !network.ok || role !== 1;

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    const nextErrors = validateRegistration(form);
    setErrors(nextErrors);
    setResult(null);
    if (Object.keys(nextErrors).length) return;
    const serial = form.serialNumber.trim();
    const productId = generateProductId(serial);
    try {
      await run("register", "registerProduct", [form.name.trim(), form.batchNumber.trim(), serial], {}, { productId });
      setResult({ productId, url: `${window.location.origin}/verify?pid=${productId}` });
    } catch {
      // The transaction status panel already explains the failure.
    }
  }

  return (
    <form className="card form" onSubmit={onSubmit}>
      <label>
        Product name
        <input name="name" value={form.name} onChange={update} maxLength={100} />
        {errors.name && <span className="form-error">{errors.name}</span>}
      </label>
      <label>
        Batch number
        <input name="batchNumber" value={form.batchNumber} onChange={update} maxLength={64} />
        {errors.batchNumber && <span className="form-error">{errors.batchNumber}</span>}
      </label>
      <label>
        Serial number
        <input name="serialNumber" value={form.serialNumber} onChange={update} maxLength={128} />
        {errors.serialNumber && <span className="form-error">{errors.serialNumber}</span>}
      </label>
      <p className="hint">The serial is hashed in the contract. The raw serial is not stored on-chain. Do not put a person’s name or contact details in these fields.</p>
      <button type="submit" disabled={blocked || tx?.state === "signing" || tx?.state === "confirming"}>
        Register on-chain
      </button>
      {blocked && <p className="hint">An authorized manufacturer on Ganache Local can submit this. Other wallets are rejected by the contract.</p>}
      <TxStatus tx={tx} />
      {result && tx?.state === "confirmed" && <QrPanel value={result.url} productId={result.productId} />}
    </form>
  );
}
