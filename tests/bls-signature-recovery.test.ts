import { describe, it, expect } from "vitest";
import { applyCommand } from "../src/core/reducer";
import { randomPriv, pub, addr } from "../src/crypto/bls";
import { bls12_381 as bls } from "@noble/curves/bls12-381";
import { hashFrame } from "../src/core/hash";
import type { Replica, Command, Quorum, Address, FrameHeader } from "../src/core/types";

describe("BLS signature recovery in signFrame", () => {
  it("identifies signer from BLS signature", async () => {
    // Generate BLS keypairs for quorum members
    const priv1 = randomPriv();
    const pub1 = pub(priv1);
    const addr1 = addr(pub1);
    
    const priv2 = randomPriv();
    const pub2 = pub(priv2);
    const addr2 = addr(pub2);
    
    const priv3 = randomPriv();
    const pub3 = pub(priv3);
    const addr3 = addr(pub3);
    
    // Create quorum with BLS pubkeys
    const quorum: Quorum = {
      threshold: 2n,
      members: [
        { 
          address: addr1, 
          shares: 1n,
          pubKey: "0x" + Buffer.from(pub1).toString("hex")
        },
        { 
          address: addr2, 
          shares: 1n,
          pubKey: "0x" + Buffer.from(pub2).toString("hex")
        },
        { 
          address: addr3, 
          shares: 1n,
          pubKey: "0x" + Buffer.from(pub3).toString("hex")
        }
      ]
    };
    
    // Create a proposal
    const header: FrameHeader = {
      height: 1n,
      memRoot: "0x" + "00".repeat(32),
      timestamp: 123456789n,
      proposer: addr1,
      entityId: "test-entity"
    };
    
    const replica: Replica = {
      attached: true,
      state: {
        height: 0n,
        mempool: [],
        signerRecords: {},
        domainState: null,
        quorum,
        proposal: {
          header,
          sigs: {}
        }
      }
    };
    
    // Member 2 signs the proposal
    const proposalHash = hashFrame(header, []);
    const sig2 = await bls.sign(proposalHash, priv2);
    const sig2Hex = "0x" + Buffer.from(sig2).toString("hex");
    
    const signCmd: Command = {
      type: "signFrame",
      sig: sig2Hex
    };
    
    // Apply the command
    const newReplica = applyCommand(replica, signCmd, () => 123456789n);
    
    // Verify that member 2's signature was recorded
    expect(newReplica.state.proposal?.sigs[addr2]).toBe(sig2Hex);
    expect(Object.keys(newReplica.state.proposal?.sigs || {})).toHaveLength(1);
  });
  
  it("rejects invalid BLS signatures", async () => {
    const priv1 = randomPriv();
    const pub1 = pub(priv1);
    const addr1 = addr(pub1);
    
    const quorum: Quorum = {
      threshold: 1n,
      members: [
        { 
          address: addr1, 
          shares: 1n,
          pubKey: "0x" + Buffer.from(pub1).toString("hex")
        }
      ]
    };
    
    const header: FrameHeader = {
      height: 1n,
      memRoot: "0x" + "00".repeat(32),
      timestamp: 123456789n,
      proposer: addr1,
      entityId: "test-entity"
    };
    
    const replica: Replica = {
      attached: true,
      state: {
        height: 0n,
        mempool: [],
        signerRecords: {},
        domainState: null,
        quorum,
        proposal: {
          header,
          sigs: {}
        }
      }
    };
    
    // Create an invalid signature (random bytes)
    const invalidSig = "0x" + Buffer.from(randomPriv()).toString("hex").slice(0, 192);
    
    const signCmd: Command = {
      type: "signFrame",
      sig: invalidSig
    };
    
    // Apply the command - should not record the signature
    const newReplica = applyCommand(replica, signCmd, () => 123456789n);
    
    // Verify that no signature was recorded
    expect(Object.keys(newReplica.state.proposal?.sigs || {})).toHaveLength(0);
  });
  
  it("rejects signatures from non-quorum members", async () => {
    const priv1 = randomPriv();
    const pub1 = pub(priv1);
    const addr1 = addr(pub1);
    
    // Create a different keypair not in quorum
    const privOutsider = randomPriv();
    
    const quorum: Quorum = {
      threshold: 1n,
      members: [
        { 
          address: addr1, 
          shares: 1n,
          pubKey: "0x" + Buffer.from(pub1).toString("hex")
        }
      ]
    };
    
    const header: FrameHeader = {
      height: 1n,
      memRoot: "0x" + "00".repeat(32),
      timestamp: 123456789n,
      proposer: addr1,
      entityId: "test-entity"
    };
    
    const replica: Replica = {
      attached: true,
      state: {
        height: 0n,
        mempool: [],
        signerRecords: {},
        domainState: null,
        quorum,
        proposal: {
          header,
          sigs: {}
        }
      }
    };
    
    // Outsider signs the proposal
    const proposalHash = hashFrame(header, []);
    const sigOutsider = await bls.sign(proposalHash, privOutsider);
    const sigHex = "0x" + Buffer.from(sigOutsider).toString("hex");
    
    const signCmd: Command = {
      type: "signFrame",
      sig: sigHex
    };
    
    // Apply the command - should not record the signature
    const newReplica = applyCommand(replica, signCmd, () => 123456789n);
    
    // Verify that no signature was recorded
    expect(Object.keys(newReplica.state.proposal?.sigs || {})).toHaveLength(0);
  });
  
  it("handles members without BLS pubkeys", () => {
    const addr1 = "0x1234567890123456789012345678901234567890" as Address;
    
    const quorum: Quorum = {
      threshold: 1n,
      members: [
        { 
          address: addr1, 
          shares: 1n
          // No pubKey field - backwards compatibility
        }
      ]
    };
    
    const header: FrameHeader = {
      height: 1n,
      memRoot: "0x" + "00".repeat(32),
      timestamp: 123456789n,
      proposer: addr1,
      entityId: "test-entity"
    };
    
    const replica: Replica = {
      attached: true,
      state: {
        height: 0n,
        mempool: [],
        signerRecords: {},
        domainState: null,
        quorum,
        proposal: {
          header,
          sigs: {}
        }
      }
    };
    
    const signCmd: Command = {
      type: "signFrame",
      sig: "0x" + "00".repeat(96) // Any signature
    };
    
    // Apply the command - should not record since no pubkey to verify against
    const newReplica = applyCommand(replica, signCmd, () => 123456789n);
    
    // Verify that no signature was recorded
    expect(Object.keys(newReplica.state.proposal?.sigs || {})).toHaveLength(0);
  });
});
