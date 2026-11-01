import { useEffect, useState } from "react";
import { useWallet } from "../context/WalletContext";
import { useTrackedTx } from "../hooks/useTrackedTx";
import { getContract, getReadProvider } from "../services/contract";
import { ROLE_NAMES, formatEther, shortAddress, validateAddress } from "../utils/format";
import { TxStatus } from "../components/TxStatus";

export function AdminPage() {
  const { config, isOwner, account, network } = useWallet();
  const roleTx = useTrackedTx();
  const feeTx = useTrackedTx();
  const withdrawTx = useTrackedTx();
  const [participants, setParticipants] = useState([]);
  const [contractBalance, setContractBalance] = useState(null);
  const [fee, setFee] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [roleForm, setRoleForm] = useState({ address: "", role: "1" });
  const [feeEth, setFeeEth] = useState("0.001");
  const [withdrawForm, setWithdrawForm] = useState({ to: "", amount: "" });
  const [formError, setFormError] = useState("");

  async function reload() {
    if (!config?.contractAddress) return;
    try {
      const contract = getContract(config, getReadProvider(config.rpcUrl));
      const [listed, balance, nextFee] = await Promise.all([
        contract.getParticipants(),
        contract.getContractBalance(),
        contract.getVerificationFee()
      ]);
      setParticipants(listed[0].map((address, index) => ({ address, role: Number(listed[1][index]) })));
      setContractBalance(balance);
      setFee(nextFee);
      setLoadError("");
    } catch (error) {
      setLoadError(error.shortMessage || error.message);
    }
  }

  useEffect(() => {
    reload();
  }, [config, roleTx.tx?.hash, feeTx.tx?.hash, withdrawTx.tx?.hash]);

  const canWrite = account && isOwner && network.ok;

  async function submitRole(event) {
    event.preventDefault();
    setFormError("");
    if (!validateAddress(roleForm.address)) {
      setFormError("Enter a wallet address to authorize.");
      return;
    }
    try {
      await roleTx.run("role", "setParticipantRole", [roleForm.address, Number(roleForm.role)]);
    } catch {
      // Shown in the transaction panel.
    }
  }

  async function submitFee(event) {
    event.preventDefault();
    try {
      const { ethers } = await import("ethers");
      await feeTx.run("fee", "updateVerificationFee", [ethers.parseEther(feeEth)]);
    } catch {
      // Shown in the transaction panel.
    }
  }

  async function submitWithdraw(event) {
    event.preventDefault();
    if (!validateAddress(withdrawForm.to)) {
      setFormError("Enter a recipient for the withdrawal.");
      return;
    }
    try {
      const { ethers } = await import("ethers");
      await withdrawTx.run("withdraw", "withdraw", [withdrawForm.to, ethers.parseEther(withdrawForm.amount)]);
    } catch {
      // Shown in the transaction panel.
    }
  }

  return (
    <main className="page">
      <p className="eyebrow">Admin</p>
      <h1>Participants, fee, and collected ETH</h1>
      <p className="lede">Only the deploying wallet can change roles, the verification fee, or withdraw funds. The contract enforces that.</p>
      {loadError && <p className="banner danger">{loadError}</p>}
      {!canWrite && <p className="banner warn">Connect the contract owner on Ganache to submit these transactions.</p>}
      <section className="stat-row">
        <article>
          <span>Contract balance</span>
          <strong>{formatEther(contractBalance)}</strong>
        </article>
        <article>
          <span>Verification fee</span>
          <strong>{formatEther(fee)}</strong>
        </article>
      </section>
      <section className="card">
        <h2>Authorized wallets</h2>
        {participants.length === 0 && <p>No participant roles have been written yet.</p>}
        <ul className="plain-list">
          {participants.map((participant) => (
            <li key={participant.address}>
              <code>{shortAddress(participant.address)}</code> · {ROLE_NAMES[participant.role]}
            </li>
          ))}
        </ul>
      </section>
      <form className="card form" onSubmit={submitRole}>
        <h2>Set a role</h2>
        <label>
          Wallet
          <input value={roleForm.address} onChange={(event) => setRoleForm({ ...roleForm, address: event.target.value })} />
        </label>
        <label>
          Role
          <select value={roleForm.role} onChange={(event) => setRoleForm({ ...roleForm, role: event.target.value })}>
            <option value="1">Manufacturer</option>
            <option value="2">Distributor</option>
            <option value="3">Retailer</option>
            <option value="0">Revoke</option>
          </select>
        </label>
        {formError && <p className="form-error">{formError}</p>}
        <button type="submit" disabled={!canWrite || roleTx.tx?.state === "signing" || roleTx.tx?.state === "confirming"}>
          Update role
        </button>
        <TxStatus tx={roleTx.tx} />
      </form>
      <form className="card form" onSubmit={submitFee}>
        <h2>Verification fee</h2>
        <label>
          Fee in test ETH
          <input value={feeEth} onChange={(event) => setFeeEth(event.target.value)} />
        </label>
        <p className="hint">This is the amount verifyProduct requires. It is not the gas price. The contract caps the fee at 1 ETH.</p>
        <button type="submit" disabled={!canWrite || feeTx.tx?.state === "signing" || feeTx.tx?.state === "confirming"}>
          Update fee
        </button>
        <TxStatus tx={feeTx.tx} />
      </form>
      <form className="card form" onSubmit={submitWithdraw}>
        <h2>Withdraw fees</h2>
        <label>
          Recipient
          <input value={withdrawForm.to} onChange={(event) => setWithdrawForm({ ...withdrawForm, to: event.target.value })} />
        </label>
        <label>
          Amount in test ETH
          <input value={withdrawForm.amount} onChange={(event) => setWithdrawForm({ ...withdrawForm, amount: event.target.value })} />
        </label>
        <button type="submit" disabled={!canWrite || withdrawTx.tx?.state === "signing" || withdrawTx.tx?.state === "confirming"}>
          Withdraw
        </button>
        <TxStatus tx={withdrawTx.tx} />
      </form>
    </main>
  );
}
