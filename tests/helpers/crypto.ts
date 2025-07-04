import { bls12_381 as bls } from "@noble/curves/bls12-381";
import { keccak_256 as keccak } from "@noble/hashes/sha3";
import type { Address } from "../../src/core/types";
import { randomPriv, pub, addr, sign, aggregate } from "../../src/crypto/bls";

export const signerKeyPair = () => {
  const priv = randomPriv();
  const pubKey = pub(priv);
  const address = addr(pubKey);
  return { priv, pub: pubKey, address };
};

export const aggregateSigs = async (
  msgHash: Uint8Array,
  signers: ReturnType<typeof signerKeyPair>[],
) => {
  const sigs = await Promise.all(
    signers.map((signer) => sign(msgHash, signer.priv)),
  );
  return aggregate(sigs);
};
