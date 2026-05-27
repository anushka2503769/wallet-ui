import { useState } from 'react';

function TransactionForm({ onSubmit }) {
  const [formData, setFormData] = useState({
    address: '',
    amount: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="transaction-form">
      <div className="form-group">
        <label>Recipient Address</label>

        <input
          type="text"
          name="address"
          value={formData.address}
          onChange={handleChange}
          placeholder="0xABC123..."
        />
      </div>

      <div className="form-group">
        <label>Amount</label>

        <input
          type="number"
          name="amount"
          value={formData.amount}
          onChange={handleChange}
          placeholder="100"
        />
      </div>

      <button type="submit">
        Execute Transaction
      </button>
    </form>
  );
}

export default TransactionForm;
