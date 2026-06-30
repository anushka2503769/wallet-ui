import { useEffect, useState } from 'react';

function Markets() {

  const [markets, setMarkets] = useState([]);

  useEffect(() => {

    fetch('http://127.0.0.1:8080/markets')
      .then(res => res.json())
      .then(data => setMarkets(data))
      .catch(console.error);

  }, []);

  const [wallet, setWallet] = useState(null);

  useEffect(() => {

    fetch('http://127.0.0.1:8080/wallet')
      .then(res => res.json())
      .then(setWallet);

  }, []);

  return (
    <div className="page-container">
      <h1>
        Wallet Balance:
        ${wallet ? wallet.balance.toFixed(2) : 'Loading...'}
      </h1>

      <div className="grid-auto">

        {markets.map((market) => (

          <div
            key={market.symbol}
            className="card"
          >
            <h3>{market.symbol}</h3>

            <div className="stat-block">
              <span className="stat-label">
                Price
              </span>

              <span className="stat-value">
                ${market.price}
              </span>
            </div>

          </div>

        ))}

      </div>

    </div>
  );
}

export default Markets;