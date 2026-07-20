import { useEffect, useState } from 'react';

const NODE_URL = `http://${window.location.hostname}:8080`;

function sortMarkets(markets) {
  return [...markets].sort((left, right) => left.symbol.localeCompare(right.symbol));
}

export function useCommodityFeed() {
  const [markets, setMarkets] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const applyMarket = (entry) => {
      if (cancelled) return;

      setMarkets((prev) => {
        const next = [...prev];
        const index = next.findIndex((market) => market.symbol === entry.symbol);

        if (index === -1) next.push(entry);
        else next[index] = entry;

        return sortMarkets(next);
      });
    };

    fetch(`${NODE_URL}/markets`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setMarkets(sortMarkets(Array.isArray(data) ? data : []));
      })
      .catch(console.error);

    const source = new EventSource(`${NODE_URL}/markets/stream`);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (event) => {
      try {
        applyMarket(JSON.parse(event.data));
      } catch (error) {
        console.error('Failed to parse commodity update', error);
      }
    };

    return () => {
      cancelled = true;
      source.close();
    };
  }, []);

  return { markets, connected, nodeUrl: NODE_URL };
}