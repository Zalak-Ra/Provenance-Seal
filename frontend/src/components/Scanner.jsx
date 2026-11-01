import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { parseQrPayload } from "../utils/format";

export function Scanner({ onDetect }) {
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const scannerRef = useRef(null);

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      if (scanner?.isScanning) {
        scanner.stop().catch(() => {});
      }
    };
  }, []);

  async function start() {
    setError("");
    const scanner = new Html5Qrcode("qr-camera");
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: 220 },
        (text) => {
          const productId = parseQrPayload(text);
          if (!productId) {
            setError("This QR code does not contain a product identifier.");
            return;
          }
          setError("");
          onDetect(productId);
        },
        () => {}
      );
      setRunning(true);
    } catch {
      setRunning(false);
      setError("The camera could not be started. Upload a QR image or paste the identifier instead.");
    }
  }

  async function stop() {
    const scanner = scannerRef.current;
    if (scanner?.isScanning) {
      await scanner.stop();
      scanner.clear();
    }
    setRunning(false);
  }

  async function onFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    const scanner = new Html5Qrcode("qr-file");
    try {
      const text = await scanner.scanFile(file, true);
      const productId = parseQrPayload(text);
      if (!productId) {
        setError("This QR code does not contain a product identifier.");
        return;
      }
      onDetect(productId);
    } catch {
      setError("That image could not be read as a QR code.");
    } finally {
      scanner.clear();
    }
  }

  return (
    <div className="scanner">
      <div id="qr-camera" className="camera-box" />
      <div id="qr-file" className="hidden" />
      <div className="row">
        {!running ? (
          <button type="button" onClick={start}>
            Start camera
          </button>
        ) : (
          <button type="button" className="secondary" onClick={stop}>
            Stop camera
          </button>
        )}
        <label className="button secondary file-button">
          Upload QR image
          <input type="file" accept="image/*" onChange={onFile} />
        </label>
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
