import { verifyAggregate as verifyAggregateBls, verifySync as verifyBls } from "../crypto/bls";
import { computeInputsRoot, computeServerRoot, hashFrame, computeMemRoot } from "./hash";
import type {
  Address,
  Command,
  EntityState,
  EntityTx,
  Replica,
  ServerInput,
  ServerFrame,
  ServerState,
} from "../types";
import type { Hex } from "../types";

const bytesToHex = (b: Uint8Array): Hex =>
  ("0x" + Buffer.from(b).toString("hex")) as Hex;
const hexToBytes = (h: Hex) => Uint8Array.from(Buffer.from(h.slice(2), "hex"));

// Constants
const MAX_MEMPOOL = 10_000;
const MAX_U64 = 2n ** 64n - 1n;

/* ── helpers ─────────────────────────────────────────────── */

function effectiveWeight(
  sigs: Record<Address, string>,
  quorum: EntityState["quorum"],
): bigint {
  const set = new Set(Object.keys(sigs));
  return quorum.members.reduce(
    (tot, m) => (set.has(m.address) ? tot + m.shares : tot),
    0n,
  );
}

// RFC Y-2 canonical ordering: nonce → from → kind → index
const canonicalTxOrder = (a: EntityTx, b: EntityTx) => {
  if (a.nonce !== b.nonce) return a.nonce < b.nonce ? -1 : 1;
  if (a.from !== b.from) return a.from.localeCompare(b.from);
  if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
  return 0; // preserve original order for same nonce/from/kind
};

const sortTxs = (mempool: EntityTx[]) => [...mempool].sort(canonicalTxOrder);

/* ── command-level reducer ───────────────────────────────── */
export const applyCommand = (
  rep: Replica,
  cmd: Command,
  _now: () => bigint,
): Replica => {
  if (
    !rep.attached &&
    cmd.type !== "attachReplica" &&
    cmd.type !== "importEntity"
  )
    return rep;
  const s = rep.state;

  switch (cmd.type) {
    /* ---------- replica management -------------------------------- */
    case "importEntity":
      return { attached: true, state: cmd.snapshot };
    case "attachReplica":
      return { attached: true, state: cmd.snapshot };
    case "detachReplica":
      return { ...rep, attached: false };

    /* ---------- add transaction ------------------------------------ */
    case "addTx": {
      // Validate nonce bounds
      if (cmd.tx.nonce === 0n || cmd.tx.nonce > MAX_U64) return rep;
      
      // Extract signer address from tx.from field (already recovered)
      const signer = cmd.tx.from;
      const last = s.signerRecords[signer]?.nonce ?? 0n;
      
      // Check nonce monotonicity
      if (cmd.tx.nonce !== last + 1n) return rep; // nonce gap or reuse – reject
      
      // Check mempool size limit
      if (s.mempool.length >= MAX_MEMPOOL) return rep;
      
      // Check for duplicate nonce in mempool
      const hasDuplicateNonce = s.mempool.some(
        tx => tx.from === signer && tx.nonce === cmd.tx.nonce
      );
      if (hasDuplicateNonce) return rep;
      
      return {
        ...rep,
        state: {
          ...s,
          signerRecords: {
            ...s.signerRecords,
            [signer]: { nonce: cmd.tx.nonce },
          },
          mempool: [...s.mempool, cmd.tx],
        },
      };
    }

    /* ---------- proposer builds frame ----------------------------- */
    case "proposeFrame": {
      // cheap sanity: header must match local deterministic calc
      const mempoolSorted = sortTxs(s.mempool);
      
      // Verify memRoot matches the sorted mempool
      const expectedMemRoot = bytesToHex(computeMemRoot(mempoolSorted));
      if (cmd.header.memRoot !== expectedMemRoot) {
        return rep; // invalid memRoot
      }
      
      return {
        ...rep,
        state: { ...s, proposal: { header: cmd.header, sigs: {} } },
      };
    }

    /* ---------- quorum member signs ------------------------------- */
    case "signFrame": {
      if (!s.proposal) return rep;
      
      // Verify BLS signature and identify signer
      const proposalHash = hashFrame(s.proposal.header, []);
      
      // Find which quorum member signed this
      let signer: Address | null = null;
      for (const member of s.quorum.members) {
        if (!member.pubKey) continue; // Skip members without BLS pubkey
        
        try {
          const pubKeyBytes = Buffer.from(member.pubKey.slice(2), "hex");
          const verified = verifyBls(proposalHash, cmd.sig as Hex, pubKeyBytes);
          if (verified) {
            signer = member.address;
            break;
          }
        } catch {
          // Invalid pubkey or signature format, continue to next member
        }
      }
      
      if (!signer) return rep; // Invalid signature or signer not in quorum
      if (s.proposal.sigs[signer]) return rep; // dup vote
      return {
        ...rep,
        state: {
          ...s,
          proposal: {
            header: s.proposal.header,
            sigs: { ...s.proposal.sigs, [signer]: cmd.sig },
          },
        },
      };
    }

    /* ---------- commit frame -------------------------------------- */
    case "commitFrame": {
      const prop = s.proposal;
      if (!prop) return rep;
      /* frame-hash integrity (R-1) */
      const expectHash = hashFrame(prop.header, cmd.frame.txs);
      if (
        "0x" + Buffer.from(expectHash).toString("hex") !==
        prop.header.memRoot
      )
        return rep;
      /* quorum weight */
      const weight = effectiveWeight(prop.sigs, s.quorum);
      if (weight < s.quorum.threshold) return rep;
      
      /* BLS aggregate verification */
      // Extract public keys of signers who participated
      const signerAddresses = Object.keys(prop.sigs) as Address[];
      const memberPubKeys = s.quorum.members
        .filter(m => signerAddresses.includes(m.address) && m.pubKey)
        .map(m => hexToBytes(m.pubKey as Hex));
      
      if (memberPubKeys.length === 0) {
        throw new Error("No public keys found for aggregate verification");
      }
      
      if (!verifyAggregateBls(cmd.hanko as Hex, bytesToHex(expectHash), memberPubKeys)) {
        return rep;
      }
      /* done – accept frame */
      const newState: EntityState = {
        ...(cmd.frame.postStateRoot
          ? // domainState lives elsewhere; we trust postStateRoot here
            { ...s, mempool: [], height: cmd.frame.header.height }
          : s), // placeholder
      };
      return { ...rep, state: newState };
    }
  }
};

/* ── top-level reducer for one batch (ServerInput) ───────── */
export const applyServerFrame = (
  st: ServerState,
  batch: ServerInput,
  now: () => bigint,
): { next: ServerState; frame: ServerFrame } => {
  /* signerIdx mapping rule (A1) - optimized */
  const signerIds = [...new Set(batch.inputs.map((i) => i[0]))].sort(
    (a, b) => a - b,
  );
  const signerOrder = new Map(signerIds.map((id, i) => [id, i]));
  for (const [idx] of batch.inputs) {
    if (idx !== signerOrder.get(idx)) {
      throw new Error(`signerIdx mismatch: expected ${signerOrder.get(idx)}, got ${idx}`);
    }
  }

  const next = new Map(st);
  for (const [idx, id, cmd] of batch.inputs) {
    const key = `${idx}:${id}` as const;
    let rep = next.get(key);
    if (!rep) {
      // Create a default replica if it doesn't exist
      const defaultState: EntityState = {
        height: 0n,
        quorum: { threshold: 1n, members: [] },
        signerRecords: {},
        domainState: {},
        mempool: [],
      };
      rep = { attached: false, state: defaultState };
    }
    next.set(key, applyCommand(rep, cmd, now));
  }

  const frame: ServerFrame = {
    frameId: batch.frameId,
    timestamp: batch.timestamp,
    root: bytesToHex(computeServerRoot(next)),
    inputsRoot: bytesToHex(computeInputsRoot(batch.inputs)),
  };
  return { next, frame };
};
