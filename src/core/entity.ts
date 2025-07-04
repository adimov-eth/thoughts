import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex } from '@noble/hashes/utils';
import { encFrameHeader } from '../codec/rlp';
import { verifyAggregate } from '../crypto/bls';
import {
  Address,
  Command,
  EntityState,
  EntityTx,
  Frame,
  FrameHeader,
  Hanko,
  Hex,
  Quorum,
  Replica
} from '../types';

export const hashFrameHeader = (h: FrameHeader): Hex =>
  ('0x' + bytesToHex(keccak_256(encFrameHeader(h)))) as Hex;

const sortTx = (a: EntityTx, b: EntityTx) =>
  a.nonce !== b.nonce ? (a.nonce < b.nonce ? -1 : 1)
  : a.sig  !== b.sig ? (a.sig  < b.sig  ? -1 : 1)
  : 0;

const sharesOf = (addr: Address, q: Quorum) => {
  const member = q.members.find(m => m.address === addr);
  return member ? member.shares : 0n;
}

const power = (sigs: Record<string, string>, q: Quorum) =>
  Object.keys(sigs).reduce((sum, a) => sum + sharesOf(a as Address, q), 0n);

const thresholdReached = (sigs: Record<string, string>, q: Quorum) =>
  power(sigs, q) >= q.threshold;

/* ──────────── domain logic: chat ──────────── */
export const applyTx = (
  st: EntityState, tx: EntityTx
): EntityState => {
  if (tx.kind !== 'chat') throw new Error('unknown tx kind');
  const signerAddress = tx.sig; // This is incorrect, need to recover from sig
  const rec = st.signerRecords[signerAddress];
  if (!rec) throw new Error('unknown signer');
  if (tx.nonce !== rec.nonce) throw new Error('bad nonce');

  const signerRecords = {
    ...st.signerRecords,
    [signerAddress]: { nonce: rec.nonce + 1n },
  };

  const chatMessage = { from: signerAddress, msg: tx.data.message, ts: Date.now() };

  return {
    ...st,
    signerRecords,
    domainState: {
      ...st.domainState,
      chat: [...st.domainState.chat, chatMessage],
    },
  };
};

export const execFrame = (
  prevState: EntityState, txs: EntityTx[], header: FrameHeader
): Frame => {
  const ordered = txs.slice().sort(sortTx);
  let state = prevState;
  for (const tx of ordered) state = applyTx(state, tx);

  // This is not how postStateRoot is calculated. This is a placeholder.
  const postStateRoot = bytesToHex(keccak_256(JSON.stringify(state)));

  return {
    height: header.height,
    timestamp: BigInt(Date.now()),
    header,
    txs: ordered,
    postStateRoot,
  };
};

/* ──────────── replica FSM ──────────── */
export const applyCommand = (rep: Replica, cmd: Command): Replica => {
  switch (cmd.type) {
    case 'addTx':
      return {
        ...rep,
        state: {
          ...rep.state,
          mempool: [...rep.state.mempool, cmd.tx],
        }
      };

    case 'proposeFrame': {
      if (rep.state.proposal || !rep.state.mempool.length) return rep;
      // Proposer logic to be implemented
      return rep;
    }

    case 'signFrame': {
      if (!rep.state.proposal) return rep;
      // Signature verification logic to be implemented
      return rep;
    }

    case 'commitFrame': {
      if (!rep.state.proposal) return rep;
      if (hashFrameHeader(cmd.frame.header) !== hashFrameHeader(rep.state.proposal.header)) return rep;
      if (!thresholdReached(rep.state.proposal.sigs, rep.state.quorum))
        return rep;
      if (!process.env.DEV_SKIP_SIGS) {
        const pubs = rep.state.quorum.members.map(m => m.address);
        if (!verifyAggregate(cmd.hanko, hashFrameHeader(cmd.frame.header), pubs as any))
          throw new Error('invalid hanko');
      }
      const newState: EntityState = {
        ...rep.state,
        height: cmd.frame.height,
        mempool: [],
        proposal: undefined,
      };
      return {
        ...rep,
        state: newState,
      };
    }
    default: return rep;
  }
};
