import { describe, it, expect, beforeEach } from 'vitest'
import { applyCommand, hashFrame } from '../src/core/entity'
import { mkFrame, enc } from './helpers/frame'
import { createBlankReplica } from './helpers/replica'
import { Command } from '../src/types'

describe('Entity-level state machine', () => {
  it('hashFrame matches keccak256(RLP(frame))', () => {
    const f = mkFrame({ ts: 1 })
    const expected = hashFrame(f)
    const direct = '0x' + Buffer.from(require('@noble/hashes/sha3').keccak_256(enc(f))).toString('hex')
    expect(direct).toBe(expected)
  })

  it('rejects duplicate SIGN from same signer', () => {
    const rep = createBlankReplica()
    rep.mempool.push({ kind:'chat', nonce:0n, from:'signer-0', body:{message:'hi'}, sig:'0x00' } as any)
    const r1 = applyCommand(rep, { type:'PROPOSE', addrKey:'demo:chat', ts:0 } as Command)
    const hash = r1.proposal!.hash

    const s1 = applyCommand(r1, { type:'SIGN', addrKey:'demo:chat', signer:'signer-0', frameHash: hash, sig:'0x1' } as Command)
    expect(s1.proposal!.sigs.size).toBe(1)
    const s2 = applyCommand(s1, { type:'SIGN', addrKey:'demo:chat', signer:'signer-0', frameHash: hash, sig:'0x1' } as Command)
    expect(s2.proposal!.sigs.size).toBe(1)
  })
})
