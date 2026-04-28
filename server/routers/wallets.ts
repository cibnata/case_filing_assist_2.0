import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getCaseById,
  createWalletProfile,
  getWalletProfilesByCaseId,
  deleteWalletProfilesByCaseId,
  getSystemSetting,
} from "../db";

// ─── 識別錢包鏈別 ─────────────────────────────────────────────────────────────
function detectChain(address: string): "ETH" | "TRON" | "BTC" | "unknown" {
  if (/^0x[0-9a-fA-F]{40}$/.test(address)) return "ETH";
  if (/^T[0-9A-Za-z]{33}$/.test(address)) return "TRON";
  if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) || /^bc1[a-z0-9]{39,59}$/.test(address)) return "BTC";
  return "unknown";
}

// ─── 查詢 ETH 錢包（Etherscan） ───────────────────────────────────────────────
async function queryEthWallet(address: string, apiKey: string = "") {
  try {
    const baseUrl = "https://api.etherscan.io/api";

    // 取得交易列表
    const txRes = await fetch(
      `${baseUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=asc&apikey=${apiKey}`
    );
    const txData = await txRes.json() as any;
    const txList: any[] = (txData.status === "1" && Array.isArray(txData.result)) ? txData.result : [];

    // 取得 ERC-20 代幣交易
    const tokenRes = await fetch(
      `${baseUrl}?module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&sort=asc&apikey=${apiKey}`
    );
    const tokenData = await tokenRes.json() as any;
    const tokenTxList: any[] = (tokenData.status === "1" && Array.isArray(tokenData.result)) ? tokenData.result : [];

    const addrLower = address.toLowerCase();
    const transInTxs = txList.filter((tx: any) => tx.to?.toLowerCase() === addrLower);
    const transOutTxs = txList.filter((tx: any) => tx.from?.toLowerCase() === addrLower);

    const transInAmount = transInTxs.reduce((sum: number, tx: any) => sum + parseFloat(tx.value || "0") / 1e18, 0);
    const transOutAmount = transOutTxs.reduce((sum: number, tx: any) => sum + parseFloat(tx.value || "0") / 1e18, 0);

    const firstTx = txList[0];
    const lastTx = txList[txList.length - 1];

    return {
      chain: "ETH",
      createTime: firstTx ? new Date(parseInt(firstTx.timeStamp) * 1000).toISOString() : null,
      lastTransactionDate: lastTx ? new Date(parseInt(lastTx.timeStamp) * 1000).toISOString() : null,
      transactionTimes: txList.length,
      transInTimes: transInTxs.length,
      transInAmount: transInAmount.toFixed(6) + " ETH",
      transOutTimes: transOutTxs.length,
      transOutAmount: transOutAmount.toFixed(6) + " ETH",
      trc20Ledger: tokenTxList.slice(0, 50).map((tx: any) => ({
        hash: tx.hash,
        tokenSymbol: tx.tokenSymbol,
        tokenName: tx.tokenName,
        amount: (parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal || "18"))).toFixed(6),
        direction: tx.to?.toLowerCase() === addrLower ? "IN" : "OUT",
        from: tx.from,
        to: tx.to,
        date: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
      })),
      rawData: { txCount: txList.length, tokenTxCount: tokenTxList.length },
    };
  } catch (err) {
    console.error("[ETH Wallet Query Error]", err);
    return null;
  }
}

// ─── 查詢 TRON 錢包（Tronscan） ───────────────────────────────────────────────
async function queryTronWallet(address: string, apiKey: string = "") {
   try {
    const baseUrl = "https://apilist.tronscanapi.com/api";
    const tronHeaders: Record<string, string> = apiKey ? { "TRON-PRO-API-KEY": apiKey } : {};
    // 帳戶資訊
    const accountRes = await fetch(`${baseUrl}/accountv2?address=${address}`, { headers: tronHeaders });
    const accountData = await accountRes.json() as any;
    // 交易列表
    const txRes = await fetch(
      `${baseUrl}/transaction?address=${address}&limit=50&start=0&sort=-timestamp`,
      { headers: tronHeaders }
    );
    const txData = await txRes.json() as any;
    const txList = (txData.data as any[]) || [];
    // TRC-20 代幣轉帳
    const trc20Res = await fetch(
      `${baseUrl}/token_trc20/transfers?relatedAddress=${address}&limit=50&start=0&sort=-timestamp`,
      { headers: tronHeaders }
    );
    const trc20Data = await trc20Res.json() as any;
    const trc20List = (trc20Data.token_transfers as any[]) || [];

    const transInTxs = txList.filter((tx: any) => tx.toAddress === address);
    const transOutTxs = txList.filter((tx: any) => tx.ownerAddress === address);

    const transInAmount = transInTxs.reduce((sum: number, tx: any) => sum + (tx.amount || 0) / 1e6, 0);
    const transOutAmount = transOutTxs.reduce((sum: number, tx: any) => sum + (tx.amount || 0) / 1e6, 0);

    const createTime = accountData.date_created
      ? new Date(accountData.date_created).toISOString()
      : null;

    const sortedTxs = [...txList].sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0));
    const lastTx = sortedTxs[sortedTxs.length - 1];

    return {
      chain: "TRON",
      createTime,
      lastTransactionDate: lastTx?.timestamp
        ? new Date(lastTx.timestamp).toISOString()
        : null,
      transactionTimes: accountData.transactions || txList.length,
      transInTimes: transInTxs.length,
      transInAmount: transInAmount.toFixed(6) + " TRX",
      transOutTimes: transOutTxs.length,
      transOutAmount: transOutAmount.toFixed(6) + " TRX",
      trc20Ledger: trc20List.map((tx: any) => ({
        hash: tx.transaction_id,
        tokenSymbol: tx.tokenInfo?.tokenAbbr || "TRC-20",
        tokenName: tx.tokenInfo?.tokenName || "",
        amount: (parseFloat(tx.quant || "0") / Math.pow(10, tx.tokenInfo?.tokenDecimal || 6)).toFixed(6),
        direction: tx.toAddress === address ? "IN" : "OUT",
        from: tx.fromAddress,
        to: tx.toAddress,
        date: tx.block_ts ? new Date(tx.block_ts).toISOString() : "",
      })),
      rawData: {
        balance: accountData.balance,
        totalTx: accountData.transactions,
        trc20Count: trc20List.length,
      },
    };
  } catch (err) {
    console.error("[TRON Wallet Query Error]", err);
    return null;
  }
}

export const walletsRouter = router({
  // ─── 查詢錢包 ────────────────────────────────────────────────────────────
  query: protectedProcedure
    .input(z.object({
      caseId: z.number(),
      addresses: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      const c = await getCaseById(input.caseId);
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      if (c.officerId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // 清除舊的查詢結果
      await deleteWalletProfilesByCaseId(input.caseId);

      // 從資料庫讀取 API Key（優先），fallback 至環境變數
      const ethApiKey = (await getSystemSetting("ETHERSCAN_API_KEY")) || process.env.ETHERSCAN_API_KEY || "";
      const tronApiKey = (await getSystemSetting("TRONSCAN_API_KEY")) || process.env.TRONSCAN_API_KEY || "";

      const results = [];
      for (const address of input.addresses) {
        const chain = detectChain(address);
        let walletData: any = null;
        if (chain === "ETH") {
          walletData = await queryEthWallet(address, ethApiKey);
         } else if (chain === "TRON") {
          walletData = await queryTronWallet(address, tronApiKey);
        }
        if (walletData) {
          await createWalletProfile({
            caseId: input.caseId,
            address,
            chain: walletData.chain,
            createTime: walletData.createTime,
            lastTransactionDate: walletData.lastTransactionDate,
            transactionTimes: walletData.transactionTimes,
            transInTimes: walletData.transInTimes,
            transInAmount: walletData.transInAmount,
            transOutTimes: walletData.transOutTimes,
            transOutAmount: walletData.transOutAmount,
            trc20Ledger: walletData.trc20Ledger,
            rawData: walletData.rawData,
          });
          results.push({ address, chain, ...walletData });
        } else {
          // 無法查詢，仍儲存基本資訊
          await createWalletProfile({
            caseId: input.caseId,
            address,
            chain,
          });
          results.push({ address, chain, error: "查詢失敗或不支援此鏈" });
        }
      }

      return { success: true, results };
    }),

  // ─── 取得案件所有錢包分析 ────────────────────────────────────────────────
  list: protectedProcedure
    .input(z.object({ caseId: z.number() }))
    .query(async ({ ctx, input }) => {
      const c = await getCaseById(input.caseId);
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      if (c.officerId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return getWalletProfilesByCaseId(input.caseId);
    }),
});
