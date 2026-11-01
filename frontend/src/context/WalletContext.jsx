import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContract, loadChainConfig } from "../services/contract";
import { explainError, networkStatus, parseChainId } from "../utils/format";

const WalletContext = createContext(null);
const GANACHE_CHAIN_HEX = "0x539";

export function WalletProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState("");
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState(null);
  const [balance, setBalance] = useState(null);
  const [role, setRole] = useState(0);
  const [isOwner, setIsOwner] = useState(false);
  const [feeWei, setFeeWei] = useState(null);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);

  const expectedChainId = config?.expectedChainId || 1337;
  const network = networkStatus(chainId, expectedChainId);

  useEffect(() => {
    let cancelled = false;
    loadChainConfig()
      .then((loaded) => {
        if (!cancelled) setConfig(loaded);
      })
      .catch((loadError) => {
        if (!cancelled) setConfigError(loadError.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshAccount = useCallback(
    async (nextAccount, activeChainId) => {
      if (!nextAccount || !window.ethereum) return;
      const provider = new ethers.BrowserProvider(window.ethereum);
      const networkResult = await provider.getNetwork();
      const resolvedChain = activeChainId ?? Number(networkResult.chainId);
      setChainId(resolvedChain);
      setBalance(await provider.getBalance(nextAccount));

      if (!config?.contractAddress || resolvedChain !== Number(expectedChainId)) {
        setRole(0);
        setIsOwner(false);
        setFeeWei(null);
        return;
      }

      const contract = getContract(config, provider);
      const [nextRole, owner, fee] = await Promise.all([
        contract.getParticipantRole(nextAccount),
        contract.owner(),
        contract.getVerificationFee()
      ]);
      setRole(Number(nextRole));
      setIsOwner(owner.toLowerCase() === nextAccount.toLowerCase());
      setFeeWei(fee);
    },
    [config, expectedChainId]
  );

  useEffect(() => {
    if (!window.ethereum) return undefined;
    const onAccounts = (accounts) => {
      const next = accounts?.[0] || "";
      setAccount(next);
      setError("");
      if (!next) {
        setBalance(null);
        setRole(0);
        setIsOwner(false);
        return;
      }
      refreshAccount(next).catch((refreshError) => setError(explainError(refreshError)));
    };
    const onChain = (nextChain) => {
      const parsed = parseChainId(nextChain);
      setChainId(parsed);
      if (account) {
        refreshAccount(account, parsed).catch((refreshError) => setError(explainError(refreshError)));
      }
    };
    window.ethereum.on("accountsChanged", onAccounts);
    window.ethereum.on("chainChanged", onChain);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", onAccounts);
      window.ethereum?.removeListener?.("chainChanged", onChain);
    };
  }, [account, refreshAccount]);

  async function connect() {
    setError("");
    if (!window.ethereum) {
      setError("MetaMask is not installed. Install the extension and reload this page.");
      return;
    }
    setConnecting(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      if (!accounts.length) {
        setError("MetaMask did not return an account.");
        setAccount("");
        return;
      }
      setAccount(accounts[0]);
      const networkResult = await provider.getNetwork();
      await refreshAccount(accounts[0], Number(networkResult.chainId));
    } catch (connectError) {
      setAccount("");
      setError(explainError(connectError));
    } finally {
      setConnecting(false);
    }
  }

  function disconnect() {
    setAccount("");
    setBalance(null);
    setRole(0);
    setIsOwner(false);
    setChainId(null);
    setError("");
  }

  async function switchToGanache() {
    if (!window.ethereum) {
      setError("MetaMask is not installed.");
      return;
    }
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: GANACHE_CHAIN_HEX }]
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: GANACHE_CHAIN_HEX,
                chainName: "Ganache Local",
                nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
                rpcUrls: [config?.rpcUrl || "http://127.0.0.1:8545"]
              }
            ]
          });
        } catch (addError) {
          setError(explainError(addError));
        }
      } else {
        setError(explainError(switchError));
      }
    }
  }

  async function sendContract(method, args = [], txOptions = {}) {
    if (!window.ethereum) throw new Error("MetaMask is not installed.");
    if (!account) throw new Error("Connect a wallet before sending a transaction.");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const networkResult = await provider.getNetwork();
    if (Number(networkResult.chainId) !== Number(expectedChainId)) {
      throw new Error(`Wrong network. Switch MetaMask to Ganache Local (${expectedChainId}). The transaction was not sent.`);
    }
    const signer = await provider.getSigner();
    const contract = getContract(config, signer);
    return contract[method](...args, txOptions);
  }

  const value = {
    config,
    configError,
    account,
    chainId,
    balance,
    role,
    isOwner,
    feeWei,
    error,
    connecting,
    network,
    connect,
    disconnect,
switchToGanache,
      sendContract,
      refreshAccount
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used inside WalletProvider");
  return context;
}
