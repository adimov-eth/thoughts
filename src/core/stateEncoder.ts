import type {
  EntityState,
  Input,
  Command,
  EntityTx,
} from "../types";
import type { Input as RlpInput } from "rlp";

/**
 * Encode a Command for RLP
 */
export const encodeCommand = (cmd: Command): RlpInput => {
  switch (cmd.type) {
    case "importEntity":
      return ["importEntity", encodeEntityState(cmd.snapshot)];
    case "addTx":
      return ["addTx", encodeEntityTx(cmd.tx)];
    case "proposeFrame":
      return [
        "proposeFrame",
        [
          cmd.header.entityId,
          cmd.header.height.toString(),
          cmd.header.memRoot,
          cmd.header.prevStateRoot,
          cmd.header.proposer,
        ],
      ];
    case "signFrame":
      return ["signFrame", cmd.sig];
    case "commitFrame":
      return [
        "commitFrame",
        [
          [
            cmd.frame.header.entityId,
            cmd.frame.header.height.toString(),
            cmd.frame.header.memRoot,
            cmd.frame.header.prevStateRoot,
            cmd.frame.header.proposer,
          ],
          cmd.frame.txs.map(encodeEntityTx),
          cmd.frame.timestamp.toString(),
          cmd.frame.postStateRoot,
        ],
        cmd.hanko,
      ];
    case "attachReplica":
      return ["attachReplica", encodeEntityState(cmd.snapshot)];
    case "detachReplica":
      return ["detachReplica"];
  }
};

/**
 * Encode an EntityTx for RLP
 */
export const encodeEntityTx = (tx: EntityTx): RlpInput => {
  return [tx.kind, JSON.stringify(tx.data), tx.nonce.toString(), tx.from, tx.sig];
};

/**
 * Encode an Input for RLP
 */
export const encodeInput = (input: Input): RlpInput => {
  const [signerIdx, entityId, cmd] = input;
  return [signerIdx, entityId, encodeCommand(cmd)];
};

/**
 * Convert EntityState to RLP-encodable format
 */
export const encodeEntityState = (state: EntityState): RlpInput => {
  // Convert quorum to RLP format
  const quorumMembers = state.quorum.members.map((m) => [
    m.address,
    m.shares.toString(),
    m.pubKey || "",
  ]);

  const quorum = [state.quorum.threshold.toString(), quorumMembers];

  // Convert signerRecords to array format
  const signerRecords = Object.entries(state.signerRecords).map(
    ([address, record]) => [address, record.nonce.toString()],
  );

  // Convert mempool transactions
  const mempool = state.mempool.map((tx) => [
    tx.kind,
    JSON.stringify(tx.data), // Simple encoding for unknown data
    tx.nonce.toString(),
    tx.from,
    tx.sig,
  ]);

  // Convert proposal if exists
  const proposal = state.proposal
    ? [
        [
          state.proposal.header.entityId,
          state.proposal.header.height.toString(),
          state.proposal.header.memRoot,
          state.proposal.header.prevStateRoot,
          state.proposal.header.proposer,
        ],
        Object.entries(state.proposal.sigs).map(([addr, sig]) => [addr, sig]),
      ]
    : [];

  // Return RLP-encodable array
  return [
    state.height.toString(),
    quorum,
    signerRecords,
    JSON.stringify(state.domainState), // Simple encoding for unknown domain state
    mempool,
    proposal,
  ] as RlpInput;
};
