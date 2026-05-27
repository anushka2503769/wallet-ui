import mockBlocks from '../../data/mockBlocks.json';
import mockTransactions from '../../data/mockTransactions.json';

class MockBlockchainProvider {
  async getBlocks() {
    return mockBlocks;
  }

  async getTransactions() {
    return mockTransactions;
  }

  async sendTransaction(payload) {
    return {
      success: true,
      hash: '0xSIMULATEDHASH',
      payload
    };
  }

  async getValidators() {
    return [
      {
        id: 1,
        name: 'validator-alpha'
      },
      {
        id: 2,
        name: 'validator-beta'
      }
    ];
  }
}

export default MockBlockchainProvider;
