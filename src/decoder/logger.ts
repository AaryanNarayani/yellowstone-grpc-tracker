import { walletHistoryCache } from "./classify";
import { calculateRiskLevel, detectProtocol, detectTradingPatterns, determineTransactionType, fetchTokenMetadata, formatTokenAmount } from "./helpers";
import { formattedLogs, ParsedAccountData, SwapActivity, TokenMetadata, TokenTransaction, TransactionDetails } from "./types";

export const enhanceTransactionLogs = async (
  txDetails: TransactionDetails,
  accountData: ParsedAccountData
): Promise<formattedLogs> => {
  const tokenTransactions: TokenTransaction[] = [];
  
  for (const transfer of txDetails.tokenTransfers) {
    const tokenMetadata = await fetchTokenMetadata(transfer.mint);
    
    // USD value calculations
    const pricePerToken = tokenMetadata.price || 0;
    const usdValue = transfer.amount * pricePerToken;
    const solEquivalent = usdValue / 170; // Rough for now, should fetch real SOL price

    const isNewPosition = !walletHistoryCache.has(`${accountData.pubkey}-${transfer.mint}`);
    
    tokenTransactions.push({
      action: transfer.type === "BUY" ? "BUY" : "SELL",
      token_metadata: tokenMetadata,
      amount: transfer.amount,
      amount_formatted: formatTokenAmount(transfer.amount, tokenMetadata.decimals),
      usd_value: usdValue > 0 ? usdValue : undefined,
      sol_equivalent: solEquivalent > 0 ? solEquivalent : undefined,
      price_per_token: pricePerToken > 0 ? pricePerToken : undefined,
      is_new_position: isNewPosition,
    });
    
    if (isNewPosition) {
      walletHistoryCache.set(`${accountData.pubkey}-${transfer.mint}`, {
        transaction_count: 1,
        first_seen: txDetails.timestamp
      });
    }
  }

  let swapActivity: SwapActivity | null = null;
  if (txDetails.defiActivity) {
    const defi = txDetails.defiActivity;
    
    let fromTokenMetadata: TokenMetadata | undefined;
    let toTokenMetadata: TokenMetadata | undefined;
    
    if (defi.fromToken) {
      fromTokenMetadata = await fetchTokenMetadata(defi.fromToken);
    }
    if (defi.toToken) {
      toTokenMetadata = await fetchTokenMetadata(defi.toToken);
    }
    
    swapActivity = {
      type: defi.type === "SWAP" ? "TOKEN_SWAP" : 
            defi.type === "BUY" ? "SOL_TO_TOKEN" : "TOKEN_TO_SOL",
      protocol: detectProtocol(txDetails.signature), // Enhanced protocol detection
      from_token: fromTokenMetadata,
      to_token: toTokenMetadata,
      from_amount: defi.fromAmount,
      to_amount: defi.toAmount,
      from_usd_value: fromTokenMetadata && defi.fromAmount ? 
        (fromTokenMetadata.price || 0) * defi.fromAmount : undefined,
      to_usd_value: toTokenMetadata && defi.toAmount ? 
        (toTokenMetadata.price || 0) * defi.toAmount : undefined,
    };
  }

  const totalUsdValue = tokenTransactions.reduce((sum, tx) => sum + (tx.usd_value || 0), 0);
  const transactionType = determineTransactionType(tokenTransactions, swapActivity, txDetails.solChange);
  const riskLevel = calculateRiskLevel(tokenTransactions, totalUsdValue);
  
  const detectedPatterns = detectTradingPatterns(tokenTransactions, txDetails);

  return {
    transaction_id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    signature: txDetails.signature,
    timestamp: txDetails.timestamp,
    timestamp_iso: new Date(txDetails.timestamp * 1000).toISOString(),
    success: txDetails.success,
    
    wallet: {
      wallet_address: accountData.pubkey,
      current_balance_sol: accountData.lamportsSOL,
      sol_change: txDetails.solChange,
      timestamp: txDetails.timestamp,
      timestamp_iso: new Date(txDetails.timestamp * 1000).toISOString(),
      transaction_signature: txDetails.signature,
      transaction_success: txDetails.success,
      slot: accountData.slot !== "Unknown" ? accountData.slot : undefined,
    },
    
    token_transactions: tokenTransactions,
    swap_activity: swapActivity,
    
    summary: {
      total_tokens_involved: tokenTransactions.length,
      total_usd_value: totalUsdValue,
      net_sol_change: txDetails.solChange,
      transaction_type: transactionType,
      risk_level: riskLevel,
      gas_fees_sol: Math.abs(txDetails.solChange) > 0 ? 0.000005 : 0, // Rough estimate
    },
    
    context: {
      detected_patterns: detectedPatterns,
      similar_transactions_count: 0, // Would require historical analysis
      is_first_time_token: tokenTransactions.some(tx => tx.is_new_position),
    }
  };
};

export const TransactionLogger = (log: formattedLogs): void => {
  console.log("\n" + "=".repeat(120));
  console.log("WALLET TRACKER LOG");
  console.log("=".repeat(120));
  
  // Header with key info
  console.log(`Transaction: ${log.signature.substring(0, 20)}...`);
  console.log(`Wallet: ${log.wallet.wallet_address}`);
  console.log(`Time: ${log.timestamp_iso}`);
  console.log(`☑️ Status: ${log.success ? "SUCCESS" : "FAILED"}`);
  console.log(`SOL Change: ${log.wallet.sol_change >= 0 ? "+" : ""}${log.wallet.sol_change.toFixed(6)} SOL`);
  console.log(`Total USD Value: $${log.summary.total_usd_value.toFixed(2)}`);
  console.log(`Risk Level: ${log.summary.risk_level}`);
  
  // Token transactions
  if (log.token_transactions.length > 0) {
    console.log("\nTOKEN TRANSACTIONS:");
    log.token_transactions.forEach((tx, i) => {
      const actionIcon = tx.action === "BUY" ? "🟢" : "🔴";
      const priceInfo = tx.price_per_token ? ` @ $${tx.price_per_token.toFixed(6)}` : "";
      const usdInfo = tx.usd_value ? ` ($${tx.usd_value.toFixed(2)})` : "";
      const newBadge = tx.is_new_position ? " 🆕" : "";
      
      console.log(`  ${actionIcon} ${tx.action}: ${tx.amount_formatted} ${tx.token_metadata.symbol}${priceInfo}${usdInfo}${newBadge}`);
      console.log(`     Token: ${tx.token_metadata.name}`);
      console.log(`     Token Mint: ${tx.token_metadata.mint}`);
      
      if (tx.token_metadata.logoURI) {
        console.log(`     Logo: ${tx.token_metadata.logoURI}`);
      }
      
      if (tx.token_metadata.website) {
        console.log(`     🌐 Website: ${tx.token_metadata.website}`);
      }
      
      if (tx.token_metadata.marketCap) {
        console.log(`     📈 Market Cap: $${(tx.token_metadata.marketCap / 1e6).toFixed(2)}M`);
      }
      
      if (i < log.token_transactions.length - 1) console.log("");
    });
  }
  
  // Swap activity
  if (log.swap_activity) {
    const swap = log.swap_activity;
    console.log("\n🔄 SWAP ACTIVITY:");
    console.log(`  Type: ${swap.type}`);
    console.log(`  Protocol: ${swap.protocol}`);
    
    if (swap.from_token && swap.to_token) {
      console.log(`  ${swap.from_amount} ${swap.from_token.symbol} → ${swap.to_amount} ${swap.to_token.symbol}`);
    }
  }
  
  // Patterns and insights
  if (log.context.detected_patterns.length > 0) {
    console.log("\nDETECTED PATTERNS:");
    log.context.detected_patterns.forEach(pattern => {
      console.log(`  • ${pattern.replace(/_/g, " ")}`);
    });
  }
  
  // Summary
  console.log(`\n📋 SUMMARY: ${log.summary.transaction_type.replace(/_/g, " ")} | ${log.summary.total_tokens_involved} tokens | ${log.summary.risk_level} risk`);
  
  console.log("=".repeat(120) + "\n");
};

export const displayBasicUpdate = (data: ParsedAccountData): void => {
  const time = new Date(data.timestamp).toLocaleTimeString();
  console.log(
    `[${time}] Balance Update: ${data.lamportsSOL.toFixed(6)} SOL`
  );
};