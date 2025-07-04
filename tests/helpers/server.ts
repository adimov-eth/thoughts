import type {
  ServerState,
  Replica,
  Quorum,
  EntityState,
  Address,
} from "../../src/core/types";

export const createServer = (): ServerState => {
  const signers = [
    "0x0000000000000000000000000000000000000001" as Address,
    "0x0000000000000000000000000000000000000002" as Address,
    "0x0000000000000000000000000000000000000003" as Address,
  ];

  const quorum: Quorum = {
    threshold: 2n,
    members: signers.map((address) => ({ address, shares: 1n })),
  };

  const state: EntityState = {
    height: 0n,
    quorum,
    signerRecords: Object.fromEntries(signers.map((s) => [s, { nonce: 0n }])),
    domainState: { chat: [] },
    mempool: [],
  };

  const replica: Replica = {
    attached: true,
    state,
  };

  const serverState = new Map<`${number}:${string}`, Replica>();
  signers.forEach((s, i) => {
    serverState.set(`${i}:chat`, { ...replica });
  });

  return serverState;
};
