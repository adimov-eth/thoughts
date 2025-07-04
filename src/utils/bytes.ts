export const bytesToHex = (bytes: Uint8Array): `0x${string}` =>
  `0x${Array.from(bytes, x => x.toString(16).padStart(2, '0')).join('')}`
