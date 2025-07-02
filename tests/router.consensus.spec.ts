import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { initRouter, route, OutMsg } from '../src/core/router.js';
import { applyConsensus } from '../src/core/consensus.js';
import { asEntityId, EntityId } from '../src/types/brands.js';

// Helper to create test messages
const msgArb = fc.record({
  from: fc.string().map(s => asEntityId(`from-${s}`)),
  to: fc.string().map(s => asEntityId(`to-${s}`)),
  seq: fc.integer({ min: 0, max: 100 }),
  payload: fc.uint8Array({ minLength: 1, maxLength: 32 })
});

// Simple shuffle function for testing
const shuffle = <T>(arr: T[]): T[] => {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

// Mock hasEntity function
const hasEntity = (id: EntityId) => id.startsWith('to-');

describe('Determinism', () => {
  it('router always yields same inbox order', () =>
    fc.assert(
      fc.property(fc.array(msgArb, { maxLength: 64 }), msgs => {
        const a = route(initRouter(), msgs, { hasEntity }).inboxBatch;
        const b = route(initRouter(), shuffle(msgs), { hasEntity }).inboxBatch;
        expect(a).toStrictEqual(b);
      })
    ));
});