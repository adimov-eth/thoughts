import { describe, it, expect } from "vitest";
import { hashFrame } from "../src/core/hash";
import { keccak_256 as keccak } from "@noble/hashes/sha3";
import { encFrameForSigning } from "../src/codec/rlp";
import { mkFrame, mkFrameHeader } from "./helpers/frame";
import { applyServerFrame } from "../src/core/reducer";
import type {
  ServerState,
  ServerInput,
  Address,
  EntityTx,
} from "../src/types";
import { createChatTx } from "./helpers/tx";

describe("Entity-level state machine", () => {
  const signer1 = "0x0000000000000000000000000000000000000001" as Address;
  const signer2 = "0x0000000000000000000000000000000000000002" as Address;
  const now = () => 1234567890n;

  it("hashFrame matches keccak256(RLP(header ‖ txs))", () => {
    const header = mkFrameHeader();
    const txs: EntityTx[] = [
      createChatTx(signer1, "hello", 1n),
      createChatTx(signer2, "world", 1n),
    ];

    const hash = hashFrame(header, txs);
    const direct = keccak(encFrameForSigning(header, txs));

    expect(Buffer.from(hash)).toEqual(Buffer.from(direct));
  });

  it("rejects duplicate SIGN from same signer", async () => {
    const state: ServerState = new Map();
    const entityState = {
      height: 0n,
      quorum: {
        threshold: 2n,
        members: [
          { address: signer1, shares: 1n },
          { address: signer2, shares: 1n },
        ],
      },
      signerRecords: {
        [signer1]: { nonce: 0n },
        [signer2]: { nonce: 0n },
      },
      domainState: { chat: [] },
      mempool: [createChatTx(signer1, "hello", 1n)],
      proposal: {
        header: mkFrameHeader({ proposer: signer1 }),
        sigs: {},
      },
    };

    state.set("0:chat", { attached: true, state: entityState });
    state.set("1:chat", { attached: true, state: entityState });

    // First signature
    const sign1: ServerInput = {
      inputId: "sign-1",
      frameId: 1,
      timestamp: now(),
      inputs: [[0, "chat", { type: "signFrame", sig: signer1 + "sig1" }]],
    };

    const { next: state1 } = applyServerFrame(state, sign1, now);
    const replica1 = state1.get("0:chat")!;
    expect(Object.keys(replica1.state.proposal!.sigs)).toHaveLength(1);

    // Duplicate signature from same signer
    const sign2: ServerInput = {
      inputId: "sign-2",
      frameId: 2,
      timestamp: now(),
      inputs: [[0, "chat", { type: "signFrame", sig: signer1 + "sig2" }]],
    };

    const { next: state2 } = applyServerFrame(state1, sign2, now);
    const replica2 = state2.get("0:chat")!;

    // Should still have only one signature
    expect(Object.keys(replica2.state.proposal!.sigs)).toHaveLength(1);
    expect(replica2.state.proposal!.sigs[signer1]).toBe(signer1 + "sig1");
  });

  it("accepts signatures from different signers", async () => {
    const state: ServerState = new Map();
    const entityState = {
      height: 0n,
      quorum: {
        threshold: 2n,
        members: [
          { address: signer1, shares: 1n },
          { address: signer2, shares: 1n },
        ],
      },
      signerRecords: {
        [signer1]: { nonce: 0n },
        [signer2]: { nonce: 0n },
      },
      domainState: { chat: [] },
      mempool: [createChatTx(signer1, "hello", 1n)],
      proposal: {
        header: mkFrameHeader({ proposer: signer1 }),
        sigs: {},
      },
    };

    state.set("0:chat", { attached: true, state: entityState });
    state.set("1:chat", { attached: true, state: entityState });

    // Signatures from different signers
    const signs: ServerInput = {
      inputId: "signs",
      frameId: 1,
      timestamp: now(),
      inputs: [
        [0, "chat", { type: "signFrame", sig: signer1 + "sig1" }],
        [1, "chat", { type: "signFrame", sig: signer2 + "sig2" }],
      ],
    };

    const { next } = applyServerFrame(state, signs, now);
    const replica = next.get("0:chat")!;

    // Should have both signatures
    expect(Object.keys(replica.state.proposal!.sigs)).toHaveLength(2);
    expect(replica.state.proposal!.sigs[signer1]).toBe(signer1 + "sig1");
    expect(replica.state.proposal!.sigs[signer2]).toBe(signer2 + "sig2");
  });
});
