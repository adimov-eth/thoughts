import { bls12_381 as bls } from '@noble/curves/bls12-381';
import { EntityId, SignerId, FrameHeight } from '../types/brands.js';
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
  readonly votes?: Map<SignerId, Uint8Array>;
}

export interface Quorum {
  readonly members: readonly SignerId[];
  readonly pubKeys: Record<SignerId, Uint8Array>;
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
      const votes = new Map<SignerId, Uint8Array>([
        [cmd.frame.proposer, cmd.frame.sig],
      ]);

      if (root.quorum.threshold === 1) {
        return {
          next: {
            ...root,
            lastCommitted: cmd.frame,
            proposed: undefined,
            votes: undefined,
          },
          outbox: [],
        };
      }

      const outbox = mkSignRequests(
        root.id,
        cmd.frame,
        root.quorum.members
      );
      return { next: { ...root, proposed: cmd.frame, votes }, outbox };
    }
    case 'SIGN_FRAME': {
      if (!root.proposed) throw new Error('no active proposal');
      const votes = new Map(root.votes);
      if (votes.has(cmd.signer)) return { next: { ...root, votes }, outbox: [] };
      votes.set(cmd.signer, cmd.sig);
      if (votes.size < root.quorum.threshold) {
        return { next: { ...root, votes }, outbox: [] };
      }
      const orderedIds = [...votes.keys()].sort();
      const sigs = orderedIds.map((id) => votes.get(id)!);
      const aggSig = bls.aggregateSignatures(sigs);
      const aggPub = bls.aggregatePublicKeys(
        orderedIds.map((id) => root.quorum.pubKeys[id])
      );
      const commit = mkCommitMsg(root.id, root.proposed!, aggSig, aggPub);
      return { next: { ...root, votes }, outbox: [commit] };
    }
    case 'COMMIT_FRAME': {
      if (!root.proposed) throw new Error('no proposal to commit');
      const ok = bls.verify(
        cmd.aggSig,
        root.proposed.stateRoot,
        cmd.aggPub
      );
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
      from: frame.proposer as unknown as EntityId,
      to: id as unknown as EntityId,
      seq: i,
      payload: encodeSignRequest(frame),
    }));
}

function mkCommitMsg(
  entity: EntityId,
  frame: Frame,
  aggSig: Uint8Array,
  aggPub: Uint8Array
): OutMsg {
  return {
    from: frame.proposer as unknown as EntityId,
    to: entity,
    seq: Number(frame.height),
    payload: encodeCommit({ frame, aggSig, aggPub }),
  };
}

const encodeSignRequest = (f: Frame): Uint8Array => f.stateRoot;

interface CommitPayload {
  frame: Frame;
  aggSig: Uint8Array;
  aggPub: Uint8Array;
}

const encodeCommit = (c: CommitPayload): Uint8Array =>
  new Uint8Array([
    ...c.aggSig,
    ...c.aggPub,
    ...c.frame.stateRoot,
  ]);
