import { useEffect, useState } from 'react';
import { walletService } from '../services/api/walletService';

const FALLBACK_VALIDATORS = [
  { id: 1, name: 'validator-alpha', stake: 5000 },
  { id: 2, name: 'validator-beta', stake: 3000 },
  { id: 3, name: 'validator-gamma', stake: 2000 }
];

function normalizeBlock(row) {
  return {
    ...row,
    blockNumber: row.blockNumber ?? row.index,
    txCount: row.txCount ?? row.tx_count,
    previous_hash: row.previous_hash ?? row.previousHash,
    nonce: row.nonce ?? 0,
    status: row.status ?? 'CONFIRMED',
    validator: row.validator ?? 'Rust validator'
  };
}

function normalizeTransaction(row) {
  return {
    ...row,
    hash: row.hash ?? row.tx_id,
    type: row.type ?? row.contract_action ?? row.contract_code ?? 'transfer',
    amount: row.amount ?? row.quantity ?? 0,
    status: row.status ?? 'CONFIRMED',
    block: row.block ?? row.block_index
  };
}

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
      walletService.getBlocks(),
      walletService.getTransactions(),
      walletService.getValidators()
    ]);

    setBlocks(blockData.map(normalizeBlock));
    setTransactions(txData.map(normalizeTransaction));
    setValidators(validatorData.length > 0 ? validatorData : FALLBACK_VALIDATORS);

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
