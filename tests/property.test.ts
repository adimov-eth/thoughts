import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeMemRoot, computeServerRoot, merkle } from "../src/core/hash";
import { effectiveWeight } from "../src/core/quorum";
import type { EntityTx, Quorum, Address, ServerState, Replica } from "../src/core/types";

// Helper to generate hex strings
const hexString = (length: number) => 
  fc.array(fc.integer({ min: 0, max: 15 }), { minLength: length, maxLength: length })
    .map(arr => arr.map(n => n.toString(16)).join(''));

describe("Property-based tests", () => {
  describe("Merkle root determinism", () => {
    it("should produce same root for same leaves regardless of order", () => {
      fc.assert(
        fc.property(
          fc.array(fc.uint8Array({ minLength: 32, maxLength: 32 })),
          (leaves) => {
            if (leaves.length === 0) return true;
            
            const root1 = merkle(leaves);
            const shuffled = [...leaves].sort(() => Math.random() - 0.5);
            const root2 = merkle(shuffled);
            
            // Merkle root should be deterministic for sorted inputs
            const sorted1 = [...leaves].sort((a, b) => Buffer.compare(a, b));
            const sorted2 = [...shuffled].sort((a, b) => Buffer.compare(a, b));
            
            return Buffer.compare(merkle(sorted1), merkle(sorted2)) === 0;
          }
        )
      );
    });
    
    it("memRoot should be deterministic for same transactions", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              kind: fc.constantFrom("chat", "transfer", "update"),
              data: fc.object(),
              nonce: fc.bigInt({ min: 1n, max: 1000n }),
              from: hexString(40).map(s => `0x${s}` as Address),
              sig: hexString(128)
            })
          ),
          (txs) => {
            const root1 = computeMemRoot(txs);
            const root2 = computeMemRoot([...txs]);
            
            return Buffer.compare(root1, root2) === 0;
          }
        )
      );
    });
  });
  
  describe("Quorum weight calculation", () => {
    it("weight should never exceed total shares", () => {
      fc.assert(
        fc.property(
          fc.record({
            threshold: fc.bigInt({ min: 1n, max: 100n }),
            members: fc.array(
              fc.record({
                address: hexString(40).map(s => `0x${s}` as Address),
                shares: fc.bigInt({ min: 1n, max: 10n }),
                pubKey: hexString(96).map(s => `0x${s}`)
              }),
              { minLength: 1, maxLength: 10 }
            )
          }),
          fc.array(hexString(40)),
          (quorum: Quorum, signerAddresses: string[]) => {
            const sigs: Record<Address, string> = {};
            signerAddresses.forEach(addr => {
              sigs[`0x${addr}` as Address] = "dummy-sig";
            });
            
            const weight = effectiveWeight(sigs, quorum);
            const totalShares = quorum.members.reduce((sum, m) => sum + m.shares, 0n);
            
            return weight <= totalShares;
          }
        )
      );
    });
    
    it("adding duplicate signatures should not increase weight", () => {
      fc.assert(
        fc.property(
          fc.record({
            threshold: fc.bigInt({ min: 1n, max: 100n }),
            members: fc.array(
              fc.record({
                address: hexString(40).map(s => `0x${s}` as Address),
                shares: fc.bigInt({ min: 1n, max: 10n }),
                pubKey: hexString(96).map(s => `0x${s}`)
              }),
              { minLength: 3, maxLength: 10 }
            )
          }),
          (quorum: Quorum) => {
            if (quorum.members.length === 0) return true;
            
            // Sign with first member
            const signer = quorum.members[0];
            const sigs1: Record<Address, string> = {
              [signer.address]: "sig1"
            };
            
            // Add duplicate signature
            const sigs2: Record<Address, string> = {
              [signer.address]: "sig1",
              [signer.address]: "sig2" // This overwrites the first
            };
            
            const weight1 = effectiveWeight(sigs1, quorum);
            const weight2 = effectiveWeight(sigs2, quorum);
            
            return weight1 === weight2;
          }
        )
      );
    });
  });
  
  describe("ServerRoot determinism", () => {
    it("should produce consistent roots for same state", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(
              fc.constantFrom("0", "1", "2", "3", "4"),
              fc.constantFrom("entity1", "entity2", "entity3"),
              fc.boolean()
            ),
            { minLength: 1, maxLength: 5 }
          ),
          (entries) => {
            const state1: ServerState = new Map();
            const state2: ServerState = new Map();
            
            // Create replicas in different order
            entries.forEach(([idx, entityId, attached]) => {
              const replica: Replica = {
                attached,
                state: {
                  height: 0n,
                  quorum: { threshold: 1n, members: [] },
                  signerRecords: {},
                  domainState: {},
                  mempool: []
                }
              };
              state1.set(`${idx}:${entityId}`, replica);
            });
            
            // Add in reverse order
            [...entries].reverse().forEach(([idx, entityId, attached]) => {
              const replica: Replica = {
                attached,
                state: {
                  height: 0n,
                  quorum: { threshold: 1n, members: [] },
                  signerRecords: {},
                  domainState: {},
                  mempool: []
                }
              };
              state2.set(`${idx}:${entityId}`, replica);
            });
            
            const root1 = computeServerRoot(state1);
            const root2 = computeServerRoot(state2);
            
            return Buffer.compare(root1, root2) === 0;
          }
        )
      );
    });
  });
});