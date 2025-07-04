import type {
  Replica,
  EntityState,
  Quorum,
  Address,
} from "../../src/core/types";

export const createBlankReplica = (): Replica => {
  const quorum: Quorum = {
    threshold: 1n,
    members: [
      {
        address: "0x0000000000000000000000000000000000000001" as Address,
        shares: 1n,
      },
    ],
  };

  const state: EntityState = {
    height: 0n,
    quorum,
    signerRecords: {
      "0x0000000000000000000000000000000000000001": { nonce: 0n },
    },
    domainState: { chat: [] },
    mempool: [],
  };

  return {
    attached: true,
    state,
  };
};
