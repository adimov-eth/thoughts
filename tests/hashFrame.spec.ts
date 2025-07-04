import { describe, it, expect } from "vitest";
import { hashFrame } from "../src/core/entity";
import { mkFrame } from "./helpers/frame";

describe("hashFrame", () => {
  it("matches golden vector", () => {
    const f = mkFrame({ ts: 1 });
    const h = hashFrame(f);
    expect(h).toBe(
      "0x0e2264dbc867458cf3d2e6b21cc481fdaadb5321d64426943d74bcbaf1cc6704",
    );
  });
});
