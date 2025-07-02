import { bls12_381 as bls } from '@noble/curves/bls12-381';
import { rlp }              from './codec.js';
import {
  EntityId, SignerId, FrameHeight, asSignerId, asHeight
} from '../types/brands.js';
import { OutMsg }   from './router.js';

export interface Frame {
  readonly height:  FrameHeight;
  readonly stateRoot: Uint8Array;
  readonly prevRoot: Uint8Array;
  readonly proposer: SignerId;
  readonly sig:      Uint8Array;
}

export interface Quorum {
  readonly members:   readonly SignerId[];
  readonly pubKeys:   Record<SignerId, Uint8Array>;
  readonly threshold: number;
}

export interface EntityRoot {
  readonly id: EntityId;
  readonly quorum: Quorum;
  readonly lastCommitted?: Frame;
  readonly proposed?: Frame;
  readonly votes?: Record<SignerId, Uint8Array>;
}

export type Command =
  | { type: 'PROPOSE_FRAME'; frame: Frame }
  | { type: 'SIGN_FRAME';    signer: SignerId; sig: Uint8Array }
  | { type: 'COMMIT_FRAME';  frame: Frame; aggSig: Uint8Array; aggPub: Uint8Array };

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
      if (root.proposed) throw new Error('entity already voting');
      const votes: Record<SignerId, Uint8Array> = {
        [cmd.frame.proposer]: cmd.frame.sig,
      };

      if (root.quorum.threshold === 1) {
        const { aggSig, aggPub } = aggregate(root.quorum, votes);
        const commitMsg = mkCommit(root.id, cmd.frame, aggSig, aggPub);
        return {
          next: {
            ...root,
            lastCommitted: cmd.frame,
            proposed: undefined,
            votes: undefined,
          },
          outbox: [commitMsg],
        };
      }

      const outbox = mkSignRequests(root.id, cmd.frame, root.quorum.members);
      return { next: { ...root, proposed: cmd.frame, votes }, outbox };
    }

    case 'SIGN_FRAME': {
      if (!root.proposed) throw new Error('no active proposal');
      if (root.votes?.[cmd.signer]) return { next: root, outbox: [] };

      const votes = { ...(root.votes ?? {}), [cmd.signer]: cmd.sig };

      if (Object.keys(votes).length < root.quorum.threshold) {
        return { next: { ...root, votes }, outbox: [] };
      }

      const { aggSig, aggPub } = aggregate(root.quorum, votes);
      const commitMsg = mkCommit(root.id, root.proposed, aggSig, aggPub);
      return { next: { ...root, votes }, outbox: [commitMsg] };
    }

    case 'COMMIT_FRAME': {
      if (!root.proposed) throw new Error('no proposal pending commit');
      if (cmpFrame(root.proposed, cmd.frame) !== 0) {
        throw new Error('commit frame mismatch');
      }

      const ok = bls.verify(cmd.aggSig, cmd.frame.stateRoot, cmd.aggPub);
      if (!ok) throw new Error('agg sig verification failed');

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
  }
}

function mkSignRequests(
  entity: EntityId,
  frame: Frame,
  members: readonly SignerId[]
): OutMsg[] {
  let seq = 0n;
  return members
    .filter((id) => id !== frame.proposer)
    .map((id) => ({
      from: frame.proposer as unknown as EntityId,
      to: id as unknown as EntityId,
      seq: seq++,
      payload: encodeSignReq(frame),
    }));
}

function mkCommit(
  entity: EntityId,
  frame: Frame,
  aggSig: Uint8Array,
  aggPub: Uint8Array
): OutMsg {
  return {
    from: frame.proposer as unknown as EntityId,
    to: entity,
    seq: frame.height,
    payload: encodeCommit({ frame, aggSig, aggPub }),
  };
}

function aggregate(
  quorum: Quorum,
  votes: Record<SignerId, Uint8Array>
): { aggSig: Uint8Array; aggPub: Uint8Array } {
  const orderedIds = Object.keys(votes).sort();
  const sigs = orderedIds.map((id) => votes[asSignerId(id)]);
  const pubs = orderedIds.map((id) => quorum.pubKeys[asSignerId(id)]);
  return {
    aggSig: bls.aggregateSignatures(sigs),
    aggPub: bls.aggregatePublicKeys(pubs),
  };
}

const cmpFrame = (a: Frame, b: Frame) => Number(a.height - b.height);

/* ---------- codec ---------- */

type SignReqPayload = Frame;
type CommitPayload = { frame: Frame; aggSig: Uint8Array; aggPub: Uint8Array };

const encodeSignReq = (f: SignReqPayload) =>
  rlp.enc([
    f.height.toString(),
    f.stateRoot,
    f.prevRoot,
    f.proposer,
    f.sig,
  ]);

const encodeCommit = (c: CommitPayload) =>
  rlp.enc([encodeFrame(c.frame), c.aggSig, c.aggPub]);

const encodeFrame = (f: Frame) =>
  rlp.enc([
    f.height.toString(),
    f.stateRoot,
    f.prevRoot,
    f.proposer,
    f.sig,
  ]);

export const decodeCommit = (bytes: Uint8Array): CommitPayload => {
  const [frameBuf, aggSig, aggPub] = rlp.dec(bytes) as [
    Uint8Array,
    Uint8Array,
    Uint8Array,
  ];
  return {
    frame: decodeFrame(frameBuf),
    aggSig: new Uint8Array(aggSig),
    aggPub: new Uint8Array(aggPub),
  };
};

const decodeFrame = (b: Uint8Array): Frame => {
  const [h, stateRoot, prevRoot, proposer, sig] = rlp.dec(b) as [
    string,
    Uint8Array,
    Uint8Array,
    string,
    Uint8Array,
  ];
  return {
    height: asHeight(BigInt(h)),
    stateRoot: new Uint8Array(stateRoot),
    prevRoot: new Uint8Array(prevRoot),
    proposer: asSignerId(proposer),
    sig: new Uint8Array(sig),
  };
};
