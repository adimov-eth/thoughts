import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { initRouter, route } from "../src/core/router.js";

const msgArb = fc.record({
  from: fc.constant("ent" as any),
  to: fc.constant("ent" as any),
  seq: fc.bigInt({ min: 0n, max: (1n << 63n) - 1n }),
  payload: fc.uint8Array(),
});

describe("Determinism", () => {
  it("router always yields same inbox order", () =>
    fc.assert(
      fc.property(
        fc.uniqueArray(msgArb, { selector: (m) => m.seq, maxLength: 64 }),
        (msgs) => {
          const a = route(initRouter(), msgs, { hasEntity: () => true }).inbox;
          const b = route(initRouter(), [...msgs].reverse(), {
            hasEntity: () => true,
          }).inbox;
          expect(a).toStrictEqual(b);
        },
      ),
    ));
});
