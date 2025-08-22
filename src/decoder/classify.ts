import { Connection } from "@solana/web3.js";
import { encodeBase58, fetchTokenMetadata, toNum } from "./helpers";
import { DefiActivityOld, formattedLogs, ParsedAccountData, TokenMetadata, TokenPriceInfo, TokenTransfer, TransactionDetails } from "./types";
import { displayBasicUpdate, enhanceTransactionLogs, TransactionLogger } from "./logger";
import { RPC_URL } from "../utils";

export const connection = new Connection(RPC_URL as unknown as string, "confirmed");

// Caches
export const tokenMetadataCache = new Map<string, TokenMetadata>();
export const tokenPriceCache = new Map<string, { price: TokenPriceInfo; timestamp: number }>();
export const walletHistoryCache = new Map<string, { transaction_count: number; first_seen: number }>();

// Storage
const transactionLogs: TransactionDetails[] = [];
const formattedLogs: formattedLogs[] = [];

// Price cache TTL (5 minutes)
export const PRICE_CACHE_TTL = 5 * 60 * 1000;

export const processTransaction = async (data: ParsedAccountData): Promise<void> => {
  try {
    console.log(
      `[${new Date(data.timestamp).toLocaleTimeString()}] Processing enhanced transaction...`
    );
    console.log(`Transaction: ${data.txnSignature}`);

    const signatureBuffer = Buffer.from(data.txnSignature, "base64");
    const base58Signature = encodeBase58(signatureBuffer);

    const txDetails = await getTransactionDetails(base58Signature, data.pubkey);

    if (txDetails) {
      // Store legacy format
      transactionLogs.push(txDetails);
      
      console.log("Getting transaction with token metadata...");
      const logs = await enhanceTransactionLogs(txDetails, data);
      formattedLogs.push(logs);

      // Log in formatted style
      TransactionLogger(logs);
    }
  } catch (error) {
    console.error("❌ Error processing transaction:", error);
    displayBasicUpdate(data);
  }
};

const getTransactionDetails = async (
  signature: string,
  walletAddress: string
): Promise<TransactionDetails | null> => {
  try {
    if (!signature || signature.length < 50) {
      console.log("❌ Invalid transaction signature");
      return null;
    }

    const transaction = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!transaction) {
      console.log("❌ Transaction not found on blockchain");
      return null;
    }

    let solChange = 0;
    if (transaction.transaction?.message?.staticAccountKeys) {
      const accountIndex =
        transaction.transaction.message.staticAccountKeys.findIndex(
          (key) => key && key.toString() === walletAddress
        );

      if (
        accountIndex !== -1 &&
        transaction.meta?.preBalances &&
        transaction.meta?.postBalances
      ) {
        const preBalance = transaction.meta.preBalances[accountIndex] / 1e9;
        const postBalance = transaction.meta.postBalances[accountIndex] / 1e9;
        solChange = postBalance - preBalance;
      }
    }

    const tokenTransfers = await computeTokenTransfers(
      transaction,
      walletAddress,
      solChange
    );

    const defiActivity = detectDefiActivity(transaction, walletAddress, solChange);

    return {
      signature,
      success: transaction.meta?.err === null,
      tokenTransfers,
      solChange,
      timestamp: transaction.blockTime || Date.now() / 1000,
      defiActivity,
    };
  } catch (error) {
    console.error("❌ Error fetching transaction details:", error);
    return null;
  }
};

const computeTokenTransfers = async (
  transaction: any,
  walletAddress: string,
  solChange: number
): Promise<TokenTransfer[]> => {
  const transfers: TokenTransfer[] = [];

  const pre = transaction.meta?.preTokenBalances || [];
  const post = transaction.meta?.postTokenBalances || [];

  const postByIdx = new Map<number, any>();
  for (const p of post) {
    if (p?.accountIndex !== undefined) postByIdx.set(p.accountIndex, p);
  }

  for (const p of pre) {
    if (!p || !p.mint || !p.uiTokenAmount) continue;
    if (p.owner !== walletAddress) continue;

    const after = postByIdx.get(p.accountIndex);
    if (!after || after.mint !== p.mint) continue;

    const beforeAmt = toNum(p.uiTokenAmount.uiAmountString);
    const afterAmt = toNum(after.uiTokenAmount?.uiAmountString);
    const diff = afterAmt - beforeAmt;

    if (Math.abs(diff) <= 0) continue;

    const meta = await getTokenMetadata(p.mint);
    let type: "BUY" | "SELL";
    if (diff > 0) {
      type = solChange < 0 ? "BUY" : "BUY";
    } else {
      type = solChange > 0 ? "SELL" : "SELL";
    }

    transfers.push({
      tokenSymbol: meta.symbol,
      tokenName: meta.name,
      amount: Math.abs(diff),
      decimals: after.uiTokenAmount?.decimals ?? p.uiTokenAmount.decimals ?? 6,
      mint: p.mint,
      type,
    });
  }

  const preIdxSet = new Set(pre.filter((x: any) => x?.owner === walletAddress).map((x: any) => x.accountIndex));
  for (const a of post) {
    if (!a || !a.mint || !a.uiTokenAmount) continue;
    if (a.owner !== walletAddress) continue;
    if (preIdxSet.has(a.accountIndex)) continue;

    const afterAmt = toNum(a.uiTokenAmount.uiAmountString);
    if (afterAmt > 0) {
      const meta = await getTokenMetadata(a.mint);
      const type: "BUY" | "SELL" = solChange < 0 ? "BUY" : "BUY";
      transfers.push({
        tokenSymbol: meta.symbol,
        tokenName: meta.name,
        amount: afterAmt,
        decimals: a.uiTokenAmount.decimals ?? 6,
        mint: a.mint,
        type,
      });
    }
  }

  return transfers;
};

const getTokenMetadata = async (
  mint: string
): Promise<{ symbol: string; name: string; decimals: number }> => {
  // Use the enhanced fetchTokenMetadata function but return in legacy format
  const enhanced = await fetchTokenMetadata(mint);
  return {
    symbol: enhanced.symbol,
    name: enhanced.name,
    decimals: enhanced.decimals
  };
};

const detectDefiActivity = (
  tx: any,
  wallet: string,
  solChange: number
): DefiActivityOld | null => {
  if (!tx.meta) return null;

  const logs: string[] = tx.meta.logMessages || [];
  const logJoined = logs.join(" ");
  const hasBuy = /Instruction:\s*Buy/i.test(logJoined);
  const hasSell = /Instruction:\s*Sell/i.test(logJoined);
  const hasSwap = /Swap|Instruction:\s*Swap|Route/i.test(logJoined);

  const pre = tx.meta.preTokenBalances || [];
  const post = tx.meta.postTokenBalances || [];

  const postByIdx = new Map<number, any>();
  for (const a of post) {
    if (a?.accountIndex !== undefined) postByIdx.set(a.accountIndex, a);
  }

  const changes: { mint: string; diff: number }[] = [];

  for (const p of pre) {
    if (!p || !p.mint || !p.uiTokenAmount) continue;
    if (p.owner !== wallet) continue;

    const after = postByIdx.get(p.accountIndex);
    if (!after || after.mint !== p.mint) continue;

    const beforeAmt = toNum(p.uiTokenAmount.uiAmountString);
    const afterAmt = toNum(after.uiTokenAmount?.uiAmountString);
    const diff = afterAmt - beforeAmt;
    if (Math.abs(diff) > 0) {
      changes.push({ mint: p.mint, diff });
    }
  }

  const preIdxSet = new Set(pre.filter((x: any) => x?.owner === wallet).map((x: any) => x.accountIndex));
  for (const a of post) {
    if (!a || !a.mint || !a.uiTokenAmount) continue;
    if (a.owner !== wallet) continue;
    if (preIdxSet.has(a.accountIndex)) continue;
    const afterAmt = toNum(a.uiTokenAmount.uiAmountString);
    if (afterAmt > 0) {
      changes.push({ mint: a.mint, diff: afterAmt });
    }
  }

  if (changes.length >= 2) {
    const from = changes.find((c) => c.diff < 0);
    const to = changes.find((c) => c.diff > 0);
    if (from && to) {
      return {
        type: "SWAP",
        protocol: "Unknown",
        fromToken: from.mint,
        toToken: to.mint,
        fromAmount: Math.abs(from.diff),
        toAmount: to.diff,
      };
    }
  }

  if (changes.length === 1) {
    const only = changes[0];
    if (hasBuy || (!hasSell && solChange < 0 && only.diff > 0)) {
      return {
        type: "BUY",
        protocol: "Unknown",
        toToken: only.mint,
        toAmount: only.diff,
      };
    }
    if (hasSell || (!hasBuy && solChange > 0 && only.diff < 0)) {
      return {
        type: "SELL",
        protocol: "Unknown",
        fromToken: only.mint,
        fromAmount: Math.abs(only.diff),
      };
    }
  }

  if (hasSwap) return { type: "SWAP", protocol: "Unknown" };
  if (hasBuy) return { type: "BUY", protocol: "Unknown" };
  if (hasSell) return { type: "SELL", protocol: "Unknown" };

  return null;
};