import { TransferForm } from "../components/TransferForm";
import { useWallet } from "../context/WalletContext";

export function DistributorPage() {
  const { role } = useWallet();
  return (
    <main className="page">
      <p className="eyebrow">Distributor</p>
      <h1>Receive goods, then send them to a retailer</h1>
      <p className="lede">
        {role === 2
          ? "This wallet is an authorized distributor. You can transfer products currently in your custody."
          : "This wallet is not a distributor. A transfer from it will be rejected on-chain."}
      </p>
      <TransferForm />
    </main>
  );
}
