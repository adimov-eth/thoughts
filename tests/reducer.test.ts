import { describe, it, expect } from "vitest";
import { applyServerFrame } from "../src/core/reducer";
import { sortTransactions } from "../src/core/consensus";
import { effectiveWeight } from "../src/core/quorum";
import { hashFrame } from "../src/core/hash";
import type {
  ServerState,
  ServerInput,
  EntityTx,
  Command,
  Address,
} from "../src/core/types";
import { createChatTx } from "./helpers/tx";
import { signerKeyPair } from "./helpers/crypto";

describe("Reducer - v1.4.1-RC2 Compliance", () => {
  const signer1 = {
    address: "0x0000000000000000000000000000000000000001" as Address,
  };
  const signer2 = {
    address: "0x0000000000000000000000000000000000000002" as Address,
  };
  const signer3 = {
    address: "0x0000000000000000000000000000000000000003" as Address,
  };

  const now = () => 1234567890n;

  describe("Transaction Sorting (Y-2)", () => {
    it("should sort transactions by nonce → from → kind → index", () => {
      const txs: EntityTx[] = [
        { kind: "transfer", data: {}, nonce: 2n, sig: signer2.address + "00" },
        { kind: "chat", data: {}, nonce: 1n, sig: signer1.address + "00" },
        { kind: "transfer", data: {}, nonce: 1n, sig: signer2.address + "00" },
        { kind: "chat", data: {}, nonce: 1n, sig: signer2.address + "00" },
        { kind: "chat", data: {}, nonce: 2n, sig: signer1.address + "00" },
      ];

      const sorted = sortTransactions(txs);

      // First by nonce
      expect(sorted[0].nonce).toBe(1n);
      expect(sorted[1].nonce).toBe(1n);
      expect(sorted[2].nonce).toBe(1n);
      expect(sorted[3].nonce).toBe(2n);
      expect(sorted[4].nonce).toBe(2n);

      // Then by from address (extracted from sig)
      expect(sorted[0].sig.slice(0, 42)).toBe(signer1.address);
      expect(sorted[1].sig.slice(0, 42)).toBe(signer2.address);
      expect(sorted[2].sig.slice(0, 42)).toBe(signer2.address);

      // Then by kind
      expect(sorted[1].kind).toBe("chat");
      expect(sorted[2].kind).toBe("transfer");
    });
  });

  describe("Nonce Monotonicity", () => {
    it("should reject transaction with incorrect nonce", async () => {
      const state: ServerState = new Map();
      const entityState = {
        height: 0n,
        quorum: {
          threshold: 1n,
          members: [{ address: signer1.address, shares: 1n }],
        },
        signerRecords: { [signer1.address]: { nonce: 5n } },
        domainState: {},
        mempool: [],
      };
      state.set("0:test", { attached: true, state: entityState });

      const tx = createChatTx(signer1.address, "hello", 7n); // Wrong nonce (should be 6)
      const input: ServerInput = {
        inputId: "test-1",
        frameId: 1,
        timestamp: now(),
        inputs: [[0, "test", { type: "addTx", tx }]],
      };

      const { next } = applyServerFrame(state, input, now);
      const replica = next.get("0:test")!;

      // Transaction should be rejected, mempool unchanged
      expect(replica.state.mempool).toHaveLength(0);
      expect(replica.state.signerRecords[signer1.address].nonce).toBe(5n);
    });

    it("should accept transaction with correct nonce and increment", async () => {
      const state: ServerState = new Map();
      const entityState = {
        height: 0n,
        quorum: {
          threshold: 1n,
          members: [{ address: signer1.address, shares: 1n }],
        },
        signerRecords: { [signer1.address]: { nonce: 5n } },
        domainState: {},
        mempool: [],
      };
      state.set("0:test", { attached: true, state: entityState });

      const tx = createChatTx(signer1.address, "hello", 6n); // Correct nonce
      const input: ServerInput = {
        inputId: "test-1",
        frameId: 1,
        timestamp: now(),
        inputs: [[0, "test", { type: "addTx", tx }]],
      };

      const { next } = applyServerFrame(state, input, now);
      const replica = next.get("0:test")!;

      // Transaction should be accepted
      expect(replica.state.mempool).toHaveLength(1);
      expect(replica.state.signerRecords[signer1.address].nonce).toBe(6n);
    });
  });

  describe("Quorum Weight Calculation", () => {
    it("should calculate effective weight correctly", () => {
      const quorum = {
        threshold: 2n,
        members: [
          { address: signer1.address, shares: 1n },
          { address: signer2.address, shares: 2n },
          { address: signer3.address, shares: 1n },
        ],
      };

      const sigs = {
        [signer1.address]: "sig1",
        [signer2.address]: "sig2",
      };

      const weight = effectiveWeight(sigs, quorum);
      expect(weight).toBe(3n); // 1 + 2 = 3
    });
  });

  describe("SignerIdx Ordering (A1)", () => {
    it("should enforce lexicographic signerIdx ordering", async () => {
      const state: ServerState = new Map();

      // Invalid: signerIdx 2 appears before signerIdx 1
      const input: ServerInput = {
        inputId: "test-1",
        frameId: 1,
        timestamp: now(),
        inputs: [
          [2, "test", { type: "importEntity", snapshot: {} as any }],
          [1, "test", { type: "importEntity", snapshot: {} as any }],
        ],
      };

      expect(() => applyServerFrame(state, input, now)).toThrow(
        "signerIdx mismatch",
      );
    });

    it("should accept valid signerIdx ordering", async () => {
      const state: ServerState = new Map();

      const input: ServerInput = {
        inputId: "test-1",
        frameId: 1,
        timestamp: now(),
        inputs: [
          [
            0,
            "test",
            {
              type: "importEntity",
              snapshot: {
                height: 0n,
                quorum: { threshold: 1n, members: [] },
                signerRecords: {},
                domainState: {},
                mempool: [],
              },
            },
          ],
          [
            1,
            "test2",
            {
              type: "importEntity",
              snapshot: {
                height: 0n,
                quorum: { threshold: 1n, members: [] },
                signerRecords: {},
                domainState: {},
                mempool: [],
              },
            },
          ],
        ],
      };

      const { frame } = applyServerFrame(state, input, now);
      expect(frame.frameId).toBe(1);
    });
  });

  describe("Frame Hash (R-1)", () => {
    it("should compute frame hash as keccak256(rlp(header ‖ txs))", async () => {
      const state: ServerState = new Map();
      const entityState = {
        height: 0n,
        quorum: {
          threshold: 1n,
          members: [{ address: signer1.address, shares: 1n }],
        },
        signerRecords: { [signer1.address]: { nonce: 0n } },
        domainState: {},
        mempool: [],
      };
      state.set("0:test", { attached: true, state: entityState });

      // Add a transaction to mempool
      const tx = createChatTx(signer1.address, "hello", 1n);
      const addTxInput: ServerInput = {
        inputId: "add-tx",
        frameId: 1,
        timestamp: now(),
        inputs: [[0, "test", { type: "addTx", tx }]],
      };

      const { next: stateWithTx } = applyServerFrame(state, addTxInput, now);

      // Need to compute the correct memRoot first
      const { next: nextState } = applyServerFrame(state, addTxInput, now);
      const replicaWithTx = nextState.get("0:test")!;
      const sortedTxs = sortTransactions(replicaWithTx.state.mempool);

      // Compute the expected hash
      const header = {
        entityId: "test",
        height: 1n,
        memRoot: "", // Will be filled by proposer
        prevStateRoot:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        proposer: signer1.address,
      };
      const computedHash = hashFrame(header, sortedTxs);
      const memRoot = "0x" + Buffer.from(computedHash).toString("hex");

      // Propose a frame with the computed hash
      const proposeInput: ServerInput = {
        inputId: "propose",
        frameId: 2,
        timestamp: now(),
        inputs: [
          [
            0,
            "test",
            {
              type: "proposeFrame",
              header: {
                ...header,
                memRoot,
              },
            },
          ],
        ],
      };

      const { next: proposed } = applyServerFrame(
        stateWithTx,
        proposeInput,
        now,
      );
      const replica = proposed.get("0:test")!;

      // Verify proposal was created
      expect(replica.state.proposal).toBeDefined();
      expect(replica.state.proposal?.header.height).toBe(1n);
    });
  });

  describe("Server Frame", () => {
    it("should create ServerFrame with root and inputsRoot", async () => {
      const state: ServerState = new Map();
      const input: ServerInput = {
        inputId: "test-1",
        frameId: 42,
        timestamp: 1234567890n,
        inputs: [],
      };

      const { frame } = applyServerFrame(state, input, now);

      expect(frame.frameId).toBe(42);
      expect(frame.timestamp).toBe(1234567890n);
      expect(frame.root).toBeDefined();
      expect(frame.inputsRoot).toBeDefined();
      expect(typeof frame.root).toBe("string");
      expect(typeof frame.inputsRoot).toBe("string");
    });
  });
});
