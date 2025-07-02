import { describe, it, expect } from 'vitest'
import { hashFrame } from '../src/core/entity'
import { mkFrame } from './helpers/frame'

describe('hashFrame', () => {
  it('matches golden vector', () => {
    const f = mkFrame({ ts: 1 })
    const h = hashFrame(f)
    expect(h).toBe('0xc633773f3f242e9a6b277942b96a74ffbb0864ce546dd39721de85c2c21f1d5d')
  })
})
