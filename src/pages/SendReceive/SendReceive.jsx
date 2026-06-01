import { useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { walletService } from '../../services/api/walletService';

function SendReceive() {
  const [formData, setFormData] = useState({
    address: '',
    amount: ''
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await walletService.sendTransaction(formData);
      setResult(response);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      {/* Header section with explicit typography styling */}
      <div className="page-header">
        <h2>Send & Receive</h2>
        <p>Execute blockchain transactions on the TradeFlow testnet.</p>
      </div>

      {/* Two-column layout using global grid system */}
      <div className="grid-2">
        
        {/* Token Sending Card */}
        <div className="card">
          <div className="flex align-center gap-2 mb-6">
            <ArrowUpRight size={20} className="text-accent" />
            <h3>Send Tokens</h3>
          </div>

          <form onSubmit={handleSubmit} className="flex col gap-4">
            <div className="form-group">
              <label className="form-label">Recipient Address</label>
              <input
                type="text"
                name="address"
                className="form-input mono"
                placeholder="0xA13D..."
                value={formData.address}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Amount</label>
              <input
                type="number"
                name="amount"
                className="form-input"
                placeholder="100"
                value={formData.amount}
                onChange={handleChange}
                required
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary btn-full mt-2" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Processing...
                </>
              ) : (
                'Send Transaction'
              )}
            </button>
          </form>
        </div>

        {/* Token Receiving Card */}
        <div className="card">
          <div className="flex align-center gap-2 mb-6">
            <ArrowDownLeft size={20} className="text-accent" />
            <h3>Receive Tokens</h3>
          </div>

          <div className="flex col flex-center gap-4 text-center">
            {/* Kept fallback text placeholder inside your styled card border boundaries */}
            <div className="flex flex-center skeleton" style={{ width: '160px', height: '160px', borderRadius: 'var(--r-lg)' }}>
              <span className="text-muted text-xs">QR CODE</span>
            </div>

            <div className="address-display btn-full">
              <span className="address-text">0x7B3A4CFA9128A8D19B3A</span>
            </div>
            <span className="text-xs text-muted">Share your public address to receive assets</span>
          </div>
        </div>
      </div>

      {/* Transaction Result Sheet */}
      {result && (
        <div className="card card-elevated mt-4">
          <div className="flex align-center gap-2 mb-4">
            <CheckCircle2 size={18} className="text-accent" />
            <h3>Transaction Result</h3>
          </div>

          <div className="grid-3">
            <div className="stat-block">
              <span className="stat-label">Status</span>
              <div>
                <span className="badge badge-success">Confirmed</span>
              </div>
            </div>

            <div className="stat-block">
              <span className="stat-label">Transaction Hash</span>
              <span className="stat-value text-sm font-mono truncate" data-tooltip={result.txHash}>
                {result.txHash}
              </span>
            </div>

            <div className="stat-block">
              <span className="stat-label">Block</span>
              <span className="stat-value text-sm font-mono">{result.block}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SendReceive;