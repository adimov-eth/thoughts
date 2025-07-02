import { encode as rlpEncode, decode as rlpDecode } from 'rlp';
import { concatBytes } from '@noble/hashes/utils';

export const encodeBytes = (...chunks: Uint8Array[]) => concatBytes(...chunks);

export const rlp = {
  enc: (v: unknown): Uint8Array => new Uint8Array(rlpEncode(v as any) as Buffer),
  dec: (b: Uint8Array): any => rlpDecode(Buffer.from(b)),
};
