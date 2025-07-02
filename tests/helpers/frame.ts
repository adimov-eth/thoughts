import { Frame } from '../../src/types'
import { hashFrame } from '../../src/core/entity'
import { encFrame } from '../../src/codec/rlp'

export const mkFrame = (over: Partial<Frame> = {}): Frame => ({
  height: 0n,
  ts: 0,
  txs: [],
  state: { quorum: { threshold: 1, members: {} }, chat: [] },
  ...over,
}) as any

export const frameHash = (f: Frame) => hashFrame(f)
export const enc = (f: Frame) => encFrame(f)
