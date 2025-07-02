import * as bls from '@noble/curves/bls12-381'
import { keccak_256 as keccak } from '@noble/hashes/sha3'
import { Hex } from '../../src/types'

export const signerKeyPair = () => {
  const priv = bls.utils.randomPrivateKey()
  return { priv, pub: bls.getPublicKey(priv) }
}

export const aggregateSigs = (msgHash: string, signers: ReturnType<typeof signerKeyPair>[]) => {
  const msg = Buffer.from(msgHash.slice(2), 'hex')
  const sigs = signers.map(p => bls.sign(msg, p.priv))
  return Promise.all(sigs).then(sigBytes => bls.aggregateSignatures(sigBytes).toString())
}
