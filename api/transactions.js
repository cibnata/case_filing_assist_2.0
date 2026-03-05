// /api/transactions.js — Vercel Serverless Function
// 查詢真實區塊鏈交易紀錄
// 支援 ETH (Etherscan)、TRON (TronScan)、BTC (Blockchain.info)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { address, chain, page = '1', limit = '25' } = req.query;
  if (!address || !chain) {
    return res.status(400).json({ error: 'Missing address or chain parameter' });
  }

  try {
    let result;
    const pg = parseInt(page);
    const lim = Math.min(parseInt(limit), 50);

    switch (chain.toUpperCase()) {
      case 'ETH':
        result = await fetchETHTransactions(address, pg, lim);
        break;
      case 'TRON':
        result = await fetchTRONTransactions(address, pg, lim);
        break;
      case 'BTC':
        result = await fetchBTCTransactions(address, pg, lim);
        break;
      default:
        return res.status(400).json({ error: `Unsupported chain: ${chain}` });
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error(`Transaction lookup error [${chain}/${address}]:`, err);
    return res.status(500).json({ error: err.message, chain, address });
  }
}

// ── ETH Transactions (Etherscan) ──
async function fetchETHTransactions(address, page, limit) {
  const apiKey = process.env.ETHERSCAN_API_KEY || '';
  const base = 'https://api.etherscan.io/api';
  const addrLower = address.toLowerCase();

  // Fetch both normal tx and ERC20 transfers in parallel
  const [txRes, tokenRes] = await Promise.all([
    fetch(`${base}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=${page}&offset=${limit}&sort=desc&apikey=${apiKey}`),
    fetch(`${base}?module=account&action=tokentx&address=${address}&page=${page}&offset=${limit}&sort=desc&apikey=${apiKey}`),
  ]);

  const txData = await txRes.json();
  const tokenData = await tokenRes.json();

  const transactions = [];

  // Normal ETH transactions
  if (Array.isArray(txData.result)) {
    for (const tx of txData.result) {
      const valueETH = (parseInt(tx.value || '0') / 1e18).toFixed(6);
      const fee = ((parseInt(tx.gasUsed || '0') * parseInt(tx.gasPrice || '0')) / 1e18).toFixed(6);
      transactions.push({
        hash: tx.hash,
        timestamp: tx.timeStamp ? new Date(parseInt(tx.timeStamp) * 1000).toISOString().replace('T', ' ').slice(0, 19) : '',
        direction: tx.from.toLowerCase() === addrLower ? 'OUT' : 'IN',
        from: tx.from,
        to: tx.to,
        value: valueETH === '0.000000' ? '0' : valueETH,
        token: 'ETH',
        fee: `${fee} ETH`,
        block: tx.blockNumber,
        status: tx.isError === '0' ? 'success' : 'failed',
        type: 'normal',
      });
    }
  }

  // ERC20 token transfers
  if (Array.isArray(tokenData.result)) {
    for (const tx of tokenData.result) {
      const decimals = parseInt(tx.tokenDecimal || '18');
      const value = (parseInt(tx.value || '0') / Math.pow(10, decimals)).toFixed(4);
      transactions.push({
        hash: tx.hash,
        timestamp: tx.timeStamp ? new Date(parseInt(tx.timeStamp) * 1000).toISOString().replace('T', ' ').slice(0, 19) : '',
        direction: tx.from.toLowerCase() === addrLower ? 'OUT' : 'IN',
        from: tx.from,
        to: tx.to,
        value,
        token: tx.tokenSymbol || tx.tokenName || 'ERC20',
        fee: '—',
        block: tx.blockNumber,
        status: 'success',
        type: 'token_transfer',
      });
    }
  }

  // Sort by timestamp desc and dedupe
  transactions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return {
    chain: 'ETH',
    address,
    transactions,
    total_count: transactions.length,
    page,
    has_more: transactions.length >= limit,
  };
}

// ── TRON Transactions (TronScan) ──
async function fetchTRONTransactions(address, page, limit) {
  const base = 'https://apilist.tronscanapi.com/api';
  const headers = { 'TRON-PRO-API-KEY': process.env.TRONSCAN_API_KEY || '' };
  const start = (page - 1) * limit;

  // Fetch normal tx and TRC20 transfers in parallel
  const [txRes, trc20Res] = await Promise.all([
    fetch(`${base}/transaction?sort=-timestamp&count=true&limit=${limit}&start=${start}&address=${address}`, { headers }),
    fetch(`${base}/token_trc20/transfers?sort=-timestamp&count=true&limit=${limit}&start=${start}&relatedAddress=${address}`, { headers }),
  ]);

  const txData = await txRes.json();
  const trc20Data = await trc20Res.json();

  const transactions = [];

  // Normal TRX transactions
  if (txData.data && Array.isArray(txData.data)) {
    for (const tx of txData.data) {
      const value = ((tx.amount || 0) / 1e6).toFixed(2);
      transactions.push({
        hash: tx.hash,
        timestamp: tx.timestamp ? new Date(tx.timestamp).toISOString().replace('T', ' ').slice(0, 19) : '',
        direction: tx.ownerAddress === address ? 'OUT' : 'IN',
        from: tx.ownerAddress || '',
        to: tx.toAddress || '',
        value,
        token: 'TRX',
        fee: tx.cost ? `${(tx.cost.fee || 0) / 1e6} TRX` : '—',
        block: String(tx.block || ''),
        status: tx.confirmed ? 'success' : 'pending',
        type: 'normal',
      });
    }
  }

  // TRC20 transfers (especially USDT)
  if (trc20Data.token_transfers && Array.isArray(trc20Data.token_transfers)) {
    for (const tx of trc20Data.token_transfers) {
      const decimals = parseInt(tx.tokenInfo?.tokenDecimal || '6');
      const value = (parseFloat(tx.quant || '0') / Math.pow(10, decimals)).toFixed(4);
      transactions.push({
        hash: tx.transaction_id,
        timestamp: tx.block_ts ? new Date(tx.block_ts).toISOString().replace('T', ' ').slice(0, 19) : '',
        direction: tx.from_address === address ? 'OUT' : 'IN',
        from: tx.from_address || '',
        to: tx.to_address || '',
        value,
        token: tx.tokenInfo?.tokenAbbr || 'TRC20',
        fee: '—',
        block: String(tx.block || ''),
        status: tx.confirmed ? 'success' : 'pending',
        type: 'token_transfer',
      });
    }
  }

  transactions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return {
    chain: 'TRON',
    address,
    transactions,
    total_count: txData.total || trc20Data.total || transactions.length,
    page,
    has_more: transactions.length >= limit,
  };
}

// ── BTC Transactions (Blockchain.info) ──
async function fetchBTCTransactions(address, page, limit) {
  const offset = (page - 1) * limit;
  const res = await fetch(`https://blockchain.info/rawaddr/${address}?limit=${limit}&offset=${offset}`);

  if (!res.ok) {
    // Fallback to blockchair
    const bcRes = await fetch(`https://api.blockchair.com/bitcoin/dashboards/address/${address}?limit=${limit}&offset=${offset}&transaction_details=true`);
    if (!bcRes.ok) throw new Error(`BTC tx lookup failed: ${res.status}`);
    const bcData = await bcRes.json();
    const txs = bcData.data?.[address]?.transactions || [];
    return {
      chain: 'BTC', address,
      transactions: txs.map(tx => ({
        hash: tx.hash || tx,
        timestamp: '', direction: '—', from: '—', to: '—',
        value: '—', token: 'BTC', fee: '—', block: '', status: 'success', type: 'normal',
      })),
      total_count: bcData.data?.[address]?.address?.transaction_count || 0,
      page, has_more: txs.length >= limit,
    };
  }

  const data = await res.json();
  const transactions = [];

  if (data.txs && Array.isArray(data.txs)) {
    for (const tx of data.txs) {
      // Determine direction and value
      let totalIn = 0, totalOut = 0;
      let fromAddrs = [], toAddrs = [];

      for (const input of (tx.inputs || [])) {
        if (input.prev_out) {
          fromAddrs.push(input.prev_out.addr || '');
          if (input.prev_out.addr === address) {
            totalOut += input.prev_out.value || 0;
          }
        }
      }
      for (const output of (tx.out || [])) {
        toAddrs.push(output.addr || '');
        if (output.addr === address) {
          totalIn += output.value || 0;
        }
      }

      const isOut = totalOut > 0;
      const netValue = isOut ? (totalOut - totalIn) : totalIn;
      const valueBTC = (Math.abs(netValue) / 1e8).toFixed(8);
      const feeBTC = ((tx.fee || 0) / 1e8).toFixed(8);

      transactions.push({
        hash: tx.hash,
        timestamp: tx.time ? new Date(tx.time * 1000).toISOString().replace('T', ' ').slice(0, 19) : '',
        direction: isOut ? 'OUT' : 'IN',
        from: fromAddrs.filter(a => a).slice(0, 3).join(', ') || '—',
        to: toAddrs.filter(a => a).slice(0, 3).join(', ') || '—',
        value: valueBTC,
        token: 'BTC',
        fee: `${feeBTC} BTC`,
        block: String(tx.block_height || ''),
        status: (tx.block_height && tx.block_height > 0) ? 'success' : 'pending',
        type: 'normal',
      });
    }
  }

  return {
    chain: 'BTC',
    address,
    transactions,
    total_count: data.n_tx || 0,
    page,
    has_more: transactions.length >= limit,
  };
}
