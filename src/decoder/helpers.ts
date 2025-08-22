import { SubscribeUpdate } from "@triton-one/yellowstone-grpc";
import { connection, PRICE_CACHE_TTL, tokenMetadataCache, tokenPriceCache } from "./classify";
import { SwapActivity, TokenMetadata, TokenPriceInfo, TokenTransaction, TransactionDetails } from "./types";
import { PublicKey } from "@solana/web3.js";
import { handleDataParsing } from "./parser";

export const toNum = (v: string | number | undefined | null): number =>
  v === undefined || v === null ? 0 : typeof v === "number" ? v : parseFloat(v) || 0;

export const encodeBase58 = (buffer: Buffer): string => {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const base = ALPHABET.length;

  if (buffer.length === 0) return "";

  let digits = [0];

  for (let i = 0; i < buffer.length; i++) {
    let carry = buffer[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % base;
      carry = Math.floor(carry / base);
    }

    while (carry > 0) {
      digits.push(carry % base);
      carry = Math.floor(carry / base);
    }
  }

  let leadingZeros = 0;
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
    leadingZeros++;
  }

  return (
    ALPHABET[0].repeat(leadingZeros) +
    digits.reverse().map((digit) => ALPHABET[digit]).join("")
  );
};

export const lamportsToSOL = (lamports: string): number => {
  return parseInt(lamports) / 1_000_000_000;
};

let previousBalance: string | null = null;
export const handleDataParsingWithChangeDetection = (
  data: SubscribeUpdate
): void => {
  if (
    data.ping ||
    !data.account ||
    !data.account.account ||
    data.account === undefined ||
    Object.keys(data).every(
      (key) =>
        (data as any)[key] === undefined ||
        key === "createdAt" ||
        key === "filters"
    )
  ) {
    return;
  }

  try {
    const account = data.account.account;
    if (!account || !account.lamports) return;

    const currentBalance = account.lamports;

    if (previousBalance && previousBalance !== currentBalance) {
      const prevSOL = parseInt(previousBalance) / 1_000_000_000;
      const currentSOL = parseInt(currentBalance) / 1_000_000_000;
      const change = currentSOL - prevSOL;
      const changeType = change > 0 ? "📈 BALANCE INCREASE" : "📉 BALANCE DECREASE";

      console.log(
        `${changeType}: ${change > 0 ? "+" : ""}${change.toFixed(6)} SOL`
      );
    }

    previousBalance = currentBalance;
    handleDataParsing(data);
  } catch (error) {
    console.error("❌ Error in change detection:", error);
  }
};

export const fetchTokenMetadata = async (mint: string): Promise<TokenMetadata> => {
  if (tokenMetadataCache.has(mint)) {
    return tokenMetadataCache.get(mint)!;
  }

  try {
    console.log(`🔍 Fetching metadata for token: ${mint}`);
    
    // Get basic mint info
    const mintInfo = await connection.getParsedAccountInfo(new PublicKey(mint));
    let decimals = 6;
    let supply = 0;
    let freeze_authority: string | undefined;
    let mint_authority: string | undefined;
    
    if (mintInfo.value?.data && "parsed" in mintInfo.value.data) {
      const parsed = (mintInfo.value.data as any).parsed?.info;
      decimals = parsed?.decimals ?? 6;
      supply = parsed?.supply ? parseInt(parsed.supply) / Math.pow(10, decimals) : 0;
      freeze_authority = parsed?.freezeAuthority;
      mint_authority = parsed?.mintAuthority;
    }

    // Try to fetch Metaplex metadata
    const metadata = await fetchMetaplexMetadata(mint);
    
    // Try to fetch price data
    const priceData = await fetchTokenPrice(mint);
    
    const tokenMetadata: TokenMetadata = {
      mint,
      name: metadata.name || `Token ${mint.substring(0, 8)}`,
      symbol: metadata.symbol || mint.substring(0, 8),
      decimals,
      logoURI: metadata.image,
      description: metadata.description,
      website: metadata.external_url,
      supply,
      freeze_authority,
      mint_authority,
      is_mutable: mint_authority !== null,
      price: priceData?.price_usd,
      priceChange24h: priceData?.price_change_24h,
      marketCap: priceData?.market_cap,
      volume24h: priceData?.volume_24h,
      holder_count: priceData?.supply ? Math.floor(priceData.supply / 1000) : undefined, // Rough estimate
      created_timestamp: Date.now(), // Would need additional API for actual creation time
    };

    tokenMetadataCache.set(mint, tokenMetadata);
    console.log(`✅ Token metadata fetched: ${tokenMetadata.name} (${tokenMetadata.symbol})`);
    
    return tokenMetadata;
  } catch (error) {
    console.error(`❌ Error fetching token metadata for ${mint}:`, error);
    
    // Return fallback metadata
    const fallback: TokenMetadata = {
      mint,
      name: `Token ${mint.substring(0, 8)}`,
      symbol: mint.substring(0, 8),
      decimals: 6,
    };
    
    tokenMetadataCache.set(mint, fallback);
    return fallback;
  }
};

export const fetchMetaplexMetadata = async (mint: string): Promise<any> => {
  try {
    // Calculate Metaplex PDA
    const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
    const [metadataPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        METADATA_PROGRAM_ID.toBuffer(),
        new PublicKey(mint).toBuffer(),
      ],
      METADATA_PROGRAM_ID
    );

    const metadataAccount = await connection.getAccountInfo(metadataPDA);
    if (!metadataAccount) {
      return {};
    }

    // Basic metadata parsing (simplified)
    const data = metadataAccount.data;
    
    // This is a simplified parser - in production, use @metaplex-foundation/mpl-token-metadata
    let offset = 1 + 32 + 32; // Skip key + update_authority + mint
    
    // Read name
    const nameLength = data.readUInt32LE(offset);
    offset += 4;
    const name = data.slice(offset, offset + nameLength).toString('utf8').replace(/\0/g, '');
    offset += nameLength;
    
    // Read symbol
    const symbolLength = data.readUInt32LE(offset);
    offset += 4;
    const symbol = data.slice(offset, offset + symbolLength).toString('utf8').replace(/\0/g, '');
    offset += symbolLength;
    
    // Read URI
    const uriLength = data.readUInt32LE(offset);
    offset += 4;
    const uri = data.slice(offset, offset + uriLength).toString('utf8').replace(/\0/g, '');

    // Fetch JSON metadata from URI
    if (uri && uri.startsWith('http')) {
      try {
        const response = await fetch(uri);
        const jsonMetadata = await response.json();
        return {
          name: name || jsonMetadata.name,
          symbol: symbol || jsonMetadata.symbol,
          image: jsonMetadata.image,
          description: jsonMetadata.description,
          external_url: jsonMetadata.external_url,
          attributes: jsonMetadata.attributes
        };
      } catch (err) {
        console.log(`Failed to fetch JSON metadata from ${uri}`);
      }
    }

    return { name, symbol, uri };
  } catch (error) {
    console.log(`Failed to fetch Metaplex metadata for ${mint}`);
    return {};
  }
};

export const fetchTokenPrice = async (mint: string): Promise<TokenPriceInfo | null> => {
  const cached = tokenPriceCache.get(mint);
  if (cached && (Date.now() - cached.timestamp) < PRICE_CACHE_TTL) {
    return cached.price;
  }

  try {
    // Using Jupiter Price API (free)
    const response = await fetch(`https://price.jup.ag/v4/price?ids=${mint}`);
    const data = await response.json();
    
    if (data.data && data.data[mint]) {
      const priceData: TokenPriceInfo = {
        price_usd: data.data[mint].price,
        // Jupiter API might not have all these fields, adjust accordingly
      };
      
      tokenPriceCache.set(mint, { price: priceData, timestamp: Date.now() });
      return priceData;
    }
  } catch (error) {
    console.log(`Failed to fetch price for ${mint} from Jupiter`);
  }

  // Try alternative price sources or return null
  return null;
};

export const detectProtocol = (signature: string): string => {
  // TODO: check comon protocols via a map of addresses and return protocol name
  return "Unknown";
};

export const determineTransactionType = (
  tokenTxs: TokenTransaction[],
  swapActivity: SwapActivity | null,
  solChange: number
): "SIMPLE_TRANSFER" | "TOKEN_TRADE" | "COMPLEX_SWAP" | "DEFI_INTERACTION" => {
  if (swapActivity) {
    return swapActivity.type === "TOKEN_SWAP" ? "COMPLEX_SWAP" : "DEFI_INTERACTION";
  }
  if (tokenTxs.length > 0) {
    return "TOKEN_TRADE";
  }
  if (Math.abs(solChange) > 0) {
    return "SIMPLE_TRANSFER";
  }
  return "DEFI_INTERACTION";
};

export const calculateRiskLevel = (
  tokenTxs: TokenTransaction[],
  totalUsdValue: number
): "LOW" | "MEDIUM" | "HIGH" => {
  // Risk factors
  let riskScore = 0;
  
  // Large USD value = higher risk
  if (totalUsdValue > 10000) riskScore += 3;
  else if (totalUsdValue > 1000) riskScore += 2;
  else if (totalUsdValue > 100) riskScore += 1;
  
  // New/unknown tokens = higher risk
  const unknownTokens = tokenTxs.filter(tx => !tx.token_metadata.price || tx.token_metadata.price === 0);
  riskScore += unknownTokens.length;
  
  // Multiple token interactions = higher risk
  if (tokenTxs.length > 2) riskScore += 1;
  
  if (riskScore >= 4) return "HIGH";
  if (riskScore >= 2) return "MEDIUM";
  return "LOW";
};

export const detectTradingPatterns = (
  tokenTxs: TokenTransaction[],
  txDetails: TransactionDetails
): string[] => {
  const patterns: string[] = [];
  
  // Pattern detection logic
  if (tokenTxs.length > 1) {
    patterns.push("MULTI_TOKEN_TRADE");
  }
  
  if (tokenTxs.some(tx => tx.is_new_position)) {
    patterns.push("NEW_POSITION");
  }
  
  if (txDetails.solChange < -1) {
    patterns.push("LARGE_SOL_SPEND");
  }
  
  const buyCount = tokenTxs.filter(tx => tx.action === "BUY").length;
  const sellCount = tokenTxs.filter(tx => tx.action === "SELL").length;
  
  if (buyCount > 0 && sellCount > 0) {
    patterns.push("BUY_SELL_MIX");
  } else if (buyCount > sellCount) {
    patterns.push("ACCUMULATION");
  } else if (sellCount > buyCount) {
    patterns.push("DISTRIBUTION");
  }
  
  return patterns;
};

export const formatTokenAmount = (amount: number, decimals: number): string => {
  if (amount >= 1e9) {
    return (amount / 1e9).toFixed(2) + "B";
  } else if (amount >= 1e6) {
    return (amount / 1e6).toFixed(2) + "M";
  } else if (amount >= 1e3) {
    return (amount / 1e3).toFixed(2) + "K";
  } else {
    return amount.toFixed(Math.min(4, decimals));
  }
};