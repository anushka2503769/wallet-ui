function WalletCard({ wallet }) {
  if (!wallet) return null;

  return (
    <div className="wallet-card card">
      <h3>Main Wallet</h3>

      <div className="wallet-balance">
        ${wallet.balance.toLocaleString()}
      </div>

      <div className="wallet-address">
        {wallet.address}
      </div>

      <div className="wallet-network">
        Network: {wallet.network}
      </div>
    </div>
  );
}

export default WalletCard;