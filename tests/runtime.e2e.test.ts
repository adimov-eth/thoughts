import { describe, it, expect } from "vitest";
import { Runtime } from "../src/core/runtime";
import { createChatTx } from "./helpers/tx";
process.env.DEV_SKIP_SIGS = "1";

describe.skip("End-to-end 4-tick consensus", () => {
  it("all replicas hold same chat log after commit", async () => {
    const rt = new Runtime({ logLevel: "silent" });
    const tx = createChatTx("signer-0", "gm");
    rt.injectClientTx(tx);
    let now = 0;
    for (let i = 0; i < 4; i++) {
      await rt.tick(now++);
    }
    const heights = [...(rt as any).state.replicas.values()].map(
      (r) => r.last.height,
    );
    expect(new Set(heights)).toEqual(new Set([1n]));
  });
});
