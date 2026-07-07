import { createContext, useContext, useEffect, useState } from 'react';
import { walletService } from '../services/api/walletService';

const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    initializeWallet();
  }, []);

  const initializeWallet = async () => {
    setLoading(true);
    setError(null);

    try {
      const [walletData, txData, blockData] = await Promise.all([
        walletService.getWallet(),
        walletService.getTransactions(),
        walletService.getBlocks()
      ]);

      setWallet(walletData);
      setTransactions(txData);
      setBlocks(blockData);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <WalletContext.Provider
      value={{
        wallet,
        transactions,
        blocks,
        loading,
        error,
        refreshWallet: initializeWallet,
        setTransactions,
        setBlocks
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => useContext(WalletContext);