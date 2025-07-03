import { decodeRlp } from "@xln/core/encodeRlp";   // XLN exports encoder/decoder
import type { Frame } from "../core/types.js";

/** Wire‑level message delivered by the router. */
export interface Delivered {
  from: string;            // sender replica ID
  payload: Uint8Array;     // RLP([frame, aggregateSig])
}

/** Core command emitted after decoding. */
export type Command =
  | { type: "COMMIT_FRAME"; frame: Frame; aggregateSig: Uint8Array };

export function decodeInbox(msg: Delivered): { ent: string; cmd: Command } {
  // payload = [frame, aggregateSig] in canonical RLP
  const [rawFrame, aggregateSig] = decodeRlp(msg.payload) as [
    unknown,
    Uint8Array
  ];
  const frame = rawFrame as Frame;

  return {
    ent: msg.from,
    cmd: { type: "COMMIT_FRAME", frame, aggregateSig },
  };
}
