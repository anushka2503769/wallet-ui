import mockTransactions from '../../data/mockTransactions.json';
import mockPortfolio from '../../data/mockPortfolio.json';
import mockBlocks from '../../data/mockBlocks.json';

const delay = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const walletService = {
  async getPortfolio() {
    await delay(500);

    return mockPortfolio;
  },

  async getTransactions() {
    await delay(500);

    return mockTransactions;
  },

  async getBlocks() {
    await delay(500);

    return mockBlocks;
  },

  async sendTransaction(payload) {
    await delay(1200);

    return {
      success: true,
      txHash: '0xSIMULATEDHASH12345',
      block: 12048,
      payload
    };
  },

  async stakeTokens(amount) {
    await delay(1500);

    return {
      success: true,
      amount,
      validator: 'validator-alpha'
    };
  }
};