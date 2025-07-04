import { describe, it, expect, beforeEach } from "vitest";
import { applyServerFrame } from "../src/core/reducer";
import type {
  ServerState,
  ServerInput,
  EntityTx,
  Address,
} from "../src/types";
import { createChatTx } from "./helpers/tx";

describe("Mis-routing and Proposer Timeout Tests", () => {
  const signer1 = {
    address: "0x0000000000000000000000000000000000000001" as Address,
  };
  const signer2 = {
    address: "0x0000000000000000000000000000000000000002" as Address,
  };
  const now = () => BigInt(Date.now());

  let state: ServerState;

  beforeEach(() => {
    state = new Map();
    const entityState = {
      height: 0n,
      quorum: {
        threshold: 2n,
        members: [
          { address: signer1.address, shares: 1n },
          { address: signer2.address, shares: 1n },
        ],
      },
      signerRecords: {
        [signer1.address]: { nonce: 0n },
        [signer2.address]: { nonce: 0n },
      },
      domainState: { chat: [] },
      mempool: [],
    };

    // Both signers have replicas
    state.set("0:chat", { attached: true, state: { ...entityState } });
    state.set("1:chat", { attached: true, state: { ...entityState } });
  });

  describe("Mis-routed Input Handling", () => {
    it("should handle transaction sent to wrong signer index", async () => {
      const tx = createChatTx(signer1.address, "hello", 1n);

      // First, send to wrong signer (index 1 instead of 0)
      const wrongInput: ServerInput = {
        inputId: "wrong-1",
        frameId: 1,
        timestamp: now(),
        inputs: [[1, "chat", { type: "addTx", tx }]],
      };

      const { next: state1 } = applyServerFrame(state, wrongInput, now);

      // Transaction should be rejected because signer doesn't match
      const replica1 = state1.get("1:chat")!;
      expect(replica1.state.mempool).toHaveLength(0);

      // Now send to correct signer
      const correctInput: ServerInput = {
        inputId: "correct-1",
        frameId: 2,
        timestamp: now(),
        inputs: [[0, "chat", { type: "addTx", tx }]],
      };

      const { next: state2 } = applyServerFrame(state1, correctInput, now);

      // Transaction should be accepted
      const replica0 = state2.get("0:chat")!;
      expect(replica0.state.mempool).toHaveLength(1);
      expect(replica0.state.mempool[0]).toEqual(tx);
    });
  });

  describe("Proposer Rotation", () => {
    it("should allow any signer to propose identical tx list after timeout", async () => {
      // Add transactions to mempool
      const tx1 = createChatTx(signer1.address, "hello", 1n);
      const tx2 = createChatTx(signer2.address, "world", 1n);

      const addTxInput: ServerInput = {
        inputId: "add-txs",
        frameId: 1,
        timestamp: now(),
        inputs: [
          [0, "chat", { type: "addTx", tx: tx1 }],
          [1, "chat", { type: "addTx", tx: tx2 }],
        ],
      };

      const { next: stateWithTxs } = applyServerFrame(state, addTxInput, now);

      // First proposer creates proposal
      const proposal1: ServerInput = {
        inputId: "propose-1",
        frameId: 2,
        timestamp: now(),
        inputs: [
          [
            0,
            "chat",
            {
              type: "proposeFrame",
              header: {
                entityId: "chat",
                height: 1n,
                memRoot: "0xdeadbeef", // Would be computed from sorted txs
                prevStateRoot: "0x00",
                proposer: signer1.address,
              },
            },
          ],
        ],
      };

      const { next: stateWithProposal } = applyServerFrame(
        stateWithTxs,
        proposal1,
        now,
      );

      // Both replicas should have the proposal
      const replica0 = stateWithProposal.get("0:chat")!;
      const replica1 = stateWithProposal.get("1:chat")!;

      expect(replica0.state.proposal).toBeDefined();
      expect(replica1.state.proposal).toBeDefined();
      expect(replica0.state.proposal?.header.proposer).toBe(signer1.address);

      // After timeout, second signer can re-propose with same tx list
      // In real implementation, this would check TIMEOUT_PROPOSAL_MS
      const proposal2: ServerInput = {
        inputId: "propose-2",
        frameId: 3,
        timestamp: now() + 31000n, // After 31 second timeout
        inputs: [
          [
            1,
            "chat",
            {
              type: "proposeFrame",
              header: {
                entityId: "chat",
                height: 1n,
                memRoot: "0xdeadbeef", // Same hash for same tx list
                prevStateRoot: "0x00",
                proposer: signer2.address,
              },
            },
          ],
        ],
      };

      // This would be accepted after timeout in full implementation
      const { next: stateWithNewProposal } = applyServerFrame(
        stateWithProposal,
        proposal2,
        now,
      );

      // The new proposal would override the old one
      const finalReplica = stateWithNewProposal.get("1:chat")!;
      expect(finalReplica.state.proposal?.header.proposer).toBe(
        signer2.address,
      );
    });
  });

  describe("Deterministic Transaction Selection", () => {
    it("should select same transactions in same order across replicas", async () => {
      // Add multiple transactions
      const txs = [
        createChatTx(signer2.address, "msg1", 1n),
        createChatTx(signer1.address, "msg2", 1n),
        createChatTx(signer2.address, "msg3", 2n),
        createChatTx(signer1.address, "msg4", 2n),
      ];

      const addTxInput: ServerInput = {
        inputId: "add-multiple",
        frameId: 1,
        timestamp: now(),
        inputs: [
          [1, "chat", { type: "addTx", tx: txs[0] }],
          [0, "chat", { type: "addTx", tx: txs[1] }],
          [1, "chat", { type: "addTx", tx: txs[2] }],
          [0, "chat", { type: "addTx", tx: txs[3] }],
        ],
      };

      const { next } = applyServerFrame(state, addTxInput, now);

      // Both replicas should have all transactions
      const replica0 = next.get("0:chat")!;
      const replica1 = next.get("1:chat")!;

      expect(replica0.state.mempool).toHaveLength(4);
      expect(replica1.state.mempool).toHaveLength(4);

      // When sorted, both should produce same order
      // Order should be: nonce 1 signer1, nonce 1 signer2, nonce 2 signer1, nonce 2 signer2
      const sorted0 = [...replica0.state.mempool].sort((a, b) => {
        if (a.nonce !== b.nonce) return a.nonce < b.nonce ? -1 : 1;
        const aFrom = a.sig.slice(0, 42);
        const bFrom = b.sig.slice(0, 42);
        return aFrom < bFrom ? -1 : 1;
      });

      const sorted1 = [...replica1.state.mempool].sort((a, b) => {
        if (a.nonce !== b.nonce) return a.nonce < b.nonce ? -1 : 1;
        const aFrom = a.sig.slice(0, 42);
        const bFrom = b.sig.slice(0, 42);
        return aFrom < bFrom ? -1 : 1;
      });

      // Both replicas should produce identical sorted order
      expect(sorted0).toEqual(sorted1);
      expect(sorted0[0].sig.slice(0, 42)).toBe(signer1.address);
      expect(sorted0[1].sig.slice(0, 42)).toBe(signer2.address);
    });
  });
});
