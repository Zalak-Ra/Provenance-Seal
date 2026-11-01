import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { RecordPanel } from "./components/RecordPanel";
import { RegisterForm } from "./components/RegisterForm";
import { Scanner } from "./components/Scanner";
import { TransferForm } from "./components/TransferForm";
import { TxStatus } from "./components/TxStatus";
import { WalletProvider } from "./context/WalletContext";

vi.mock("html5-qrcode", () => ({
  Html5Qrcode: class {
    static fileText = "not-a-product-code";
    async start() {
      throw new Error("camera unavailable");
    }
    async scanFile() {
      return this.constructor.fileText;
    }
    clear() {}
    stop() {}
    isScanning = false;
  }
}));

function renderApp(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <WalletProvider>
        <App />
      </WalletProvider>
    </MemoryRouter>
  );
}

describe("pages and forms", () => {
  it("renders the landing page and the registration form", () => {
    renderApp("/");
    expect(screen.getByRole("heading", { name: /who claimed custody/i })).toBeInTheDocument();
  });

  it("shows registration validation errors and keeps the button blocked without a manufacturer wallet", () => {
    render(
      <WalletProvider>
        <RegisterForm />
      </WalletProvider>
    );
    fireEvent.submit(document.querySelector("form"));
    expect(screen.getByText(/Enter a product name up to 100 characters/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /register on-chain/i })).toBeDisabled();
  });

  it("rejects a transfer with an invalid receiver before any transaction", () => {
    render(
      <WalletProvider>
        <TransferForm />
      </WalletProvider>
    );
    fireEvent.change(screen.getByLabelText(/serial, product id/i), { target: { value: "SN-1" } });
    fireEvent.change(screen.getByLabelText(/receiver address/i), { target: { value: "nope" } });
    fireEvent.submit(screen.getByRole("button", { name: /transfer custody/i }).closest("form"));
    expect(screen.getByText(/Enter the receiver/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /transfer custody/i })).toBeDisabled();
  });

  it("shows a missing record and an incomplete history without calling the product genuine", () => {
    const { rerender } = render(<RecordPanel record={{ found: false, productId: "0xabc" }} />);
    expect(screen.getByText(/no on-chain record/i)).toBeInTheDocument();
    expect(screen.getByText(/does not by itself prove a counterfeit/i)).toBeInTheDocument();

    rerender(
      <RecordPanel
        record={{
          found: true,
          productId: "0x" + "ab".repeat(32),
          feeWei: "1000000000000000",
          product: {
            name: "Cedar Soap",
            batchNumber: "BATCH-7",
            productId: "0x" + "ab".repeat(32),
            manufacturer: "0x1111111111111111111111111111111111111111",
            currentCustodian: "0x2222222222222222222222222222222222222222",
            registeredAt: 1700000000,
            verificationCount: 2,
            status: 3,
            statusName: "With retailer"
          },
          history: [
            {
              actor: "0x1111111111111111111111111111111111111111",
              from: "0x0000000000000000000000000000000000000000",
              to: "0x1111111111111111111111111111111111111111",
              timestamp: 1700000000,
              action: 1,
              actionName: "Registered"
            }
          ]
        }}
      />
    );
    expect(screen.getByRole("heading", { name: "Cedar Soap" })).toBeInTheDocument();
    expect(screen.getByText(/does not prove the physical product is genuine/i, { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText(/fewer than two custody transfers/i)).toBeInTheDocument();
  });

  it("shows a failed transaction instead of a confirmation", () => {
    render(<TxStatus tx={{ state: "failed", message: "The wallet request was rejected." }} />);
    expect(screen.getByText("Not confirmed")).toBeInTheDocument();
    expect(screen.getByText("The wallet request was rejected.")).toBeInTheDocument();
  });

  it("explains a camera failure and an invalid QR image", async () => {
    const onDetect = vi.fn();
    render(<Scanner onDetect={onDetect} />);
    fireEvent.click(screen.getByRole("button", { name: /start camera/i }));
    expect(await screen.findByText(/camera could not be started/i)).toBeInTheDocument();

    const file = new File(["qr"], "code.png", { type: "image/png" });
    const input = document.querySelector("input[type=file]");
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText(/does not contain a product identifier/i)).toBeInTheDocument();
    expect(onDetect).not.toHaveBeenCalled();
  });
});
