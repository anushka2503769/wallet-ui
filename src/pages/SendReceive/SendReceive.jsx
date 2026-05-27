import { useState } from 'react';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';
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
    <div className="send-receive-page">
      <div className="page-header">
        <div>
          <h2>Send & Receive</h2>
          <p>Execute blockchain transactions on the TradeFlow testnet.</p>
        </div>
      </div>

      <div className="send-grid">
        <div className="card send-card">
          <div className="send-header">
            <ArrowUpRight size={20} />
            <h3>Send Tokens</h3>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Recipient Address</label>

              <input
                type="text"
                name="address"
                placeholder="0xA13D..."
                value={formData.address}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Amount</label>

              <input
                type="number"
                name="amount"
                placeholder="100"
                value={formData.amount}
                onChange={handleChange}
              />
            </div>

            <button type="submit" disabled={loading}>
              {loading ? 'Processing...' : 'Send Transaction'}
            </button>
          </form>
        </div>

        <div className="card receive-card">
          <div className="send-header">
            <ArrowDownLeft size={20} />
            <h3>Receive Tokens</h3>
          </div>

          <div className="receive-box">
            <div className="qr-placeholder">
              QR CODE
            </div>

            <div className="wallet-address-box">
              0x7B3A4CFA9128A8D19B3A
            </div>
          </div>
        </div>
      </div>

      {result && (
        <div className="card result-card">
          <h3>Transaction Result</h3>

          <div className="result-grid">
            <div>
              <strong>Status</strong>
              <p>Confirmed</p>
            </div>

            <div>
              <strong>Transaction Hash</strong>
              <p>{result.txHash}</p>
            </div>

            <div>
              <strong>Block</strong>
              <p>{result.block}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SendReceive;