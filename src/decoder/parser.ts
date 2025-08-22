import { PublicKey } from "@solana/web3.js";
import { SubscribeUpdate } from "@triton-one/yellowstone-grpc";
import { ParsedAccountData } from "./types";
import { processTransaction } from "./classify";
import { displayBasicUpdate } from "./logger";

export const handleDataParsing = (data: SubscribeUpdate): void => {
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
    const slot = data.account.slot;

    if (!account.pubkey || !account.lamports || !account.owner) {
      console.log("⚠️ Incomplete account data, skipping...");
      return;
    }

    const pubkey = new PublicKey(account.pubkey).toString();
    const txnSignature = account.txnSignature
      ? Buffer.from(account.txnSignature).toString("base64")
      : null;

    const ownerPubkey = new PublicKey(account.owner).toString();
    const isSystemProgram = ownerPubkey === "11111111111111111111111111111111";
    const owner = isSystemProgram ? "System Program" : ownerPubkey;

    const lamportsSOL = parseInt(account.lamports) / 1_000_000_000;

    const parsedData: ParsedAccountData = {
      pubkey,
      lamports: account.lamports,
      lamportsSOL: Math.round(lamportsSOL * 1_000_000) / 1_000_000,
      owner,
      executable: account.executable,
      rentEpoch: account.rentEpoch,
      slot: slot || "Unknown",
      txnSignature: txnSignature || "N/A",
      timestamp: data.createdAt?.toISOString() || new Date().toISOString(),
    };

    if (txnSignature) {
      processTransaction(parsedData);
    } else {
      displayBasicUpdate(parsedData);
    }
  } catch (error) {
    console.error("❌ Error parsing account data:", error);
  }
};