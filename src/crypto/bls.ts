import { bls12_381 as bls } from "@noble/curves/bls12-381";
import { keccak_256 as keccak } from "@noble/hashes/sha3";
import type { Hex } from "../types";

const bytesToHex = (b: Uint8Array): Hex =>
  ("0x" + Buffer.from(b).toString("hex")) as Hex;
const hexToBytes = (h: Hex) => Uint8Array.from(Buffer.from(h.slice(2), "hex"));

export type PrivKey = Uint8Array;
export type PubKey = Uint8Array;

export const randomPriv = (): PrivKey => bls.utils.randomPrivateKey();
export const pub = (pr: PrivKey): PubKey => bls.getPublicKey(pr);
export const addr = (pb: PubKey): Hex => {
  const h = keccak(pb);
  return bytesToHex(h.slice(-20));
};

export const sign = async (msg: Uint8Array, pr: PrivKey): Promise<Hex> =>
  bytesToHex(await bls.sign(msg, pr));

export const verify = async (
  msg: Uint8Array,
  sig: Hex,
  pb: PubKey,
): Promise<boolean> => bls.verify(hexToBytes(sig), msg, pb);

export const verifySync = (
  msg: Uint8Array,
  sig: Hex,
  pb: PubKey,
): boolean => bls.verify(hexToBytes(sig), msg, pb);

export const aggregate = (sigs: Hex[]): Hex =>
  bytesToHex(bls.aggregateSignatures(sigs.map(hexToBytes)));

export const verifyAggregate = (
  hanko: Hex,
  msgHash: Hex,
  pubs: PubKey[],
): boolean => {
  const msg = hexToBytes(msgHash);
  return bls.verifyBatch(hexToBytes(hanko), Array(pubs.length).fill(msg), pubs);
};
