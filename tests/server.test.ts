import { describe, it, expect } from "vitest";
import { applyServerBlock } from "../src/core/server";
import { createServer } from "./helpers/server";
import { createChatTx } from "./helpers/tx";
process.env.DEV_SKIP_SIGS = "1";

function wrapAddTx(tx: any) {
  return {
    from: tx.from,
    to: "*",
    cmd: { type: "ADD_TX", addrKey: "demo:chat", tx },
  };
}

describe.skip("Server block processing", () => {
  it("commits when \u2265 quorum signatures collected", () => {
    let server = createServer();
    const tx = createChatTx("signer-0", "Hello!");
    let r1 = applyServerBlock(server, [wrapAddTx(tx)], 0);
    server = r1.state;
    let r2 = applyServerBlock(server, r1.outbox, 1);
    server = r2.state;
    let r3 = applyServerBlock(server, r2.outbox, 2);
    const hasCommit = r3.outbox.some((m) => m.cmd.type === "COMMIT");
    expect(hasCommit).toBe(true);
  });
});
