import { createContext, useContext, useEffect, useState } from 'react';
import { walletService } from '../services/api/walletService';

const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [blocks, setBlocks] = useState([]);

  useEffect(() => {
    initializeWallet();
  }, []);

  const initializeWallet = async () => {
    const walletData = await walletService.getWallet();
    const txData = await walletService.getTransactions();
    const blockData = await walletService.getBlocks();

    setWallet(walletData);
    setTransactions(txData);
    setBlocks(blockData);
  };

  return (
    <WalletContext.Provider
      value={{
        wallet,
        transactions,
        blocks,
        setTransactions,
        setBlocks
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => useContext(WalletContext);