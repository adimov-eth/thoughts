import { encode as rlpEncode } from '@ethereumjs/rlp'
import { bytesToHex } from '../utils/bytes'

const encodeValue = (val: unknown): Uint8Array => {
  if (val instanceof Map) {
    return rlpEncode([...val.entries()].sort(([a], [b]) => (a > b ? 1 : -1)))
  }
  if (Array.isArray(val)) return rlpEncode(val.map(encodeValue))
  if (typeof val === 'object' && val !== null) {
    return rlpEncode(
      Object.entries(val)
        .sort(([a], [b]) => (a > b ? 1 : -1))
        .map(([, v]) => encodeValue(v))
    )
  }
  return rlpEncode(val as Parameters<typeof rlpEncode>[0])
}

export const rlpHex = (value: unknown): `0x${string}` =>
  bytesToHex(encodeValue(value))
