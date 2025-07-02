import { keccak_256 as keccak } from '@noble/hashes/sha3';
import { encodeFrame } from './codec';
import { verifyAggregate } from './crypto';
import { bls } from '@noble/curves/bls12-381';
import type { Hex } from './types';

/* ──────────── helpers ──────────── */
const bytesToHex = (b: Uint8Array): Hex =>
  ('0x' + Buffer.from(b).toString('hex')) as Hex;

const hexToBytes = (h: Hex): Uint8Array =>
  Uint8Array.from(Buffer.from(h.slice(2), 'hex'));

/* ──────────── key primitives ──────────── */
export type PrivKey = Uint8Array;
export type PubKey  = Uint8Array;

export function randomPriv(): PrivKey { return bls.utils.randomPrivateKey(); }

export function pub(priv: PrivKey): PubKey { return bls.getPublicKey(priv); }

export function addr(pub: PubKey): Hex {
  const h = sha256(pub);
  return bytesToHex(h.slice(-20));
}

/* ──────────── signatures ──────────── */
export async function sign(msg: Uint8Array, priv: PrivKey): Promise<Hex> {
  return bytesToHex(await bls.sign(msg, priv));
}

export async function verify(msg: Uint8Array, sig: Hex, pub: PubKey) {
  return bls.verify(hexToBytes(sig), msg, pub);
}

/** Aggregate‑signature verify (BLS12‑381).  pubKeys **must** match order of individual sigs aggregation. */
export function verifyAggregate(hanko: Hex, msgHash: Hex, pubKeys: PubKey[]): boolean {
  return bls.verifyMultipleAggregate(
    hexToBytes(hanko),
    pubKeys,
    pubKeys.map(() => hexToBytes(msgHash)),
  );
}

/* ──────────── aggregation helpers ──────────── */
export const aggregate = (sigs: Hex[]): Hex =>
  bytesToHex(bls.aggregateSignatures(sigs.map(hexToBytes)));
