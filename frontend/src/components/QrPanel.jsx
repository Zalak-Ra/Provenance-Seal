import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrPanel({ value, productId }) {
  const [dataUrl, setDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { margin: 1, width: 320, color: { dark: "#1c2420", light: "#f4f1e8" } })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
  }

  return (
    <section className="qr-panel">
      <h3>Product QR</h3>
      <p>The code opens the verification page for this identifier. Anyone can copy it.</p>
      {dataUrl && <img src={dataUrl} alt="QR code for this product record" />}
      <p>
        <code>{productId}</code>
      </p>
      <div className="row">
        <a className="button secondary" href={dataUrl} download={`${productId}.png`}>
          Download QR
        </a>
        <button type="button" className="secondary" onClick={copy}>
          {copied ? "Link copied" : "Copy verification link"}
        </button>
      </div>
    </section>
  );
}
