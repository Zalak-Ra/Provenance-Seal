import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WalletProvider, useWallet } from "./context/WalletContext";
import { WalletPage } from "./pages/WalletPage";

const ACCOUNT = "0x1111111111111111111111111111111111111111";
const NEXT = "0x2222222222222222222222222222222222222222";

function installEthereum({ chainId = "0x539", reject = false } = {}) {
  const handlers = { accountsChanged: new Set(), chainChanged: new Set() };
  let accounts = [ACCOUNT];
  const ethereum = {
    on(name, fn) {
      handlers[name].add(fn);
    },
    removeListener(name, fn) {
      handlers[name].delete(fn);
    },
    async request({ method }) {
      if (method === "eth_requestAccounts" || method === "eth_accounts") {
        if (reject && method === "eth_requestAccounts") {
          const error = new Error("User rejected the request.");
          error.code = 4001;
          throw error;
        }
        return accounts;
      }
      if (method === "eth_chainId") return chainId;
      if (method === "eth_getBalance") return "0xDE0B6B3A7640000";
      if (method === "eth_blockNumber") return "0x1";
      if (method === "net_version") return "1337";
      throw new Error(`Unexpected ${method}`);
    },
    emit(name, payload) {
      if (name === "accountsChanged") accounts = payload;
      for (const fn of handlers[name] || []) fn(payload);
    }
  };
  window.ethereum = ethereum;
  return ethereum;
}

function SendProbe() {
  const { sendContract, connect, account, network } = useWallet();
  const [message, setMessage] = useState("");
  return (
    <>
      <button type="button" onClick={connect}>
        Connect
      </button>
      <p>{account || "No account"}</p>
      <p>{network.label}</p>
      <button
        type="button"
        onClick={async () => {
          try {
            await sendContract("verifyProduct", []);
          } catch (error) {
            setMessage(error.message);
          }
        }}
      >
        {message || "Send transaction"}
      </button>
    </>
  );
}

describe("MetaMask connection", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const target = String(url);
        if (target.includes("/abi/")) {
          return { ok: true, json: async () => ({ abi: [] }) };
        }
        return { ok: false, json: async () => ({}) };
      })
    );
  });

  afterEach(() => {
    delete window.ethereum;
    vi.unstubAllGlobals();
  });

  it("connects a wallet and follows account and network changes", async () => {
    const ethereum = installEthereum();
    render(
      <WalletProvider>
        <WalletPage />
      </WalletProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: /connect wallet/i }));
    expect(await screen.findByText(ACCOUNT)).toBeInTheDocument();
    expect(screen.getAllByText(/Ganache Local \(1337\)/).length).toBeGreaterThan(0);

    ethereum.emit("accountsChanged", [NEXT]);
    expect(await screen.findByText(NEXT)).toBeInTheDocument();

    ethereum.emit("chainChanged", "0x1");
    expect((await screen.findAllByText(/Unsupported network \(1\)/)).length).toBeGreaterThan(0);
  });

  it("reports a rejected connection and blocks a transaction on the wrong network", async () => {
    installEthereum({ reject: true });
    const rejected = render(
      <WalletProvider>
        <WalletPage />
      </WalletProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: /connect wallet/i }));
    expect(await screen.findByText(/wallet request was rejected/i)).toBeInTheDocument();
    rejected.unmount();

    installEthereum({ chainId: "0x1" });
    render(
      <WalletProvider>
        <SendProbe />
      </WalletProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: /^connect$/i }));
    expect(await screen.findByText(ACCOUNT)).toBeInTheDocument();
    expect(screen.getByText("Unsupported network (1)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /send transaction/i }));
    expect(await screen.findByRole("button", { name: /wrong network/i })).toBeInTheDocument();
  });
});
