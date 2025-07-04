import { bls12_381 as bls } from '@noble/curves/bls12-381'
import { Hex } from '../model/xln'

const fromHex = (hex: Hex) => Uint8Array.from(Buffer.from(hex.slice(2), 'hex'))

export const verifySig = async (
  msg: Uint8Array,
  sigHex: Hex,
  pubHex: Hex
): Promise<boolean> => bls.verify(fromHex(sigHex), msg, fromHex(pubHex))

export const verifyAggregate = async (
  msg: Uint8Array,
  sigHex: Hex,
  quorum: readonly Hex[]
): Promise<boolean> =>
  bls.aggregateVerify(
    quorum.map(fromHex),
    new Array(quorum.length).fill(msg),
    fromHex(sigHex)
  )
