export const shortenHash = (hash) => {
  if (!hash) return '';

  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
};

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(amount);
};

export const formatNumber = (number) => {
  return new Intl.NumberFormat('en-US').format(number);
};

export const formatPercentage = (value) => {
  return `${Number(value).toFixed(2)}%`;
};

export const formatDate = (date) => {
  return new Date(date).toLocaleString();
};

export const getStatusColor = (status) => {
  switch (status.toUpperCase()) {
    case 'CONFIRMED':
    case 'FINALIZED':
    case 'ONLINE':
    case 'SUCCESS':
      return 'success';

    case 'PENDING':
    case 'SYNCING':
      return 'warning';

    case 'FAILED':
    case 'OFFLINE':
    case 'ERROR':
      return 'danger';

    default:
      return 'default';
  }
};