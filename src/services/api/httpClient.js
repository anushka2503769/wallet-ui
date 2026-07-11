import { API_CONFIG } from './config';

async function request(endpoint, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout ?? API_CONFIG.TIMEOUT);

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      },
      signal: controller.signal
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      throw new Error(typeof data === 'string' ? data : data?.message || `${response.status} ${response.statusText}`);
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export function httpGet(endpoint, options = {}) {
  return request(endpoint, {
    method: 'GET',
    ...options
  });
}

export function httpPost(endpoint, payload, options = {}) {
  return request(endpoint, {
    method: 'POST',
    body: JSON.stringify(payload),
    ...options
  });
}
