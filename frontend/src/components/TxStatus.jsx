export function TxStatus({ tx }) {
  if (!tx) return null;
  return (
    <div className={`tx tx-${tx.state}`} role="status">
      <strong>{label(tx.state)}</strong>
      <p>{tx.message}</p>
      {tx.hash && (
        <p>
          Transaction hash: <code>{tx.hash}</code>
        </p>
      )}
    </div>
  );
}

function label(state) {
  if (state === "signing") return "Awaiting signature";
  if (state === "confirming") return "Waiting for receipt";
  if (state === "confirmed") return "Confirmed";
  return "Not confirmed";
}
