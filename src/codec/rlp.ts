// Pure RLP encode/decode helpers (no external deps except rlp).

import * as rlp from "rlp";
import type {
  Address,
  Command,
  EntityTx,
  FrameHeader,
  Input,
  ServerFrame,
} from "../types";

/* — helpers — */
const bnToBuf = (n: bigint) =>
  n === 0n
    ? Buffer.alloc(0)
    : Buffer.from(n.toString(16).padStart(2, "0"), "hex");
const bufToBn = (b: Buffer): bigint =>
  b.length === 0 ? 0n : BigInt("0x" + b.toString("hex"));

/* — EntityTx — */
export const encEntityTx = (t: EntityTx): Buffer =>
  Buffer.from(
    rlp.encode([
      t.kind,
      bnToBuf(t.nonce),
      t.from,
      JSON.stringify(t.data),
      t.sig,
    ]),
  );
export const decEntityTx = (b: Buffer): EntityTx => {
  const [k, n, from, data, sig] = rlp.decode(b) as Buffer[];
  return {
    kind: k.toString(),
    nonce: bufToBn(n),
    from: `0x${from.toString("hex")}` as Address,
    data: JSON.parse(data.toString()),
    sig: `0x${sig.toString("hex")}`,
  } as EntityTx;
};

/* — FrameHeader — */
export const encFrameHeader = (h: FrameHeader): Buffer =>
  Buffer.from(
    rlp.encode([
      h.entityId,
      bnToBuf(h.height),
      h.memRoot,
      h.prevStateRoot,
      h.proposer,
    ]),
  );

/* — Frame For Signing — */
export const encFrameForSigning = (h: FrameHeader, txs: EntityTx[]): Buffer =>
  Buffer.from(rlp.encode([encFrameHeader(h), txs.map(encEntityTx)]));

/* — command — */
const encCmd = (c: Command): unknown => [
  c.type,
  JSON.stringify(c, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
];
const decCmd = (a: unknown[]): Command => JSON.parse(a[1].toString());

/* — input — */
export const encInput = (i: Input): Buffer =>
  Buffer.from(rlp.encode([i[0], i[1], encCmd(i[2]) as rlp.Input]));
export const decInput = (b: Buffer): Input => {
  const decoded = rlp.decode(b) as [Buffer, Buffer, unknown[]];
  const [signerIdx, entityId, cmd] = decoded;
  return [Number(signerIdx.toString()), entityId.toString(), decCmd(cmd)] as Input;
};

/* — server frame — */
export const encServerFrame = (f: ServerFrame): Buffer =>
  Buffer.from(
    rlp.encode([f.frameId, bnToBuf(f.timestamp), f.inputsRoot, f.root]),
  );

export const decServerFrame = (b: Buffer): ServerFrame => {
  const decoded = rlp.decode(b) as [Buffer, Buffer, Buffer, Buffer];
  const [frameId, timestamp, inputsRoot, root] = decoded;
  const frame: ServerFrame = {
    frameId: Number(frameId.toString()),
    timestamp: bufToBn(timestamp),
    inputsRoot: inputsRoot.toString(),
    root: root.toString(),
  };
  return frame;
};
