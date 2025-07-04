import type { Frame, FrameHeader, Address } from "../../src/core/types";
import { hashFrame } from "../../src/core/hash";

export const mkFrameHeader = (
  over: Partial<FrameHeader> = {},
): FrameHeader => ({
  entityId: "test-entity",
  height: 1n,
  memRoot: "0x0000000000000000000000000000000000000000000000000000000000000000",
  prevStateRoot:
    "0x0000000000000000000000000000000000000000000000000000000000000000",
  proposer: "0x0000000000000000000000000000000000000000" as Address,
  ...over,
});

export const mkFrame = (over: Partial<Frame> = {}): Frame => ({
  header: mkFrameHeader(over.header),
  txs: [],
  timestamp: 1234567890n,
  postStateRoot:
    "0x0000000000000000000000000000000000000000000000000000000000000000",
  ...over,
});

export const frameHash = (f: Frame) => hashFrame(f.header, f.txs);
