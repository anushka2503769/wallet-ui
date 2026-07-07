function WalletCard({ wallet }) {
  if (!wallet) return null;

  const balance = Number.isFinite(wallet.balance) ? wallet.balance : 0;

  return (
    <div className="wallet-card card">
      <h3>Main Wallet</h3>

      <div className="wallet-balance">
        ${balance.toLocaleString()}
      </div>

      <div className="wallet-address">
        {wallet.address ?? 'Connected to rust-blockchain'}
      </div>

      <div className="wallet-network">
        Network: {wallet.network ?? 'Rust Blockchain Testnet'}
      </div>
    </div>
  );
}

export default WalletCard;