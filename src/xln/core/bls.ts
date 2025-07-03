import { bls12_381 as bls } from '@noble/curves/bls12-381';

export const verifyAggregate = (
  sig: Uint8Array,
  msgs: Uint8Array[],
  pubs: Uint8Array[],
): boolean => {
  const messages = msgs.length === 1 ? Array(pubs.length).fill(msgs[0]) : msgs;
  return bls.verifyBatch(sig, messages, pubs);
};
