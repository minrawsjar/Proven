// Utility functions for formatting
export const formatUSD = (value) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(value);
};
export const formatNumber = (value, decimals = 2) => {
    return value.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
};
export const formatAddress = (address, chars = 4) => {
    return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
};
export const formatPercentage = (value) => {
    return `${(value * 100).toFixed(2)}%`;
};
export const isValidAddress = (address) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
};
export const sleep = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};
