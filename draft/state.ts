import {
  Replica, Command, EntityState, Frame, Transaction, Quorum,
  ProposedFrame, Address, Hex, TS
} from './types';
import { sha256 } from '@noble/hashes/sha256';

/** Canonical frame hash = keccak256(RLP(frameHeader + txs + state)). */
export const hashFrame = (f: Frame<any>): Hex =>
  ('0x' + Buffer.from(keccak(encodeFrame(f))).toString('hex')) as Hex;

/* ──────────── helpers ──────────── */
const sortTx = (a: Transaction, b: Transaction) =>
  a.nonce !== b.nonce ? (a.nonce < b.nonce ? -1 : 1)
  : a.from  !== b.from ? (a.from  < b.from  ? -1 : 1)
  : a.kind.localeCompare(b.kind);

const signerPower = (addr: Address, q: Quorum) => q.members[addr]?.shares ?? 0;

export const powerCollected = (sigs: Map<Address, Hex>, q: Quorum) =>
  [...sigs.keys()].reduce((sum, a) => sum + signerPower(a, q), 0);

const thresholdReached = (sigs: Map<Address, Hex>, q: Quorum) =>
  powerCollected(sigs, q) >= q.threshold;

/* ──────────── pure state transforms ──────────── */
export const applyTx = (
  st: EntityState,
  tx: Transaction,
  ts: TS,
): EntityState => {
  if (tx.kind !== 'chat') throw new Error('unknown tx kind');

  const rec = st.quorum.members[tx.from];
  if (!rec) throw new Error(`unknown signer ${tx.from}`);
  if (tx.nonce !== rec.nonce) throw new Error('bad nonce');

  const members = {
    ...st.quorum.members,
    [tx.from]: { nonce: rec.nonce + 1n, shares: rec.shares },
  };

  return {
    quorum: { ...st.quorum, members },
    chat : [...st.chat, { from: tx.from, msg: tx.body.message, ts }],
  };
};

export const execFrame = (
  prev: Frame<EntityState>,
  txs: Transaction[],
  ts : TS,
): Frame<EntityState> => {
  const ordered = txs.slice().sort(sortTx);
  let st = prev.state;
  for (const tx of ordered) st = applyTx(st, tx, ts);
  return { height: prev.height + 1n, ts, txs: ordered, state: st };
};

/* ──────────── replica FSM ──────────── */
export const applyCommand = (rep: Replica, cmd: Command): Replica => {
  switch (cmd.type) {
    case 'ADD_TX':
      return { ...rep, mempool: [...rep.mempool, cmd.tx] };

    case 'PROPOSE': {
      if (rep.isAwaitingSignatures || rep.mempool.length === 0) return rep;

      const frame = execFrame(rep.last, rep.mempool, cmd.ts);
      const proposal: ProposedFrame<EntityState> = {
        ...frame,
        hash: hashFrame(frame),
        sigs: new Map([[rep.proposer, '0x00']]), // proposer self‑sig placeholder
      };

      return {
        ...rep,
        isAwaitingSignatures: true,
        mempool : [],
        proposal,
      };
    }

    case 'SIGN': {
      if (!rep.isAwaitingSignatures || !rep.proposal) return rep;
      if (cmd.frameHash !== rep.proposal.hash) return rep;
      if (!rep.last.state.quorum.members[cmd.signer]) return rep; // non‑member
      if (rep.proposal.sigs.has(cmd.signer)) return rep;          // dup

      const sigs = new Map(rep.proposal.sigs).set(cmd.signer, cmd.sig);
      return { ...rep, proposal: { ...rep.proposal, sigs } };
    }

    case 'COMMIT': {
      if (!rep.isAwaitingSignatures || !rep.proposal) return rep;
      if (hashFrame(cmd.frame) !== rep.proposal.hash) return rep;
      if (!thresholdReached(rep.proposal.sigs, rep.last.state.quorum)) return rep;
      // aggregate‑sig check (can be bypassed via DEV_SKIP_SIGS env)
      if (!process.env.DEV_SKIP_SIGS) {
        const pubs = Object.keys(rep.last.state.quorum.members);
        if (!verifyAggregate(cmd.hanko, hashFrame(cmd.frame), pubs))
          throw new Error('invalid hanko');
      }

      return {
        ...rep,
        isAwaitingSignatures: false,
        last    : cmd.frame,
        proposal: undefined,
      };
    }

    default:
      return rep;
  }
};
