import { useWallet } from "../context/WalletContext";
import { ROLE_NAMES, formatEther, shortAddress } from "../utils/format";

export function WalletPage() {
  const { account, balance, chainId, network, role, isOwner, config, configError, error, connect, disconnect, switchToGanache, connecting } =
    useWallet();

  return (
    <main className="page">
      <p className="eyebrow">Wallet</p>
      <h1>MetaMask on Ganache</h1>
      <p className="lede">
        Transactions are signed in the browser. This app does not receive a private key. Import only a disposable
        Ganache development account, never a wallet that holds real ETH.
      </p>
      {configError && <p className="banner danger">{configError}</p>}
      {error && <p className="banner danger">{error}</p>}
      {!network.ok && account && (
        <p className="banner warn">
          This wallet is on {network.label}. Switch to Ganache before sending a transaction. Reads still use the local RPC
          configured for this project.
        </p>
      )}
      <section className="card detail-grid">
        <p>
          <span>Account</span>
          {account ? shortAddress(account) : "Not connected"}
        </p>
        <p>
          <span>Full address</span>
          {account || "—"}
        </p>
        <p>
          <span>Network</span>
          {network.label}
          {chainId != null ? ` · chain id ${chainId}` : ""}
        </p>
        <p>
          <span>Role</span>
          {account ? (isOwner ? "Contract owner" : ROLE_NAMES[role]) : "—"}
        </p>
        <p>
          <span>Test balance</span>
          {formatEther(balance)}
        </p>
        <p>
          <span>Contract</span>
          {config?.contractAddress || "Not deployed"}
        </p>
      </section>
      <div className="row">
        {!account && (
          <button type="button" onClick={connect} disabled={connecting}>
            {connecting ? "Waiting for MetaMask…" : "Connect wallet"}
          </button>
        )}
        {account && (
          <button type="button" className="secondary" onClick={disconnect}>
            Clear connection in this app
          </button>
        )}
        <button type="button" className="secondary" onClick={switchToGanache}>
          Switch to Ganache
        </button>
      </div>
      <p className="hint">Clearing the connection here forgets it in the page. MetaMask may still list this site as connected until you disconnect it in the extension.</p>
    </main>
  );
}
