import { Replica, Frame, EntityState, Quorum, Address } from '../../src/types'

export const createBlankReplica = (): Replica => {
  const members: Record<Address, { nonce: bigint; shares: number }> = {
    'signer-0': { nonce: 0n, shares: 1 },
  } as any
  const quorum: Quorum = { threshold: 1, members }
  const state: EntityState = { quorum, chat: [] }
  const frame: Frame<EntityState> = { height: 0n, ts: 0, txs: [], state }
  return {
    address: { jurisdiction: 'demo', entityId: 'chat' },
    proposer: 'signer-0' as Address,
    isAwaitingSignatures: false,
    mempool: [],
    last: frame,
  }
}
