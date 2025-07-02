import { bls } from '@noble/bls12-381';
import {
  EntityId,
  SignerId,
  FrameHeight,
  asSignerId,
} from '../types/brands.js';
import { OutMsg } from './router.js';

export interface Frame {
  readonly height: FrameHeight;
  readonly stateRoot: Uint8Array;
  readonly prevRoot: Uint8Array;
  readonly proposer: SignerId;
  readonly sig: Uint8Array;
}

export interface EntityRoot {
  readonly id: EntityId;
  readonly quorum: Quorum;
  readonly lastCommitted?: Frame;
  readonly proposed?: Frame;
  readonly votes?: Record<SignerId, Uint8Array>;
}

export interface Quorum {
  readonly members: readonly SignerId[];
  readonly threshold: number;
}

export type Command =
  | { type: 'PROPOSE_FRAME'; frame: Frame }
  | { type: 'SIGN_FRAME'; signer: SignerId; sig: Uint8Array }
  | { type: 'COMMIT_FRAME'; aggSig: Uint8Array; aggPub: Uint8Array };

export interface ConsensusResult {
  readonly next: EntityRoot;
  readonly outbox: readonly OutMsg[];
}

export function applyConsensus(
  root: EntityRoot,
  cmd: Command
): ConsensusResult {
  switch (cmd.type) {
    case 'PROPOSE_FRAME': {
      if (root.proposed) {
        throw new Error('entity already voting');
      }
      const votes: Record<SignerId, Uint8Array> = {
        [cmd.frame.proposer]: cmd.frame.sig,
      };
      const outbox: OutMsg[] =
        root.quorum.threshold === 1
          ? [{ ...mkCommitMsg(root.id, cmd.frame, votes) }]
          : mkSignRequests(root.id, cmd.frame, root.quorum.members);
      return { next: { ...root, proposed: cmd.frame, votes }, outbox };
    }
    case 'SIGN_FRAME': {
      if (!root.proposed) throw new Error('no active proposal');
      const votes = { ...root.votes, [cmd.signer]: cmd.sig };
      if (Object.keys(votes).length < root.quorum.threshold) {
        return { next: { ...root, votes }, outbox: [] };
      }
      const orderedIds = Object.keys(votes).sort();
      const sigs = orderedIds.map((id) => votes[asSignerId(id)]);
      const aggSig = bls.aggregateSignatures(sigs);
      const pubKeys = orderedIds.map((id) => bls.getPublicKey(id));
      const aggPub = bls.aggregatePublicKeys(pubKeys);
      const commit = mkCommitMsg(root.id, root.proposed!, votes);
      return { next: { ...root, votes, proposed: root.proposed }, outbox: [commit] };
    }
    case 'COMMIT_FRAME': {
      if (!root.proposed) throw new Error('no proposal to commit');
      const ok = bls.verify(cmd.aggSig, root.proposed.stateRoot, cmd.aggPub);
      if (!ok) throw new Error('agg sig verification failed');
      return {
        next: { ...root, lastCommitted: root.proposed, proposed: undefined, votes: undefined },
        outbox: [],
      };
    }
  }
}

function mkSignRequests(
  entity: EntityId,
  frame: Frame,
  members: readonly SignerId[]
): OutMsg[] {
  return members
    .filter((id) => id !== frame.proposer)
    .map((id, i) => ({
      from: frame.proposer,
      to: id,
      seq: i,
      payload: encodeSignRequest(frame),
    }));
}

function mkCommitMsg(
  entity: EntityId,
  frame: Frame,
  votes: Record<SignerId, Uint8Array>
): OutMsg {
  return {
    from: frame.proposer,
    to: entity,
    seq: Number(frame.height),
    payload: encodeCommit(frame, votes),
  };
}

const encodeSignRequest = (f: Frame) => f.stateRoot;
const encodeCommit = (_: Frame, __: Record<string, Uint8Array>) => new Uint8Array([0x01]);
