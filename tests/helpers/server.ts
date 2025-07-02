import { ServerState, Replica, Quorum, EntityState, Frame, Address } from '../../src/types'

export const createServer = (): ServerState => {
  const signers = ['signer-0','signer-1','signer-2']
  const members: Record<Address, {nonce: bigint; shares: number}> = Object.fromEntries(
    signers.map(s => [s as Address, { nonce: 0n, shares: 1 }])
  ) as any
  const quorum: Quorum = { threshold: 2, members }
  const state: EntityState = { quorum, chat: [] }
  const frame: Frame<EntityState> = { height: 0n, ts:0, txs:[], state }
  const base: Replica = {
    address:{ jurisdiction:'demo', entityId:'chat' },
    proposer: 'signer-0' as Address,
    isAwaitingSignatures:false,
    mempool:[],
    last: frame,
  }
  const replicas = new Map<string, Replica>()
  signers.forEach(s => replicas.set(`demo:chat:${s}`, { ...base, proposer:s as Address }))
  return { height:0n, replicas }
}
