import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex } from "@noble/hashes/utils";
import { encFrameForSigning } from "../codec/rlp";
import { verifyAggregate } from "../crypto/bls";
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
  Replica,
} from "../types";

export const hashFrameForSigning = (h: FrameHeader, txs: EntityTx[]): Hex =>
  ("0x" + bytesToHex(keccak_256(encFrameForSigning(h, txs)))) as Hex;
export const hashFrame = (f: Frame): Hex =>
  ("0x" + bytesToHex(keccak_256(encFrameForSigning(f.header, f.txs)))) as Hex;

// Sorting Rule (Y-2): nonce → from (signerId) → kind → insertion-index (implicit)
const sortTx = (a: EntityTx, b: EntityTx) => {
  if (a.nonce !== b.nonce) return a.nonce < b.nonce ? -1 : 1;
  if (a.from !== b.from) return a.from < b.from ? -1 : 1;
  if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
  return 0;
};

const sharesOf = (addr: Address, q: Quorum) => {
  const member = q.members.find((m) => m.address === addr);
  return member ? member.shares : 0n;
};

const power = (sigs: Record<string, string>, q: Quorum) =>
  Object.keys(sigs).reduce((sum, a) => sum + sharesOf(a as Address, q), 0n);

const thresholdReached = (sigs: Record<string, string>, q: Quorum) =>
  power(sigs, q) >= q.threshold;

/* ─────────���── domain logic: chat ──────────── */
export const applyTx = (st: EntityState, tx: EntityTx): EntityState => {
  if (tx.kind !== "chat") throw new Error("unknown tx kind");
  // Note: tx.from is now available, assuming it's recovered from the signature
  const rec = st.signerRecords[tx.from];
  if (!rec) throw new Error("unknown signer");
  if (tx.nonce !== rec.nonce) throw new Error("bad nonce");

  const signerRecords = {
    ...st.signerRecords,
    [tx.from]: { nonce: rec.nonce + 1n },
  };

  const chatMessage = {
    from: tx.from,
    msg: (tx.data as any).message,
    ts: Date.now(),
  };

  const domainState = st.domainState as { chat: any[] };
  return {
    ...st,
    signerRecords,
    domainState: {
      ...domainState,
      chat: [...domainState.chat, chatMessage],
    },
  };
};

export const execFrame = (
  prevState: EntityState,
  txs: EntityTx[],
  header: FrameHeader,
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
    case "addTx":
      // It's assumed that the `from` field is populated before calling this.
      return {
        ...rep,
        state: {
          ...rep.state,
          mempool: [...rep.state.mempool, cmd.tx],
        },
      };

    case "proposeFrame": {
      if (rep.state.proposal || !rep.state.mempool.length) return rep;
      // Proposer logic to be implemented
      return rep;
    }

    case "signFrame": {
      if (!rep.state.proposal) return rep;
      // Signature verification logic to be implemented
      return rep;
    }

    case "commitFrame": {
      if (!rep.state.proposal) return rep;
      const proposedBlock = hashFrameForSigning(
        rep.state.proposal.header,
        cmd.frame.txs,
      );
      if (
        hashFrameForSigning(cmd.frame.header, cmd.frame.txs) !== proposedBlock
      )
        return rep;
      if (!thresholdReached(rep.state.proposal.sigs, rep.state.quorum))
        return rep;
      // DEV_SKIP_SIGS is intended for unit tests only. When set to 'true'
      // signature verification is skipped to speed up test suites.
      const skip = process.env.DEV_SKIP_SIGS === "true";
      if (skip) {
        console.warn("Signature verification disabled via DEV_SKIP_SIGS");
      } else {
        const pubs = rep.state.quorum.members.map((m) => m.address);
        if (!verifyAggregate(cmd.hanko, proposedBlock, pubs as any))
          throw new Error("invalid hanko");
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
    default:
      return rep;
  }
};
