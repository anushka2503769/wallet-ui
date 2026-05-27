import { useEffect, useState } from 'react';
import MockBlockchainProvider from '../services/blockchain/mockBlockchainProvider';

const provider = new MockBlockchainProvider();

function useBlockchain() {
  const [blocks, setBlocks] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [validators, setValidators] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initialize();
  }, []);

  const initialize = async () => {
    setLoading(true);

    const [blockData, txData, validatorData] = await Promise.all([
      provider.getBlocks(),
      provider.getTransactions(),
      provider.getValidators()
    ]);

    setBlocks(blockData);
    setTransactions(txData);
    setValidators(validatorData);

    setLoading(false);
  };

  return {
    blocks,
    transactions,
    validators,
    loading
  };
}

export default useBlockchain;
