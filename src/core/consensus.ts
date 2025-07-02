import { bls } from '@noble/bls12-381';           // audited, zero‑dep
import {
  EntityId, SignerId, FrameHeight, asSignerId
} from '../types/brands.js';
import { OutMsg } from './router.js';

/* ---------- domain types ---------- */

export interface Frame {
  readonly height: FrameHeight;
  readonly stateRoot: Uint8Array;      // Merkle root of entity state
  readonly prevRoot: Uint8Array;       // parent frame root
  readonly proposer: SignerId;
  readonly sig: Uint8Array;            // proposer's own sig (always first)
}

export interface EntityRoot {
  readonly id: EntityId;
  readonly quorum: Quorum;
  readonly lastCommitted?: Frame;
  readonly proposed?: Frame;                          // when voting
  readonly votes?: Record<SignerId, Uint8Array>;      // signerId → sig
}

export interface Quorum {
  readonly members: readonly SignerId[];
  readonly threshold: number;   // ≤ members.length
}

/* ---------- command union ---------- */

export type Command =
  | { type: 'PROPOSE_FRAME'; frame: Frame }
  | { type: 'SIGN_FRAME';    signer: SignerId; sig: Uint8Array }
  | { type: 'COMMIT_FRAME';  aggSig: Uint8Array; aggPub: Uint8Array };

/* ---------- reducer result ---------- */

export interface ConsensusResult {
  readonly next: EntityRoot;
  readonly outbox: readonly OutMsg[];
}

/* ---------- reducer implementation ---------- */

export function applyConsensus (
  root: EntityRoot,
  cmd: Command
): ConsensusResult {

  switch (cmd.type) {
    /* -- proposer step ---------------------------------------------------- */
    case 'PROPOSE_FRAME': {
      if (root.proposed) {
        throw new Error('entity already voting');
      }
      const votes: Record<SignerId, Uint8Array> = {
        [cmd.frame.proposer]: cmd.frame.sig
      };
      const outbox: OutMsg[] =
        root.quorum.threshold === 1                       // fast‑path
          ? [{ ...mkCommitMsg(root.id, cmd.frame, votes) }]
          : mkSignRequests(root.id, cmd.frame, root.quorum.members);

      return {
        next: { ...root, proposed: cmd.frame, votes },
        outbox
      };
    }

    /* -- voter step ------------------------------------------------------- */
    case 'SIGN_FRAME': {
      if (!root.proposed) throw new Error('no active proposal');
      const votes = { ...root.votes, [cmd.signer]: cmd.sig };

      // Check threshold
      if (Object.keys(votes).length < root.quorum.threshold) {
        return { next: { ...root, votes }, outbox: [] };
      }

      // aggregate sigs deterministically
      const orderedIds = Object.keys(votes).sort();
      const sigs = orderedIds.map(id => votes[asSignerId(id)]);
      const aggSig = bls.aggregateSignatures(sigs);    // order matters
      const pubKeys = orderedIds.map(id => bls.getPublicKey(id));
      const aggPub = bls.aggregatePublicKeys(pubKeys);

      const commit = mkCommitMsg(root.id, root.proposed, votes);

      return {
        next: { ...root, votes, proposed: root.proposed },
        outbox: [commit]
      };
    }

    /* -- finalisation step ------------------------------------------------ */
    case 'COMMIT_FRAME': {
      if (!root.proposed) throw new Error('no proposal to commit');
      // verify aggregated signature deterministically
      const ok = bls.verify(
        cmd.aggSig,
        root.proposed.stateRoot,
        cmd.aggPub
      );
      if (!ok) throw new Error('agg sig verification failed');

      return {
        next: {
          ...root,
          lastCommitted: root.proposed,
          proposed: undefined,
          votes: undefined
        },
        outbox: []
      };
    }
  }
}

/* ---------- helpers ----------------------------------------------------- */

function mkSignRequests (
  entity: EntityId,
  frame: Frame,
  members: readonly SignerId[]
): OutMsg[] {
  return members
    .filter(id => id !== frame.proposer)
    .map((id, i) => ({
      from: entity,
      to: entity,
      seq: i,
      payload: encodeSignRequest(frame)
    }));
}

function mkCommitMsg (
  entity: EntityId,
  frame: Frame,
  votes: Record<SignerId, Uint8Array>
): OutMsg {
  return {
    from: entity,
    to: entity,             // broadcast in this toy model
    seq: Number(frame.height),
    payload: encodeCommit(frame, votes)
  };
}

/* stub encoders – replace with RLP‑or‑SCALE in real code */
const encodeSignRequest = (f: Frame) => f.stateRoot;
const encodeCommit      = (_: Frame, __: Record<string, Uint8Array>) =>
  new Uint8Array([0x01]);