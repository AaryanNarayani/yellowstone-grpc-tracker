export interface TokenMetadata {
  mint: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  description?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  marketCap?: number;
  price?: number;
  priceChange24h?: number;
  volume24h?: number;
  supply?: number;
  holder_count?: number;
  created_timestamp?: number;
  freeze_authority?: string;
  mint_authority?: string;
  is_mutable?: boolean;
}

export interface TokenPriceInfo {
  price_usd: number;
  price_change_24h?: number;
  market_cap?: number;
  volume_24h?: number;
  supply?: number;
}

export interface WalletActivity {
  wallet_address: string;
  current_balance_sol: number;
  sol_change: number;
  timestamp: number;
  timestamp_iso: string;
  transaction_signature: string;
  transaction_success: boolean;
  block_time?: number;
  slot?: string;
}

export interface TokenTransaction {
  action: "BUY" | "SELL" | "SWAP_IN" | "SWAP_OUT";
  token_metadata: TokenMetadata;
  amount: number;
  amount_formatted: string;
  usd_value?: number;
  sol_equivalent?: number;
  price_per_token?: number;
  is_new_position: boolean;
  position_change_percent?: number;
}

export interface SwapActivity {
  type: "TOKEN_SWAP" | "SOL_TO_TOKEN" | "TOKEN_TO_SOL";
  protocol: string;
  from_token?: TokenMetadata;
  to_token?: TokenMetadata;
  from_amount?: number;
  to_amount?: number;
  from_usd_value?: number;
  to_usd_value?: number;
  slippage?: number;
  fees_sol?: number;
}

export interface TransactionSummary {
  total_tokens_involved: number;
  total_usd_value: number;
  net_sol_change: number;
  transaction_type: "SIMPLE_TRANSFER" | "TOKEN_TRADE" | "COMPLEX_SWAP" | "DEFI_INTERACTION";
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  gas_fees_sol: number;
}

export interface formattedLogs {
  // Transaction Metadata
  transaction_id: string;
  signature: string;
  timestamp: number;
  timestamp_iso: string;
  success: boolean;
  
  // Wallet Information
  wallet: WalletActivity;
  
  // Token Activities
  token_transactions: TokenTransaction[];
  
  // Swap/DeFi Activities
  swap_activity: SwapActivity | null;
  
  // Analytics & Summary
  summary: TransactionSummary;
  
  // Additional Context
  context: {
    detected_patterns: string[];
    similar_transactions_count: number;
    wallet_age_days?: number;
    is_first_time_token?: boolean;
  };
}

export interface ParsedAccountData {
  pubkey: string;
  lamports: string;
  lamportsSOL: number;
  owner: string;
  executable: boolean;
  rentEpoch: string;
  slot: string;
  txnSignature: string;
  timestamp: string;
}

export interface TokenTransfer {
  tokenSymbol: string;
  tokenName: string;
  amount: number;
  decimals: number;
  mint: string;
  type: "BUY" | "SELL";
  usdValue?: number;
}

export interface DefiActivityOld {
  type: "SWAP" | "BUY" | "SELL";
  protocol: string;
  fromToken?: string;
  toToken?: string;
  fromAmount?: number;
  toAmount?: number;
}

export interface TransactionDetails {
  signature: string;
  success: boolean;
  tokenTransfers: TokenTransfer[];
  solChange: number;
  timestamp: number;
  defiActivity?: DefiActivityOld | null;
}