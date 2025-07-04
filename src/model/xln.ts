export type Hex = `0x${string}`
export type AddressHex = Hex & { readonly __brand: 'address' }

export type EntityTx = {
  kind: 'transfer' | 'deploy' | string
  data: unknown
  nonce: bigint
  from: AddressHex
  sig: Hex
}

export type FrameHeader = {
  height: bigint
  parentHash: Hex
  stateRoot: Hex
  txsRoot: Hex
  inputsRoot: Hex
  serverRoot: Hex
}

export type Frame = {
  header: FrameHeader
  txs: readonly EntityTx[]
}

export type Quorum = readonly Hex[]
