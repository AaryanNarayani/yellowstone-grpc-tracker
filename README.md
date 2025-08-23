# Yellowstone gRPC Solana Indexer/Tracker

Real-time wallet activity tracking on Solana, powered by **Yellowstone gRPC**.
Subscribe to any wallet and stream what it does as it happens.

### Actions it performs:

* **System Program Actions** (SOL transfers, account creations, etc.)
* **SPL Token Program Activity** (token transfers/mints/burns)
* **DeFi Actions**: `type: "SWAP" | "BUY" | "SELL"`

> **TODO:** Protocol identification (Orca/Raydium/Jupiter/Tensor/MagicEden, …) with richer decode

---

## ✨ Highlights

* Zero polling: live gRPC stream
* Tracks multiple wallets concurrently
* Pluggable “classifier” so you can improve decoding over time

---

## 🧰 Requirements

* Node.js 18+
* A Yellowstone gRPC endpoint (e.g. Triton One / RPC Pool, QuickNode, Helius, eRPC, or self-hosted)

---

## 🚀 Steps to Clone & Run

```bash
# 1) Clone
git clone https://github.com/AaryanNarayani/yellowstone-grpc-tracker.git
cd yellowstone-grpc-tracker

# 2) Install
npm install

# 3) Configure
cp .env.example .env
# edit .env with your endpoint + rpc url

# 4) Add addresses to track (index.ts)
const trackedAccounts: string[] = [
  "address_1_publickey",
  "address_2_publickey",
  "address_3_publickey",
  ...
];

# 5) Start the tracker (Node)
npm run dev
```

**`.env.example`**

```
YELLOWSTONE_ENDPOINT=https://<host>:<port>
RPC_URL=<get one from alchemy or similar rpc providers>
```

---

## 🤝 Contributing

PRs welcome! Please open an issue.

---