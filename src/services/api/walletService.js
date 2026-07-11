import mockTransactions from '../../data/mockTransactions.json';
import mockPortfolio from '../../data/mockPortfolio.json';
import mockBlocks from '../../data/mockBlocks.json';
import { API_CONFIG } from './config';
import { httpGet, httpPost } from './httpClient';

const BASE_URL = API_CONFIG.BASE_URL;

const FALLBACK_VALIDATORS = [
  { id: 1, name: 'validator-alpha', stake: 5000 },
  { id: 2, name: 'validator-beta', stake: 3000 },
  { id: 3, name: 'validator-gamma', stake: 2000 }
];

function normalizeRows(rows) {
  return Array.isArray(rows) ? rows : [];
}

function mapBlocks(rows) {
  return normalizeRows(rows)
    .map((row) => ({
      ...row,
      blockNumber: row.blockNumber ?? row.index,
      txCount: row.txCount ?? row.tx_count,
      previous_hash: row.previous_hash ?? row.previousHash,
      nonce: row.nonce ?? 0,
      status: row.status ?? 'CONFIRMED',
      validator: row.validator ?? 'Rust validator'
    }))
    .sort((left, right) => (right.blockNumber ?? 0) - (left.blockNumber ?? 0));
}

function mapTransactions(rows) {
  return normalizeRows(rows)
    .map((row) => ({
      ...row,
      hash: row.hash ?? row.tx_id,
      type: row.type ?? row.contract_action ?? row.contract_code ?? 'transfer',
      amount: row.amount ?? row.quantity ?? 0,
      status: row.status ?? 'CONFIRMED',
      block: row.block ?? row.block_index
    }))
    .sort((left, right) => (right.block ?? 0) - (left.block ?? 0));
}

async function safeCall(operation, fallback) {
  try {
    return await operation();
  } catch {
    return fallback;
  }
}

async function queryTable(tableName) {
  const rows = await httpPost(`${BASE_URL}/sql`, {
    sql: `SELECT * FROM ${tableName}`
  });

  return normalizeRows(rows);
}

export const walletService = {
  async getWallet() {
    const wallet = await safeCall(
      () => httpGet(`${BASE_URL}/wallet`),
      { balance: 0 }
    );

    return {
      ...wallet,
      network: API_CONFIG.NETWORK,
      address: wallet.address ?? 'Rust blockchain wallet'
    };
  },

  async getPortfolio() {
    const [wallet, transactions] = await Promise.all([
      this.getWallet(),
      this.getTransactions()
    ]);

    return {
      totalValue: wallet.balance,
      assets: transactions.map((tx, index) => ({
        name: tx.type ?? `Asset ${index + 1}`,
        holdings: tx.amount ?? 0,
        value: Number(tx.amount ?? 0)
      })),
      stakedValue: 0,
      monthlyGrowth: 0
    };
  },

  async getTransactions() {
    const rows = await safeCall(
      () => queryTable('transactions'),
      mockTransactions
    );

    const mapped = mapTransactions(rows);
    return mapped.length > 0 ? mapped : mapTransactions(mockTransactions);
  },

  async getBlocks() {
    const rows = await safeCall(
      () => queryTable('blocks'),
      mockBlocks
    );

    const mapped = mapBlocks(rows);
    return mapped.length > 0 ? mapped : mapBlocks(mockBlocks);
  },

  async getValidators() {
    const status = await safeCall(
      () => httpGet(`${BASE_URL}/consensus/status`),
      null
    );

    if (status?.engine?.toLowerCase?.() === 'proof of stake' || status?.engine?.toLowerCase?.() === 'pos') {
      return FALLBACK_VALIDATORS;
    }

    return [];
  },

  async getConsensusStatus() {
    return safeCall(
      () => httpGet(`${BASE_URL}/consensus/status`),
      { engine: 'unknown', active: false }
    );
  },

  async sendTransaction(payload) {
    const submitted = await httpPost(`${BASE_URL}/tx/submit`, {
      id: '',
      contract_code: payload.address || 'transfer',
      contract_action: `send:${payload.amount ?? 0}`,
      trade: {
        asset: 'TFC',
        quantity: Number(payload.amount ?? 0),
        direction: 'send',
        leverage: null
      }
    });

    const minedBlock = await httpPost(`${BASE_URL}/engine/mine`, {});

    return {
      success: true,
      txHash: submitted.id,
      block: minedBlock.index,
      payload
    };
  },

  async stakeTokens(amount) {
    const submitted = await httpPost(`${BASE_URL}/tx/submit`, {
      id: '',
      contract_code: 'stake',
      contract_action: `stake:${amount}`,
      trade: {
        asset: 'TFC',
        quantity: Number(amount ?? 0),
        direction: 'stake',
        leverage: null
      }
    });

    const minedBlock = await httpPost(`${BASE_URL}/engine/mine`, {});

    return {
      success: true,
      amount,
      validator: 'validator-alpha',
      txHash: submitted.id,
      block: minedBlock.index
    };
  }
};