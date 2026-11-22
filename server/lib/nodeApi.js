import axios from 'axios';
import express from 'express';

const router = express.Router({ mergeParams: true });

const EVM_RPCS = {
  ethereum: 'https://ethereum-rpc.publicnode.com',
  'binance-smart-chain': 'https://bsc-rpc.publicnode.com',
  polygon: 'https://polygon-bor-rpc.publicnode.com',
  arbitrum: 'https://arbitrum-one-rpc.publicnode.com',
  optimism: 'https://optimism-rpc.publicnode.com',
  'avalanche-c-chain': 'https://avalanche-c-chain-rpc.publicnode.com',
  base: 'https://base-rpc.publicnode.com',
  fantom: 'https://fantom-rpc.publicnode.com',
  sonic: 'https://rpc.soniclabs.com',
};

async function evmRpc(platform, method, params = []) {
  const rpcUrl = EVM_RPCS[platform];
  if (!rpcUrl) return null;
  try {
    const { data } = await axios.post(
      rpcUrl,
      { jsonrpc: '2.0', id: 1, method, params },
      { timeout: 2500 }
    );
    return data?.result ?? null;
  } catch {
    return null;
  }
}

// Bitcoin-like endpoints
router.get('/api/v1/addrs/:addresses', (req, res) => {
  const addresses = (req.params.addresses || '').split(',').map((a) => a.trim()).filter(Boolean);
  res.json(addresses.map((addrStr) => ({
    addrStr,
    balance: 0,
    unconfirmedBalance: 0,
    txApperances: 0,
    unconfirmedTxApperances: 0,
    transactions: [],
  })));
});

router.get('/api/v1/addrs/:addresses/utxo', (req, res) => {
  res.json([]);
});

router.get('/api/v1/txs/:ids/confirmations', (req, res) => {
  res.json([]);
});

router.get('/api/v1/txs/:ids', (req, res) => {
  res.json([]);
});

router.get('/api/v1/fees', (req, res) => {
  res.json({ marginalFee: '5000' });
});

router.get('/api/v1/consensus', (req, res) => {
  res.json({ branchId: '0xc2d6d0b4' });
});

// EVM endpoints
router.get('/api/v1/addr/:address/balance', async (req, res) => {
  const platform = req.params.platform;
  const address = req.params.address;
  const hexBal = await evmRpc(platform, 'eth_getBalance', [address, 'latest']);
  const balance = hexBal ? BigInt(hexBal).toString() : '0';
  res.json({ balance, confirmedBalance: balance });
});

router.get('/api/v1/token/:token/:address/balance', async (req, res) => {
  const { platform, token, address } = req.params;
  let balance = '0';
  if (/^0x[a-fA-F0-9]{40}$/.test(token) && /^0x[a-fA-F0-9]{40}$/.test(address)) {
    const padded = address.slice(2).toLowerCase().padStart(64, '0');
    const hexBal = await evmRpc(platform, 'eth_call', [{ to: token, data: `0x70a08231${padded}` }, 'latest']);
    if (hexBal && hexBal !== '0x') {
      try {
        balance = BigInt(hexBal).toString();
      } catch { /* fallback 0 */ }
    }
  }
  res.json({ balance, confirmedBalance: balance });
});

router.get('/api/v1/addr/:address/txs', (req, res) => {
  res.json({ txs: [], limit: 10 });
});

router.get('/api/v1/token/:token/:address/txs', (req, res) => {
  res.json({ txs: [], limit: 10 });
});

router.get('/api/v1/addr/:address/txsCount', async (req, res) => {
  const { platform, address } = req.params;
  const hexCount = await evmRpc(platform, 'eth_getTransactionCount', [address, 'latest']);
  const count = hexCount ? Number(BigInt(hexCount)) : 0;
  res.json({ count });
});

router.get('/api/v1/gasPrice', async (req, res) => {
  const platform = req.params.platform;
  if (platform === 'sui') {
    return res.json({ price: '1000' });
  }
  const hexPrice = await evmRpc(platform, 'eth_gasPrice');
  const price = hexPrice ? BigInt(hexPrice).toString() : '1000000000';
  res.json({ price });
});

router.get('/api/v1/gasFees', async (req, res) => {
  const hexPrice = await evmRpc(req.params.platform, 'eth_gasPrice');
  const base = hexPrice ? BigInt(hexPrice) : 1000000000n;
  const priority = 1000000000n;
  res.json({
    maxFeePerGas: (base * 2n + priority).toString(),
    maxPriorityFeePerGas: priority.toString(),
  });
});

router.get('/api/v1/estimateAdditionalFee', (req, res) => {
  res.json('0');
});

router.get('/api/v1/addr/:address/staking', (req, res) => {
  res.json({
    staked: '0',
    apr: 0,
    minStakeAmount: '100000000000000000',
    activationPeriod: 0,
    unstakingPeriod: 0,
  });
});

router.get('/api/v1/addr/:address/pendingRequests', (req, res) => {
  res.json({ staking: '0', unstaking: '0', readyForClaim: '0' });
});

// Solana endpoints
router.get('/api/v2/account/:account/info', (req, res) => {
  res.json({ exists: false, balance: '0' });
});

router.get('/api/v2/token/:token/:account/info', (req, res) => {
  res.json({ exists: false, balance: '0' });
});

router.get('/api/v2/account/:account/transactions', (req, res) => {
  res.json([]);
});

router.get('/api/v2/latestBlockhash', (req, res) => {
  res.json({ blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 0 });
});

router.get('/api/v2/minimumBalanceForRentExemptAccount', (req, res) => {
  res.json({ rent: '890880' });
});

// Ripple & Stellar endpoints
router.get('/api/v1/account/:address', (req, res) => {
  if (req.params.platform === 'tron') {
    return res.json({ balance: 0 });
  }
  res.json({ sequence: '0', balance: '0', isActive: false });
});

router.get('/api/v1/account/:address/txs', (req, res) => {
  res.json({ txs: [], limit: 10 });
});

router.get('/api/v1/fee', (req, res) => {
  res.json({ fee: req.params.platform === 'stellar' ? '100' : '10' });
});

router.get('/api/v1/ledgerVersion', (req, res) => {
  res.json({ maxLedgerVersion: 0 });
});

// Tron endpoints
router.get('/api/v1/account/:address/balance', (req, res) => {
  res.json({ balance: '0' });
});

router.get('/api/v1/account/:address/trc20/:token/balance', (req, res) => {
  res.json({ balance: '0' });
});

router.get('/api/v1/account/:address/transactions', (req, res) => {
  res.json({ data: [], meta: {} });
});

router.get('/api/v1/account/:address/trc20/:token/transactions', (req, res) => {
  res.json({ data: [], meta: {} });
});

router.get('/api/v1/account/:address/resources', (req, res) => {
  res.json({});
});

router.get('/api/v1/latestblock', (req, res) => {
  res.json({
    blockID: '0',
    block_header: {
      raw_data: {
        number: 0,
        txTrieRoot: '0',
        witness_address: '0',
        parentHash: '0',
        version: 0,
        timestamp: 0,
      },
    },
  });
});

router.get('/api/v1/chainparameters', (req, res) => {
  res.json([]);
});

// Toncoin endpoints
router.get('/api/v1/getWalletInformation', (req, res) => {
  res.json({ ok: true, result: { balance: '0', account_state: 'uninitialized', seqno: 0 } });
});

router.get('/api/v1/getJettonWalletAddress', (req, res) => {
  res.json({ ok: true, result: { address: '' } });
});

router.get('/api/v1/getJettonData', (req, res) => {
  res.json({ ok: true, result: { balance: '0' } });
});

router.get('/api/v1/getTransactions', (req, res) => {
  res.json({ ok: true, result: [] });
});

// Cardano endpoints
router.get('/api/v1/parameters', (req, res) => {
  res.json({ min_fee_a: 44, min_fee_b: 155381, coins_per_utxo_size: '4310' });
});

router.get('/api/v1/addresses/:address/utxos', (req, res) => {
  res.json([]);
});

router.get('/api/v1/addresses/:address/transactions', (req, res) => {
  if (req.params.platform === 'kaspa') {
    return res.json([]);
  }
  res.json([]);
});

// Sui endpoints
router.get('/api/v1/token/:token/:address/objects', (req, res) => {
  res.json({ data: [], hasNextPage: false, nextCursor: null });
});

router.get('/api/v1/address/:address/transactions', (req, res) => {
  res.json({ data: [], hasNextPage: false, nextCursor: null });
});

// Kaspa endpoints
router.get('/api/v1/addresses/:addresses/active', (req, res) => {
  res.json([]);
});

router.get('/api/v1/info/feerates', (req, res) => {
  res.json([
    { name: 'minimum', value: '1' },
    { name: 'default', value: '1' },
    { name: 'fastest', value: '2' },
  ]);
});

router.all('*', (req, res) => {
  res.status(501).json({ error: `Node operation not configured for ${req.params.platform}` });
});

export default router;
