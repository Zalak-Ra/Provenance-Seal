import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ActivityPage } from "./pages/ActivityPage";
import { AdminPage } from "./pages/AdminPage";
import { DistributorPage } from "./pages/DistributorPage";
import { HistoryPage } from "./pages/HistoryPage";
import { HomePage } from "./pages/HomePage";
import { ManufacturerPage } from "./pages/ManufacturerPage";
import { RegisterPage } from "./pages/RegisterPage";
import { RetailerPage } from "./pages/RetailerPage";
import { ScanPage } from "./pages/ScanPage";
import { TransferPage } from "./pages/TransferPage";
import { VerifyPage } from "./pages/VerifyPage";
import { WalletPage } from "./pages/WalletPage";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="wallet" element={<WalletPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="manufacturer" element={<ManufacturerPage />} />
        <Route path="distributor" element={<DistributorPage />} />
        <Route path="retailer" element={<RetailerPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="transfer" element={<TransferPage />} />
        <Route path="verify" element={<VerifyPage />} />
        <Route path="scan" element={<ScanPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="*" element={<MissingPage />} />
      </Route>
    </Routes>
  );
}

function MissingPage() {
  return (
    <main className="page">
      <p className="eyebrow">Missing page</p>
      <h1>That address is not part of this application.</h1>
    </main>
  );
}
