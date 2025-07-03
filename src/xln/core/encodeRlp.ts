import { encode as _enc, decode as _dec, Input } from "rlp";

export const encodeRlp = (v: Input): Uint8Array => new Uint8Array(_enc(v) as Buffer);
export const decodeRlp = (b: Uint8Array): unknown => _dec(Buffer.from(b));
