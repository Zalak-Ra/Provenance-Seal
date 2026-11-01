import { useEffect, useState } from "react";
import { getContract, getReadProvider } from "../services/contract";
import { useWallet } from "../context/WalletContext";
import { explainError, mapHistory, mapProduct, resolveProductId } from "../utils/format";

export function useProductLookup() {
  const { config } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [record, setRecord] = useState(null);

  async function lookup(raw) {
    setLoading(true);
    setError("");
    setRecord(null);
    try {
      if (!config?.contractAddress) {
        throw new Error("The contract address is not loaded. Start Ganache, migrate, and restart the API.");
      }
      const productId = resolveProductId(raw);
      const contract = getContract(config, getReadProvider(config.rpcUrl));
      const exists = await contract.productExists(productId);
      if (!exists) {
        setRecord({ found: false, productId });
        setLoading(false);
        return { found: false, productId };
      }
      const [product, history, fee] = await Promise.all([
        contract.getProduct(productId),
        contract.getHistory(productId),
        contract.getVerificationFee()
      ]);
      let assessment = null;
      try {
        const response = await fetch(`/api/products/${productId}`);
        if (response.ok) assessment = (await response.json()).assessment;
      } catch {
        assessment = null;
      }
      const next = {
        found: true,
        productId,
        product: mapProduct(product),
        history: mapHistory(history),
        feeWei: fee.toString(),
        assessment
      };
      setRecord(next);
      setLoading(false);
      return next;
    } catch (lookupError) {
      setError(explainError(lookupError));
      setLoading(false);
      return null;
    }
  }

  useEffect(() => {}, [config]);

  return { loading, error, record, lookup, setRecord };
}
