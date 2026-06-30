import { useState } from 'react';

function OptionsTrading() {

  const [asset,setAsset] = useState('xGOLD');
  const [quantity,setQuantity] = useState('');
  const [type,setType] = useState('CALL');

  const submitTrade = async () => {

    const tx = {
      id:'',
      contract_code:'CommodityTrading',
      contract_action:'BUY_OPTION',

      trade:{
        asset,
        quantity:Number(quantity),
        direction:type,
      }
    };

    await fetch(
      'http://127.0.0.1:8080/tx/submit',
      {
        method:'POST',
        headers:{
          'Content-Type':'application/json'
        },
        body:JSON.stringify(tx)
      }
    );

    await fetch(
      'http://127.0.0.1:8080/engine/mine',
      {
        method:'POST'
      }
    );

    alert('Options position opened');
  };

  return (
    <div className="page-container">

      <div className="card flex col gap-4">

        <h3>Options Trading</h3>

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
          value={type}
          onChange={(e)=>setType(e.target.value)}
        >
          <option>CALL</option>
          <option>PUT</option>
        </select>

        <input
          className="trading-select"
          type="number"
          placeholder="Quantity"
          value={quantity}
          onChange={(e)=>setQuantity(e.target.value)}
        />

        <button
          className="cute-button"
          onClick={submitTrade}
        >
          Buy Option
        </button>

      </div>

    </div>
  );
}

export default OptionsTrading;