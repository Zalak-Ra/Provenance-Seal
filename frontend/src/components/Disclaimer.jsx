export function Disclaimer() {
  return (
    <aside className="disclaimer">
      <strong>What this check can and cannot say</strong>
      <p>
        A matching blockchain record shows that an authorized wallet wrote this history and that later edits to that
        history are detectable. It does not prove the physical product is genuine. A QR code can be copied onto another item.
      </p>
    </aside>
  );
}

export function Assessment({ assessment }) {
  if (!assessment) return null;
  return (
    <aside className={`assessment ${assessment.level}`}>
      <strong>Scan signal: {assessment.level}</strong>
      <p>{assessment.disclaimer}</p>
      {assessment.reasons?.length > 0 && (
        <ul>
          {assessment.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
    </aside>
  );
}
