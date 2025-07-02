import { Frame } from "./types.js";
import { hasQuorum, Vote } from "./quorum.js";
import { verifyAggregate } from "@xln/core/bls.js";

export interface ConsensusState {
  /** The latest committed frame (or null at genesis). */
  head: Frame | null;
  /** Votes collected for the *next* frame. */
  votes: Vote[];
  /** Last accepted nonce per signer (replay protection). */
  nonceMap: Record<string, number>;
}

export interface SignFrameCmd {
  type: "SIGN_FRAME";
  frame: Frame;
  signer: string;
  sig: Uint8Array;
  nonce: number;
}

export interface CommitFrameCmd {
  type: "COMMIT_FRAME";
  frame: Frame;
  aggregateSig: Uint8Array;
}

export type Command = SignFrameCmd | CommitFrameCmd;

export interface ReducerCtx {
  weightMap: Record<string, number>;
  threshold: number;
}

/** Pure reducer – **no** I/O, timers, randomness. */
export function reducer(
  state: ConsensusState,
  cmd: Command,
  ctx: ReducerCtx,
): ConsensusState {
  switch (cmd.type) {
    case "SIGN_FRAME": {
      const v: Vote = {
        signer: cmd.signer,
        sig: cmd.sig,
        nonce: cmd.nonce,
        msg: cmd.frame.postState,
      };
      return { ...state, votes: [...state.votes, v] };
    }

    case "COMMIT_FRAME": {
      // 1) verify the aggregated signature first
      if (
        !verifyAggregate(
          cmd.aggregateSig,
          [cmd.frame.postState],
          state.votes.map((v) => new Uint8Array(Buffer.from(v.signer, "hex"))),
        )
      )
        return state; // invalid sig – ignore

      // 2) check weighted quorum + replay‑safe
      const ok = hasQuorum({
        votes: state.votes,
        weightMap: ctx.weightMap,
        threshold: ctx.threshold,
        nonceMap: state.nonceMap,
      });
      if (!ok) return state;

      // 3) commit: update nonce map, clear votes, advance head
      const updatedNonce = { ...state.nonceMap };
      for (const v of state.votes) updatedNonce[v.signer] = v.nonce;

      return { head: cmd.frame, votes: [], nonceMap: updatedNonce };
    }
  }
}
