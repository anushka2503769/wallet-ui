class BlockchainProvider {
  async getBlocks() {
    return [];
  }

  async getTransactions() {
    return [];
  }

  async sendTransaction(payload) {
    return payload;
  }

  async getValidators() {
    return [];
  }

  async getNetworkStatus() {
    return {
      status: 'ONLINE'
    };
  }
}

export default BlockchainProvider;
