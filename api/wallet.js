// /api/wallet.js — Vercel Serverless Function
// 查詢真實區塊鏈錢包資料（餘額、交易數、代幣等）
// 支援 ETH (Etherscan)、TRON (TronScan)、BTC (Blockchain.info)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { address, chain } = req.query;
  if (!address || !chain) {
    return res.status(400).json({ error: 'Missing address or chain parameter' });
  }

  try {
    let result;
    switch (chain.toUpperCase()) {
      case 'ETH':
        result = await lookupETH(address);
        break;
      case 'TRON':
        result = await lookupTRON(address);
        break;
      case 'BTC':
        result = await lookupBTC(address);
        break;
      default:
        return res.status(400).json({ error: `Unsupported chain: ${chain}` });
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error(`Wallet lookup error [${chain}/${address}]:`, err);
    return res.status(500).json({ error: err.message, chain, address });
  }
}

// ── Ethereum (Etherscan API) ──
async function lookupETH(address) {
  const apiKey = process.env.ETHERSCAN_API_KEY || '';
  const base = 'https://api.etherscan.io/api';

  // Parallel requests: balance, tx count, ERC20 tokens
  const [balRes, txListRes, tokenTxRes] = await Promise.all([
    fetch(`${base}?module=account&action=balance&address=${address}&tag=latest&apikey=${apiKey}`),
    fetch(`${base}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc&apikey=${apiKey}`),
    fetch(`${base}?module=account&action=tokentx&address=${address}&page=1&offset=20&sort=desc&apikey=${apiKey}`),
  ]);

  const balData = await balRes.json();
  const txListData = await txListRes.json();
  const tokenTxData = await tokenTxRes.json();

  // Balance in ETH
  const balanceWei = balData.result || '0';
  const balanceETH = (parseInt(balanceWei) / 1e18).toFixed(6);

  // First transaction date
  let firstSeen = '—';
  if (txListData.result && txListData.result.length > 0 && txListData.result[0].timeStamp) {
    firstSeen = new Date(parseInt(txListData.result[0].timeStamp) * 1000).toISOString().split('T')[0];
  }

  // Get tx count
  const txCountRes = await fetch(`${base}?module=proxy&action=eth_getTransactionCount&address=${address}&tag=latest&apikey=${apiKey}`);
  const txCountData = await txCountRes.json();
  const txCount = parseInt(txCountData.result || '0', 16);

  // Token balances from recent transfers
  const tokenMap = {};
  if (Array.isArray(tokenTxData.result)) {
    for (const tx of tokenTxData.result) {
      const sym = tx.tokenSymbol || tx.tokenName || 'Unknown';
      if (!tokenMap[sym]) {
        tokenMap[sym] = { token: sym, contract: tx.contractAddress, decimals: parseInt(tx.tokenDecimal || '18') };
      }
    }
  }

  // Fetch actual token balances for discovered tokens
  const tokenBalances = [];
  const importantTokens = Object.values(tokenMap).slice(0, 8);
  for (const t of importantTokens) {
    try {
      const tbRes = await fetch(`${base}?module=account&action=tokenbalance&contractaddress=${t.contract}&address=${address}&tag=latest&apikey=${apiKey}`);
      const tbData = await tbRes.json();
      const rawBal = tbData.result || '0';
      const bal = (parseInt(rawBal) / Math.pow(10, t.decimals)).toFixed(4);
      if (parseFloat(bal) > 0) {
        tokenBalances.push({ token: t.token, balance: bal });
      }
    } catch { /* skip failed token lookups */ }
  }

  // Get latest tx for last_seen
  const latestTxRes = await fetch(`${base}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=1&sort=desc&apikey=${apiKey}`);
  const latestTxData = await latestTxRes.json();
  let lastSeen = '—';
  if (latestTxData.result && latestTxData.result.length > 0 && latestTxData.result[0].timeStamp) {
    lastSeen = new Date(parseInt(latestTxData.result[0].timeStamp) * 1000).toISOString().split('T')[0];
  }

  // Check address label (Etherscan doesn't provide this in free API, use heuristic)
  let label = '無';
  let risk = '未知';

  return {
    chain: 'ETH',
    address,
    balance: `${balanceETH} ETH`,
    token_balances: tokenBalances,
    total_transactions: String(txCount),
    first_seen: firstSeen,
    last_seen: lastSeen,
    label,
    risk,
    explorer_url: `https://etherscan.io/address/${address}`,
  };
}

// ── TRON (TronScan API) ──
async function lookupTRON(address) {
  const base = 'https://apilist.tronscanapi.com/api';

  const accRes = await fetch(`${base}/accountv2?address=${address}`, {
    headers: { 'TRON-PRO-API-KEY': process.env.TRONSCAN_API_KEY || '' },
  });
  const accData = await accRes.json();

  // Balance
  const balanceSun = accData.balance || 0;
  const balanceTRX = (balanceSun / 1e6).toFixed(2);

  // Token balances (TRC20)
  const tokenBalances = [];
  if (accData.withPriceTokens && Array.isArray(accData.withPriceTokens)) {
    for (const t of accData.withPriceTokens) {
      if (t.tokenAbbr && parseFloat(t.balance || '0') > 0) {
        const decimals = parseInt(t.tokenDecimal || '6');
        const bal = (parseFloat(t.balance) / Math.pow(10, decimals)).toFixed(4);
        if (parseFloat(bal) > 0) {
          tokenBalances.push({ token: t.tokenAbbr, balance: bal });
        }
      }
    }
  }
  // Also check trc20token_balances
  if (accData.trc20token_balances && Array.isArray(accData.trc20token_balances)) {
    for (const t of accData.trc20token_balances) {
      const sym = t.tokenAbbr || t.tokenName || 'TRC20';
      const decimals = parseInt(t.tokenDecimal || '6');
      const bal = (parseFloat(t.balance || '0') / Math.pow(10, decimals)).toFixed(4);
      if (parseFloat(bal) > 0 && !tokenBalances.find(x => x.token === sym)) {
        tokenBalances.push({ token: sym, balance: bal });
      }
    }
  }

  const txCount = accData.totalTransactionCount || accData.transactions || '—';
  const created = accData.date_created || accData.create_time;
  const firstSeen = created ? new Date(created).toISOString().split('T')[0] : '—';
  const latest = accData.latest_operation_time || accData.latestOperationTime;
  const lastSeen = latest ? new Date(latest).toISOString().split('T')[0] : '—';

  return {
    chain: 'TRON',
    address,
    balance: `${balanceTRX} TRX`,
    token_balances: tokenBalances,
    total_transactions: String(txCount),
    first_seen: firstSeen,
    last_seen: lastSeen,
    label: accData.addressTag || '無',
    risk: '未知',
    explorer_url: `https://tronscan.org/#/address/${address}`,
  };
}

// ── Bitcoin (Blockchain.info API) ──
async function lookupBTC(address) {
  const res = await fetch(`https://blockchain.info/rawaddr/${address}?limit=0`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    // Try blockchair as fallback
    const bcRes = await fetch(`https://api.blockchair.com/bitcoin/dashboards/address/${address}`);
    if (!bcRes.ok) throw new Error(`BTC lookup failed: ${res.status}`);
    const bcData = await bcRes.json();
    const info = bcData.data?.[address]?.address || {};
    return {
      chain: 'BTC',
      address,
      balance: `${((info.balance || 0) / 1e8).toFixed(8)} BTC`,
      token_balances: [],
      total_transactions: String((info.transaction_count || 0)),
      first_seen: info.first_seen_receiving || '—',
      last_seen: info.last_seen_receiving || '—',
      label: '無',
      risk: '未知',
      explorer_url: `https://www.blockchain.com/btc/address/${address}`,
    };
  }

  const data = await res.json();
  const balanceBTC = ((data.final_balance || 0) / 1e8).toFixed(8);
  const txCount = data.n_tx || 0;

  // First and last tx timestamps
  let firstSeen = '—', lastSeen = '—';
  if (data.txs && data.txs.length > 0) {
    // The API returns most recent first when limit>0
    // With limit=0 we don't get txs, so let's fetch 1
    try {
      const txRes = await fetch(`https://blockchain.info/rawaddr/${address}?limit=1&offset=0`);
      const txData = await txRes.json();
      if (txData.txs?.[0]?.time) {
        lastSeen = new Date(txData.txs[0].time * 1000).toISOString().split('T')[0];
      }
    } catch { /* ignore */ }
  }

  return {
    chain: 'BTC',
    address,
    balance: `${balanceBTC} BTC`,
    token_balances: [],
    total_transactions: String(txCount),
    first_seen: firstSeen,
    last_seen: lastSeen,
    label: '無',
    risk: '未知',
    explorer_url: `https://www.blockchain.com/btc/address/${address}`,
  };
}
