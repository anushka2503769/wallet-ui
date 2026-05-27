export async function httpGet(endpoint) {
  return fetch(endpoint).then((res) => res.json());
}

export async function httpPost(endpoint, payload) {
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  }).then((res) => res.json());
}
