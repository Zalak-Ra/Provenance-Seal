import { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { explainError, saveTx } from "../utils/format";

export function useTrackedTx() {
  const { sendContract, refreshAccount, account, chainId } = useWallet();
  const [tx, setTx] = useState(null);

  async function run(type, method, args = [], txOptions = {}, extra = {}) {
    setTx({
      state: "signing",
      message: "Confirm the request in MetaMask. It is not recorded until you approve it and Ganache returns a receipt."
    });
    try {
      const sent = await sendContract(method, args, txOptions);
      setTx({
        state: "confirming",
        hash: sent.hash,
        message: "Transaction submitted. Waiting for the Ganache receipt before treating it as confirmed."
      });
      const receipt = await sent.wait();
      if (!receipt || Number(receipt.status) !== 1) {
        throw new Error("The transaction was mined but it reverted.");
      }
      saveTx({ hash: receipt.hash, type, at: Date.now(), status: "confirmed", ...extra });
      setTx({ state: "confirmed", hash: receipt.hash, message: "Transaction confirmed on Ganache." });
      await refreshAccount(account, chainId).catch(() => {});
      return receipt;
    } catch (error) {
      setTx({ state: "failed", message: explainError(error) });
      throw error;
    }
  }

  return { tx, run };
}
