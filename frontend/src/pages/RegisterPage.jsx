import { RegisterForm } from "../components/RegisterForm";

export function RegisterPage() {
  return (
    <main className="page">
      <p className="eyebrow">Registration</p>
      <h1>Commit a product to the ledger</h1>
      <p className="lede">The QR code appears only after Ganache confirms the transaction. A pending signature is not a registration.</p>
      <RegisterForm />
    </main>
  );
}
