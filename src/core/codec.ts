import { encode as rlpEncode, decode as rlpDecode } from "rlp";

export const rlp = {
  enc: (v: unknown): Uint8Array =>
    new Uint8Array(rlpEncode(v as any) as Buffer),
  dec: (b: Uint8Array): unknown => rlpDecode(Buffer.from(b)),
};
