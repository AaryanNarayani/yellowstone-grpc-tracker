# Yellowstone gRPC Solana Indexer/Tracker
[![Star this repo](https://img.shields.io/badge/⭐_Star-This_repo-lightgrey?style=flat)](https://github.com/AaryanNarayani/yellowstone-grpc-tracker)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Solana](https://img.shields.io/badge/Solana-9945FF?style=flat&logo=solana&logoColor=white)](https://solana.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) 

Real-time wallet activity tracking on Solana, powered by **Yellowstone gRPC**.
Subscribe to any wallet and stream what it does as it happens.

### Actions it tracks:

* **System Program Actions** (SOL transfers, account creations, etc.)
* **SPL Token Program Activity** (token transfers/mints/burns)
* **DeFi Actions**: `type: "SWAP" | "BUY" | "SELL"`

> **TODO:** Protocol identification (Orca/Raydium/Jupiter/Tensor/MagicEden, …) with richer decode

---

## Highlights

* Zero polling: live gRPC stream
* Tracks multiple wallets concurrently
* Pluggable “classifier” so you can improve decoding over time

---

## Preview
<img width="720" height="520" alt="Wallet-Tracker-Preview" src="https://pub-15fcb55ecf4f42e689cf4e7e1a4737ad.r2.dev/tracker_preview.jpeg" />



## Requirements

* Node.js 18+
* A Yellowstone gRPC endpoint (e.g. Triton One / RPC Pool, QuickNode, Helius, eRPC, or self-hosted)

---

## Steps to Clone & Run

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

