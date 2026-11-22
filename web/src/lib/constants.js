import { CsWallet } from '@coinspace/cs-common';

export const BITCOIN_FAMILY = [
  'bitcoin',
  'bitcoin-cash',
  'litecoin',
  'dash',
  'dogecoin',
  'zcash',
];

export const EVM_FAMILY = [
  'ethereum',
  'ethereum-classic',
  'polygon',
  'avalanche-c-chain',
  'binance-smart-chain',
  'arbitrum',
  'optimism',
  'fantom',
  'base',
  'sonic',
];

export const SUPPORTED_PLATFORMS = [
  ...BITCOIN_FAMILY,
  ...EVM_FAMILY,
  'ripple',
  'stellar',
  'monero',
  'eos',
  'solana',
  'tron',
  'cardano',
  'toncoin',
  'sui',
  'kaspa',
];

export const TOKEN_PLATFORMS = [
  'arbitrum',
  'avalanche-c-chain',
  'base',
  'binance-smart-chain',
  'ethereum',
  'fantom',
  'optimism',
  'polygon',
  'solana',
  'sonic',
  'sui',
  'toncoin',
  'tron',
];

export async function loadWalletModule(platform) {
  if (BITCOIN_FAMILY.includes(platform)) {
    return (await import('@coinspace/cs-bitcoin-wallet')).default;
  }
  if (['solana'].includes(platform)) {
    return (await import('@coinspace/cs-solana-wallet')).default;
  }
  if (['monero'].includes(platform)) {
    return (await import('@coinspace/cs-monero-wallet')).default;
  }
  if (['tron'].includes(platform)) {
    return (await import('@coinspace/cs-tron-wallet')).default;
  }
  if (['cardano'].includes(platform)) {
    return (await import('@coinspace/cs-cardano-wallet')).default;
  }
  if (['ripple'].includes(platform)) {
    return (await import('@coinspace/cs-ripple-wallet')).default;
  }
  if (['stellar'].includes(platform)) {
    return (await import('@coinspace/cs-stellar-wallet')).default;
  }
  if (['eos'].includes(platform)) {
    return (await import('@coinspace/cs-eos-wallet')).default;
  }
  if (EVM_FAMILY.includes(platform)) {
    return (await import('@coinspace/cs-evm-wallet')).default;
  }
  if (['toncoin'].includes(platform)) {
    return (await import('@coinspace/cs-toncoin-wallet')).default;
  }
  if (['sui'].includes(platform)) {
    return (await import('@coinspace/cs-sui-wallet')).default;
  }
  if (['kaspa'].includes(platform)) {
    return (await import('@coinspace/cs-kaspa-wallet')).default;
  }
  // fallback
  return CsWallet;
}

function getOriginBaseURL() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/`;
  }
  return '/';
}

function getPlatformNodeURL(envUrl, platform) {
  return envUrl || `${getOriginBaseURL()}api/node/${platform}/`;
}

export function getApiNode(platform, isOnion) {
  switch (platform) {
    // Bitcoin-like
    case 'bitcoin':
      return getPlatformNodeURL(isOnion ? import.meta.env.VITE_API_BTC_URL_TOR : import.meta.env.VITE_API_BTC_URL, platform);
    case 'bitcoin-cash':
      return getPlatformNodeURL(isOnion ? import.meta.env.VITE_API_BCH_URL_TOR : import.meta.env.VITE_API_BCH_URL, platform);
    case 'dash':
      return getPlatformNodeURL(isOnion ? import.meta.env.VITE_API_DASH_URL_TOR : import.meta.env.VITE_API_DASH_URL, platform);
    case 'dogecoin':
      return getPlatformNodeURL(isOnion ? import.meta.env.VITE_API_DOGE_URL_TOR : import.meta.env.VITE_API_DOGE_URL, platform);
    case 'litecoin':
      return getPlatformNodeURL(isOnion ? import.meta.env.VITE_API_LTC_URL_TOR : import.meta.env.VITE_API_LTC_URL, platform);
    case 'zcash':
      return getPlatformNodeURL(isOnion ? import.meta.env.VITE_API_ZEC_URL_TOR : import.meta.env.VITE_API_ZEC_URL, platform);
    // Ethereum-like
    case 'ethereum':
      return getPlatformNodeURL(isOnion ? import.meta.env.VITE_API_ETH_URL_TOR : import.meta.env.VITE_API_ETH_URL, platform);
    case 'ethereum-classic':
      return getPlatformNodeURL(isOnion ? import.meta.env.VITE_API_ETC_URL_TOR : import.meta.env.VITE_API_ETC_URL, platform);
    case 'binance-smart-chain':
      return getPlatformNodeURL(isOnion ? import.meta.env.VITE_API_BSC_URL_TOR : import.meta.env.VITE_API_BSC_URL, platform);
    case 'polygon':
      return getPlatformNodeURL(isOnion ? import.meta.env.VITE_API_POLYGON_URL_TOR : import.meta.env.VITE_API_POLYGON_URL, platform);
    case 'avalanche-c-chain':
      return getPlatformNodeURL(isOnion ? import.meta.env.VITE_API_AVAX_URL_TOR : import.meta.env.VITE_API_AVAX_URL, platform);
    case 'arbitrum':
      return getPlatformNodeURL(isOnion ? import.meta.env.VITE_API_ARB_URL_TOR : import.meta.env.VITE_API_ARB_URL, platform);
    case 'optimism':
      return getPlatformNodeURL(isOnion ? import.meta.env.VITE_API_OP_URL_TOR : import.meta.env.VITE_API_OP_URL, platform);
    case 'fantom':
      return getPlatformNodeURL(isOnion ? import.meta.env.VITE_API_FTM_URL_TOR : import.meta.env.VITE_API_FTM_URL, platform);
    case 'base':
      return getPlatformNodeURL(isOnion ? import.meta.env.VITE_API_BASE_URL_TOR : import.meta.env.VITE_API_BASE_URL, platform);
    case 'sonic':
      return getPlatformNodeURL(isOnion ? import.meta.env.VITE_API_SONIC_URL_TOR : import.meta.env.VITE_API_SONIC_URL, platform);
    // Ripple-like
    case 'ripple':
      return getPlatformNodeURL(isOnion ? import.meta.env.VITE_API_XRP_URL_TOR : import.meta.env.VITE_API_XRP_URL, platform);
    case 'stellar':
      return getPlatformNodeURL(isOnion ? import.meta.env.VITE_API_XLM_URL_TOR : import.meta.env.VITE_API_XLM_URL, platform);
    // Others
    case 'monero':
      return getPlatformNodeURL(isOnion ? import.meta.env.VITE_API_XMR_URL_TOR : import.meta.env.VITE_API_XMR_URL, platform);
    case 'eos':
      return getPlatformNodeURL(isOnion ? import.meta.env.VITE_API_EOS_URL_TOR : import.meta.env.VITE_API_EOS_URL, platform);
    case 'solana':
      return getPlatformNodeURL(isOnion ? import.meta.env.VITE_API_SOL_URL_TOR : import.meta.env.VITE_API_SOL_URL, platform);
    case 'tron':
      return getPlatformNodeURL(isOnion ? import.meta.env.VITE_API_TRX_URL_TOR : import.meta.env.VITE_API_TRX_URL, platform);
    case 'cardano':
      return getPlatformNodeURL(isOnion ? import.meta.env.VITE_API_ADA_URL_TOR : import.meta.env.VITE_API_ADA_URL, platform);
    case 'toncoin':
      return getPlatformNodeURL(isOnion ? import.meta.env.VITE_API_TON_URL_TOR : import.meta.env.VITE_API_TON_URL, platform);
    case 'sui':
      return getPlatformNodeURL(isOnion ? import.meta.env.VITE_API_SUI_URL_TOR : import.meta.env.VITE_API_SUI_URL, platform);
    case 'kaspa':
      return getPlatformNodeURL(isOnion ? import.meta.env.VITE_API_KAS_URL_TOR : import.meta.env.VITE_API_KAS_URL, platform);
    default:
      // fallback
      return `${getOriginBaseURL()}api/node/unsupported/`;
  }
}

export function getBaseURL(service, isOnion) {
  switch (service) {
    case 'price':
      return (isOnion ? import.meta.env.VITE_API_PRICE_URL_TOR : import.meta.env.VITE_API_PRICE_URL) || getOriginBaseURL();
    case 'ramp':
      return (isOnion ? import.meta.env.VITE_API_RAMP_URL_TOR : import.meta.env.VITE_API_RAMP_URL) || getOriginBaseURL();
    case 'swap':
      return (isOnion ? import.meta.env.VITE_API_SWAP_URL_TOR : import.meta.env.VITE_API_SWAP_URL) || getOriginBaseURL();
    case 'card':
      return (isOnion ? import.meta.env.VITE_API_CARD_URL_TOR : import.meta.env.VITE_API_CARD_URL) || getOriginBaseURL();
    default:
      return getOriginBaseURL();
  }
}
