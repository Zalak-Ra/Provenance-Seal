import { useState } from "react";
import { Assessment } from "../components/Disclaimer";
import { RecordPanel } from "../components/RecordPanel";
import { Scanner } from "../components/Scanner";
import { useProductLookup } from "../hooks/useProductLookup";
import { getClientId } from "../utils/format";

const regions = ["", "India", "Singapore", "United Arab Emirates", "United Kingdom", "United States"];

export function ScanPage() {
  const [manual, setManual] = useState("");
  const [region, setRegion] = useState("");
  const [scanNote, setScanNote] = useState(null);
  const [scanError, setScanError] = useState("");
  const { loading, error, record, lookup } = useProductLookup();

  async function inspect(productId) {
    setManual(productId);
    setScanError("");
    setScanNote(null);
    try {
      const response = await fetch("/api/products/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          clientId: getClientId(),
          region: region || undefined
        })
      });
      const body = await response.json();
      setScanNote(body.assessment || null);
      if (!response.ok && !body.assessment) setScanError(body.error || "The scan was not recorded.");
    } catch {
      setScanError("Scan analytics is unavailable. The chain lookup still runs.");
    }
    await lookup(productId);
  }

  return (
    <main className="page">
      <p className="eyebrow">QR scan</p>
      <h1>Scan a code, or paste one if the camera is unavailable</h1>
      <p className="lede">
        A scan records an off-chain analytics event. It does not submit the paid verification transaction. Region is
        optional, coarse, and client-reported.
      </p>
      <label>
        Optional reported region
        <select value={region} onChange={(event) => setRegion(event.target.value)}>
          {regions.map((item) => (
            <option key={item || "none"} value={item}>
              {item || "Prefer not to say"}
            </option>
          ))}
        </select>
      </label>
      <Scanner onDetect={inspect} />
      <form
        className="card form"
        onSubmit={(event) => {
          event.preventDefault();
          const match = manual.match(/0x[0-9a-fA-F]{64}/);
          if (!match) {
            setScanError("Paste a product identifier or a verification link. A random code is not accepted here.");
            return;
          }
          inspect(match[0]);
        }}
      >
        <label>
          Product identifier or link
          <input value={manual} onChange={(event) => setManual(event.target.value)} />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Checking…" : "Check this code"}
        </button>
      </form>
      {scanError && <p className="banner danger">{scanError}</p>}
      <Assessment assessment={scanNote} />
      {error && <p className="form-error">{error}</p>}
      <RecordPanel record={record} />
    </main>
  );
}
