import * as rlp from 'rlp';
import type {
  Frame, Transaction, TxKind, Input, Command, Hex, UInt64,
} from './types';

/* ————————————————— helpers ————————————————— */
const bnToBuf = (n: UInt64) => {
  if (n === 0n) return Buffer.from([]);
  const hex = n.toString(16);
  return Buffer.from(hex.length % 2 ? '0' + hex : hex, 'hex');
};
const bufToBn = (b: Buffer): UInt64 => b.length === 0 ? 0n : BigInt('0x' + b.toString('hex'));
const str      = (x: unknown) => (typeof x === 'string' ? x : JSON.stringify(x));

/* ————————————————— transaction ————————————————— */
export const encodeTx = (tx: Transaction): Buffer => rlp.encode([
  tx.kind, bnToBuf(tx.nonce), tx.from, str(tx.body), tx.sig,
]);
export const decodeTx = (buf: Buffer): Transaction => {
  const [k, n, f, body, sig] = rlp.decode(buf) as Buffer[];
  return {
    kind : k.toString() as TxKind,
    nonce: bufToBn(n),
    from : `0x${f.toString('hex')}`,
    body : JSON.parse(body.toString()),
    sig  : `0x${sig.toString('hex')}`,
  } as Transaction;
};

/* ————————————————— frame ————————————————— */
export const encodeFrame = <F = unknown>(f: Frame<F>): Buffer => rlp.encode([
  bnToBuf(f.height), f.ts, f.txs.map(encodeTx), rlp.encode(f.state as any),
]);
export const decodeFrame = <F = unknown>(buf: Buffer): Frame<F> => {
  const [h, ts, txs, st] = rlp.decode(buf) as any[];
  return {
    height: bufToBn(h),
    ts    : Number(ts.toString()),
    txs   : (txs as Buffer[]).map(decodeTx),
    state : rlp.decode(st) as F,
  };
};

/* ————————————————— input / command ————————————————— */
const encodeCmd = (cmd: Command): unknown => [cmd.type, JSON.stringify(cmd)];
const decodeCmd = (arr: any[]): Command   => JSON.parse(arr[1].toString());

export const encodeInput = (i: Input): Buffer => rlp.encode([i.from, i.to, encodeCmd(i.cmd)]);
export const decodeInput = (buf: Buffer): Input => {
  const [from, to, c] = rlp.decode(buf) as any[];
  return { from: from.toString(), to: to.toString(), cmd: decodeCmd(c) };
};
