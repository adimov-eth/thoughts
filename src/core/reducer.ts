import { verifyAggregate as verifyAggregateBls } from '../crypto/bls'
import {
  computeInputsRoot,
  computeServerRoot,
  hashFrame,
} from './hash'
import type {
  Address,
  Command,
  EntityState,
  Frame,
  FrameHeader,
  Input,
  EntityTx,
  Replica,
  ServerInput,
  ServerFrame,
  ServerState,
} from './types'
import { concat } from 'uint8arrays'
import type { Hex } from '../types'

const bytesToHex = (b: Uint8Array): Hex =>
  ('0x' + Buffer.from(b).toString('hex')) as Hex

/* ── helpers ─────────────────────────────────────────────── */
const byNonce = (a: EntityTx, b: EntityTx) =>
  a.nonce === b.nonce ? 0 : a.nonce < b.nonce ? -1 : 1

function effectiveWeight(
  sigs: Record<Address, string>,
  quorum: EntityState['quorum'],
): bigint {
  const set = new Set(Object.keys(sigs))
  return quorum.members.reduce(
    (tot, m) => (set.has(m.address) ? tot + m.shares : tot),
    0n,
  )
}

const sortTxs = (mempool: EntityTx[]) =>
  [...mempool].sort(byNonce) // RFC Y-2 canonical ordering

/* ── command-level reducer ───────────────────────────────── */
const applyCommand = (
  rep: Replica,
  cmd: Command,
  now: () => bigint,
): Replica => {
  if (!rep.attached && cmd.type !== 'attachReplica' && cmd.type !== 'importEntity') return rep
  const s = rep.state

  switch (cmd.type) {
    /* ---------- replica management -------------------------------- */
    case 'importEntity':
      return { attached: true, state: cmd.snapshot }
    case 'attachReplica':
      return { attached: true, state: cmd.snapshot }
    case 'detachReplica':
      return { ...rep, attached: false }

    /* ---------- add transaction ------------------------------------ */
    case 'addTx': {
      const signer = cmd.tx.sig.slice(0, 42) as Address
      const last = s.signerRecords[signer]?.nonce ?? 0n
      if (cmd.tx.nonce !== last + 1n) return rep // nonce gap or reuse – reject
      return {
        ...rep,
        state: {
          ...s,
          signerRecords: { ...s.signerRecords, [signer]: { nonce: cmd.tx.nonce } },
          mempool: [...s.mempool, cmd.tx],
        },
      }
    }

    /* ---------- proposer builds frame ----------------------------- */
    case 'proposeFrame': {
      // cheap sanity: header must match local deterministic calc
      const mempoolSorted = sortTxs(s.mempool)
      const hdr: FrameHeader = {
        ...cmd.header,
        memRoot: cmd.header.memRoot, // proposer pre-filled
      }
      const checkHash = hashFrame(hdr, mempoolSorted)
      if ('0x' + Buffer.from(checkHash).toString('hex') !== cmd.header.memRoot)
        return rep // invalid proposal
      return {
        ...rep,
        state: { ...s, proposal: { header: hdr, sigs: {} } },
      }
    }

    /* ---------- quorum member signs ------------------------------- */
    case 'signFrame': {
      if (!s.proposal) return rep
      const signer = cmd.sig.slice(0, 42) as Address
      if (s.proposal.sigs[signer]) return rep // dup vote
      return {
        ...rep,
        state: {
          ...s,
          proposal: {
            header: s.proposal.header,
            sigs: { ...s.proposal.sigs, [signer]: cmd.sig },
          },
        },
      }
    }

    /* ---------- commit frame -------------------------------------- */
    case 'commitFrame': {
      const prop = s.proposal
      if (!prop) return rep
      /* frame-hash integrity (R-1) */
      const expectHash = hashFrame(prop.header, cmd.frame.txs)
      if (
        '0x' + Buffer.from(expectHash).toString('hex') !== prop.header.memRoot
      )
        return rep
      /* quorum weight */
      if (
        effectiveWeight(prop.sigs, s.quorum) < s.quorum.threshold ||
        !verifyAggregateBls(cmd.hanko as Hex, bytesToHex(expectHash), [])
      )
        return rep
      /* done – accept frame */
      const newState: EntityState = {
        ...cmd.frame.postStateRoot
          ? // domainState lives elsewhere; we trust postStateRoot here
            { ...s, mempool: [], height: cmd.frame.header.height }
          : s, // placeholder
      }
      return { ...rep, state: newState }
    }
  }
}

/* ── top-level reducer for one batch (ServerInput) ───────── */
export const applyServerFrame = (
  st: ServerState,
  batch: ServerInput,
  now: () => bigint,
): { next: ServerState; frame: ServerFrame } => {
  /* signerIdx mapping rule (A1) */
  const signerIds = [...new Set(batch.inputs.map((i) => i[0]))].sort((a, b) => a - b)
  for (const [idx] of batch.inputs)
    if (idx !== signerIds.indexOf(idx)) throw new Error('signerIdx mismatch')

  let next = new Map(st)
  for (const [idx, id, cmd] of batch.inputs) {
    const key = `${idx}:${id}` as const
    let rep = next.get(key)
    if (!rep) {
      // Create a default replica if it doesn't exist
      const defaultState: EntityState = {
        height: 0n,
        quorum: { threshold: 1n, members: [] },
        signerRecords: {},
        domainState: {},
        mempool: [],
      }
      rep = { attached: false, state: defaultState }
    }
    next.set(key, applyCommand(rep, cmd, now))
  }

  const frame: ServerFrame = {
    frameId: batch.frameId,
    timestamp: batch.timestamp,
    root: Buffer.from(computeServerRoot(next)).toString('hex'),
    inputsRoot: Buffer.from(computeInputsRoot(batch)).toString('hex'),
  }
  return { next, frame }
}