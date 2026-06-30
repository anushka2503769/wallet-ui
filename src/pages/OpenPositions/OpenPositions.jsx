import { useEffect, useState } from 'react';

function OpenPositions() {

  const [positions,setPositions] = useState([]);

  useEffect(() => {

    fetch('http://127.0.0.1:8080/positions')
      .then(res => res.json())
      .then(data => setPositions(data));

  }, []);

  const closePosition = async (positionId) => {

  await fetch(
    'http://127.0.0.1:8080/tx/submit',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: '',
        contract_code: positionId,
        contract_action: 'CLOSE_POSITION'
      })
    }
  );

  await fetch(
    'http://127.0.0.1:8080/engine/mine',
    {
      method: 'POST'
    }
  );

  window.location.reload();
};

  return (
    <div className="page-container">

      <div className="grid-auto">

        {positions.map(position => (

          <div
            key={position.id}
            className="card"
          >
            <h3>{position.asset}</h3>

            <p>
              {position.position_type}
            </p>

            <p>
              {position.direction}
            </p>

            <p>
              Qty: {position.quantity}
            </p>

            <button
              className="cute-button"
              onClick={() => closePosition(position.id)}
            >
              Close Position
            </button>

          </div>

        ))}

      </div>

    </div>
  );
}

export default OpenPositions;