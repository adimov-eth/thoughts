import { performance } from 'node:perf_hooks'
import { applyServerFrame } from '../core/reducer'
import type { ServerInput, ServerState } from '../core/types'

let state: ServerState = new Map()
let frameId = 0

const now = () => BigInt(Math.floor(performance.now()))

export const ingest = async (inputs: ServerInput['inputs']) => {
  const batch: ServerInput = {
    inputId: crypto.randomUUID(),
    frameId: frameId++,
    timestamp: now(),
    inputs,
  }
  const { next } = applyServerFrame(state, batch, now)
  state = next
}