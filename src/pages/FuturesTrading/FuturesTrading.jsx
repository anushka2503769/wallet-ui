import { useState } from 'react';

function FuturesTrading() {

  const [asset, setAsset] = useState('xGOLD');
  const [quantity, setQuantity] = useState('');
  const [direction, setDirection] = useState('LONG');
  const [leverage, setLeverage] = useState(1);


  const submitTrade = async () => {

    const tx = {
      id: '',
      contract_code: 'CommodityTrading',
      contract_action: 'OPEN_FUTURES',

      trade: {
        asset,
        quantity: Number(quantity),
        direction: direction,
        leverage: Number(leverage),
      }
    };

    await fetch(
      'http://127.0.0.1:8080/tx/submit',
      {
        method: 'POST',
        headers: {
          'Content-Type':'application/json'
        },
        body: JSON.stringify(tx)
      }
    );

    await fetch(
      'http://127.0.0.1:8080/engine/mine',
      {
        method:'POST'
      }
    );

    alert('Futures position opened');
  };

  return (
    <div className="page-container">

      <div className="card flex col gap-4">

        <h3>Futures Trading</h3>

        <select
          className="trading-select"
          value={asset}
          onChange={(e)=>setAsset(e.target.value)}
        >
          <option>xGOLD</option>
          <option>xSILVER</option>
          <option>xOIL</option>
        </select>

        <select
          className="trading-select"
          value={leverage}
          onChange={(e)=>setLeverage(Number(e.target.value))}
        >
          <option value={1}>1x</option>
          <option value={5}>5x</option>
          <option value={10}>10x</option>
          <option value={20}>20x</option>
        </select>

        <input
          className="trading-select"
          type="number"
          placeholder="Quantity"
          value={quantity}
          onChange={(e)=>setQuantity(e.target.value)}
        />

        <div className="flex gap-4">
          <button
            className="cute-button btn-full"
            onClick={() => submitTrade('LONG')}
          >
            Open Long
          </button>

          <button
            className="cute-button btn-full"
            onClick={() => submitTrade('SHORT')}
          >
            Open Short
          </button>

        </div>

      </div>

    </div>
  );
}

export default FuturesTrading;