import { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { useTrackedTx } from "../hooks/useTrackedTx";
import { resolveProductId, validateAddress } from "../utils/format";
import { TxStatus } from "./TxStatus";

export function TransferForm() {
  const { account, role, network } = useWallet();
  const { tx, run } = useTrackedTx();
  const [productInput, setProductInput] = useState("");
  const [receiver, setReceiver] = useState("");
  const [error, setError] = useState("");
  const allowed = account && network.ok && (role === 1 || role === 2);

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    if (!validateAddress(receiver)) {
      setError("Enter the receiver’s wallet address.");
      return;
    }
    let productId;
    try {
      productId = resolveProductId(productInput);
    } catch (submitError) {
      setError(submitError.message || "Transfer was not sent.");
      return;
    }
    try {
      await run("transfer", "transferCustody", [productId, receiver], {}, { productId });
    } catch {
      // The transaction status panel explains wallet and chain failures.
    }
  }

  return (
    <form className="card form" onSubmit={onSubmit}>
      <label>
        Serial, product id, or verification link
        <input value={productInput} onChange={(event) => setProductInput(event.target.value)} />
      </label>
      <label>
        Receiver address
        <input value={receiver} onChange={(event) => setReceiver(event.target.value)} placeholder="0x..." />
      </label>
      <p className="hint">
        A manufacturer can transfer only to an authorized distributor. A distributor can transfer only to an authorized
        retailer. The retailer is the final custodian in this version.
      </p>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" disabled={!allowed || tx?.state === "signing" || tx?.state === "confirming"}>
        Transfer custody
      </button>
      {!allowed && <p className="hint">Connect the current custodian on Ganache. The contract checks the caller, not this button.</p>}
      <TxStatus tx={tx} />
    </form>
  );
}
