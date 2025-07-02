import { reducer } from "../src/core/consensus.js";
import { encodeRlp } from "@xln/core/encodeRlp";
import { sha256 } from "@xln/core/hash";
import { bls12_381 as bls } from "@noble/curves/bls12-381";
import type { Frame } from "../src/core/types.js";
import type { SignFrameCmd, CommitFrameCmd } from "../src/core/consensus.js";

const threshold = 2; // 2/3 majority
const genesisRoot = sha256(new Uint8Array([0]));

function makeFrame(id: number, prev: Uint8Array): Frame {
  const post = sha256(encodeRlp([id, prev]));
  return { id, prevState: prev, postState: post as any, txs: [] };
}

describe("all replicas converge deterministically", () => {
  it("converges", () => {
    let a = { head: null, votes: [], nonceMap: {} };
    let b = { ...a };
    let c = { ...a };

    const f1 = makeFrame(1, genesisRoot);
    const privAlice = bls.utils.randomPrivateKey();
    const privBob = bls.utils.randomPrivateKey();
    const pubAlice = bls.getPublicKey(privAlice);
    const pubBob = bls.getPublicKey(privBob);
    const idAlice = Buffer.from(pubAlice).toString("hex");
    const idBob = Buffer.from(pubBob).toString("hex");
    const weightMap = { [idAlice]: 1, [idBob]: 1 };
    const ctx = { weightMap, threshold };
    const sigAlice = bls.sign(f1.postState, privAlice);
    const signCmd: SignFrameCmd = {
      type: "SIGN_FRAME",
      frame: f1,
      signer: idAlice,
      sig: sigAlice,
      nonce: 1,
    };
    a = reducer(a, signCmd, ctx);
    b = reducer(b, signCmd, ctx);
    c = reducer(c, signCmd, ctx);

    const sigBob = bls.sign(f1.postState, privBob);
    const signCmd2: SignFrameCmd = {
      type: "SIGN_FRAME",
      frame: f1,
      signer: idBob,
      sig: sigBob,
      nonce: 1,
    };
    a = reducer(a, signCmd2, ctx);
    b = reducer(b, signCmd2, ctx);
    c = reducer(c, signCmd2, ctx);

    const agg = bls.aggregateSignatures([sigAlice, sigBob]);
    const commitCmd: CommitFrameCmd = {
      type: "COMMIT_FRAME",
      frame: f1,
      aggregateSig: agg,
    };
    const sA = reducer(a, commitCmd, ctx);
    const sB = reducer(b, commitCmd, ctx);
    const sC = reducer(c, commitCmd, ctx);

    expect(sA.head?.postState).toEqual(f1.postState);
    expect(sB).toEqual(sA);
    expect(sC).toEqual(sA);
  });
});
