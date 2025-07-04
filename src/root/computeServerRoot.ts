import { rlpHex } from '../codec/rlp'
import { Hex } from '../model/xln'

export type ReplicaState = { inputsRoot: Hex }
export type ServerState = Map<bigint, ReplicaState>

export const computeServerRoot = (state: ServerState): Hex =>
  rlpHex([...state.entries()].sort(([a], [b]) => (a < b ? -1 : 1)))
