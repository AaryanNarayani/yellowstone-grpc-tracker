import { SubscribeRequest, CommitmentLevel } from "@triton-one/yellowstone-grpc";

export function watchAccounts(accounts: string[]): SubscribeRequest {
  return {
    accounts: {
      "specific_accounts": { // Watch specific accounts
        account: [
          ...accounts
        ],
        owner: [],
        filters: []
      }
    },
    slots: {},
    transactions: {},
    transactionsStatus: {},
    entry: {},
    blocks: {},
    blocksMeta: {},
    commitment: CommitmentLevel.CONFIRMED,
    accountsDataSlice: [],
  };
}

