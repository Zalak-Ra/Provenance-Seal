import { TransferForm } from "../components/TransferForm";

export function TransferPage() {
  return (
    <main className="page">
      <p className="eyebrow">Custody</p>
      <h1>Move a product one step forward</h1>
      <p className="lede">The contract checks the caller, the product status, and the receiver’s role. Skipping a step is rejected.</p>
      <TransferForm />
    </main>
  );
}
