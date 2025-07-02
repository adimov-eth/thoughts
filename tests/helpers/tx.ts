import { ChatTx } from '../../src/types'
import { keccak_256 as keccak } from '@noble/hashes/sha3'

export const createChatTx = (sender: string, msg: string): ChatTx => ({
  kind: 'chat',
  sender,
  from: sender as any,
  nonce: 0n,
  body: { message: msg },
  hash: '0x' + Buffer.from(keccak(msg)).toString('hex'),
  sig: '0x00',
}) as any
