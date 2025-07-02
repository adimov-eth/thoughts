import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { applyConsensus, Frame, EntityRoot, Quorum } from '../src/core/consensus.js'
import { asEntityId, asSignerId, asHeight } from '../src/types/brands.js'
import { bls12_381 as bls } from '@noble/curves/bls12-381'

const signerA = asSignerId('a')
const signerB = asSignerId('b')
const signerC = asSignerId('c')

const skA = bls.utils.randomPrivateKey();
const skB = bls.utils.randomPrivateKey();
const skC = bls.utils.randomPrivateKey();

const quorum: Quorum = {
  members: [signerA, signerB, signerC],
  pubKeys: {
    [signerA]: bls.getPublicKey(skA),
    [signerB]: bls.getPublicKey(skB),
    [signerC]: bls.getPublicKey(skC),
  },
  weights: { [signerA]:1, [signerB]:1, [signerC]:1 },
  threshold: 2,
}

const baseFrame: Frame = {
  height: asHeight(1n),
  postState: new Uint8Array([9]),
  prevRoot: new Uint8Array([0]),
  proposer: signerA,
  sig: bls.sign(new Uint8Array([9]), skA),
}

function startRoot(): EntityRoot {
  return { id: asEntityId('ent'), quorum, signerRecords:{ [signerA]:{nonce:0}, [signerB]:{nonce:0}, [signerC]:{nonce:0} } }
}

describe('consensus aggregation', () => {
  it('commit payload deterministic regardless of vote order', () =>
    fc.assert(
      fc.property(
        fc.shuffledSubarray([signerB, signerC], {minLength:2}),
        fc.shuffledSubarray([signerB, signerC], {minLength:2}),
        (o1, o2) => {
          let r = applyConsensus(startRoot(), { type:'PROPOSE_FRAME', frame: baseFrame });
          let st = r.next;
          let c1: Uint8Array | undefined;
          for (const s of o1) {
            const sk = s === signerB ? skB : skC;
            const res = applyConsensus(st, { type:'SIGN_FRAME', signer: s, sig: bls.sign(baseFrame.postState, sk), nonce: 1 });
            if (res.outbox.length) c1 = res.outbox[0].payload;
            st = res.next;
          }

          r = applyConsensus(startRoot(), { type:'PROPOSE_FRAME', frame: baseFrame });
          st = r.next;
          let c2: Uint8Array | undefined;
          for (const s of o2) {
            const sk = s === signerB ? skB : skC;
            const res = applyConsensus(st, { type:'SIGN_FRAME', signer: s, sig: bls.sign(baseFrame.postState, sk), nonce: 1 });
            if (res.outbox.length) c2 = res.outbox[0].payload;
            st = res.next;
          }

          expect(c1).toBeDefined();
          expect(c2).toBeDefined();
          expect(c1).toStrictEqual(c2);
        }
      ),
      { numRuns: 5 }
    ))
})
