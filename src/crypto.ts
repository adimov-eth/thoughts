import { schnorr, utils as u } from 'noble-secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import type { Hex } from './schema';

export type PrivKey = Uint8Array;
export type PubKey  = Uint8Array;

export function randomPriv(): PrivKey { return u.randomPrivateKey(); }

export function pub(priv: PrivKey): PubKey { return schnorr.getPublicKey(priv); }

export function addr(pub: PubKey): Hex {
  const h = sha256(pub);
  return '0x' + Buffer.from(h.slice(-20)).toString('hex');
}

export async function sign(msg: Uint8Array, priv: PrivKey): Promise<Hex> {
  return '0x' + Buffer.from(await schnorr.sign(msg, priv)).toString('hex');
}

export async function verify(msg: Uint8Array, sig: Hex, pub: PubKey) {
  const raw = Uint8Array.from(Buffer.from(sig.slice(2), 'hex'));
  return schnorr.verify(raw, msg, pub);
}

export function hash(o: unknown): Uint8Array {
  return sha256(Buffer.from(JSON.stringify(o)));
}
