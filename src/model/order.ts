import { EntityTx } from './xln'

const compareHex = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

export const sortTransactions = (
  txs: readonly EntityTx[]
): readonly EntityTx[] =>
  [...txs].sort((x, y) => {
    if (x.nonce !== y.nonce) return x.nonce < y.nonce ? -1 : 1
    if (x.from !== y.from) return compareHex(x.from, y.from)
    return compareHex(x.sig, y.sig)
  })
