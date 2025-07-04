import { bigint, hex, object, string, unknown, array } from 'valibot'
import { EntityTx, Frame, FrameHeader } from './xln'

export const hexSchema = hex({ prefix: '0x' })
export const addressSchema = hex({ prefix: '0x', length: 42 })

export const entityTxSchema = object<EntityTx>({
  kind: string(),
  data: unknown(),
  nonce: bigint(),
  from: addressSchema,
  sig: hexSchema
})

export const frameHeaderSchema = object<FrameHeader>({
  height: bigint(),
  parentHash: hexSchema,
  stateRoot: hexSchema,
  txsRoot: hexSchema,
  inputsRoot: hexSchema,
  serverRoot: hexSchema
})

export const frameSchema = object<Frame>({
  header: frameHeaderSchema,
  txs: array(entityTxSchema)
})
