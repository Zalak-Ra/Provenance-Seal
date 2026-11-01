import { NavLink, Outlet } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { ROLE_NAMES, formatEther, shortAddress } from "../utils/format";

const groups = [
  {
    label: "Start",
    links: [
      ["Overview", "/"],
      ["Wallet", "/wallet"]
    ]
  },
  {
    label: "Supply chain",
    links: [
      ["Admin", "/admin"],
      ["Manufacturer", "/manufacturer"],
      ["Register", "/register"],
      ["Distributor", "/distributor"],
      ["Retailer", "/retailer"],
      ["Transfer", "/transfer"]
    ]
  },
  {
    label: "Customers",
    links: [
      ["Verify", "/verify"],
      ["Scan QR", "/scan"],
      ["History", "/history"],
      ["Activity", "/activity"]
    ]
  }
];

export function Layout() {
  const { account, network, role, isOwner, balance, connect, connecting } = useWallet();

  return (
    <div className="shell">
      <aside className="nav">
        <p className="brand-mark">PS</p>
        {groups.map((group) => (
          <div key={group.label}>
            <p className="nav-label">{group.label}</p>
            {group.links.map(([label, to]) => (
              <NavLink key={to} to={to} end={to === "/"}>
                {label}
              </NavLink>
            ))}
          </div>
        ))}
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <p className="brand">Provenance Seal</p>
            <p className="brand-sub">Product record verification</p>
          </div>
          <div className="wallet-chip">
            <span className={network.ok ? "pill ok" : "pill bad"}>{network.label}</span>
            {account && (
              <span className="pill">
                {isOwner ? "Owner" : ROLE_NAMES[role]} · {shortAddress(account)}
              </span>
            )}
            {balance != null && <span className="pill">{formatEther(balance)}</span>}
            {account ? null : (
              <button type="button" onClick={connect} disabled={connecting}>
                {connecting ? "Connecting…" : "Connect wallet"}
              </button>
            )}
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
