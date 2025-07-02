// Pure RLP encode/decode helpers (no external deps except rlp).

import * as rlp from 'rlp';
import type {
  Frame, Transaction, TxKind, Input, Command, Hex, UInt64, ServerFrame,
} from '../types';
import { keccak_256 as keccak } from '@noble/hashes/sha3';

/* — helpers — */
const bnToBuf = (n: UInt64) =>
  n === 0n ? Buffer.alloc(0)
           : Buffer.from(n.toString(16).padStart(2, '0'), 'hex');
const bufToBn = (b: Buffer): UInt64 =>
  b.length === 0 ? 0n : BigInt('0x' + b.toString('hex'));

/* — tx — */
export const encTx = (t: Transaction): Buffer => Buffer.from(rlp.encode([
  t.kind, bnToBuf(t.nonce), t.from, JSON.stringify(t.body), t.sig,
]));
export const decTx = (b: Buffer): Transaction => {
  const [k, n, f, body, sig] = rlp.decode(b) as Buffer[];
  return {
    kind : k.toString() as TxKind,
    nonce: bufToBn(n),
    from : `0x${f.toString('hex')}`,
    body : JSON.parse(body.toString()),
    sig  : `0x${sig.toString('hex')}`,
  } as Transaction;
};

/* — frame — */
export const encFrame = <S>(f: Frame<S>): Buffer => Buffer.from(rlp.encode([
  bnToBuf(f.height), f.ts, f.txs.map(encTx), rlp.encode(f.state as any),
]));
export const decFrame = <S>(b: Buffer): Frame<S> => {
  const [h, ts, txs, st] = rlp.decode(b) as any[];
  return {
    height: bufToBn(h), ts:Number(ts.toString()),
    txs:(txs as Buffer[]).map(decTx),
    state:rlp.decode(st) as S,
  };
};

/* — command — */
const encCmd = (c: Command): unknown => [c.type, JSON.stringify(c)];
const decCmd = (a:any[]): Command   => JSON.parse(a[1].toString());

/* — input — */
export const encInput = (i: Input): Buffer =>
  Buffer.from(rlp.encode([i.from, i.to, encCmd(i.cmd) as any]));
export const decInput = (b: Buffer): Input => {
  const [f,t,c] = rlp.decode(b) as any[];
  return { from:f.toString(), to:t.toString(), cmd:decCmd(c) } as Input;
};

/* — server frame — */
export const encServerFrame = (f: ServerFrame): Buffer =>
  Buffer.from(rlp.encode([
    bnToBuf(f.height), f.ts,
    f.inputs.map(encInput),
    f.root,
  ]));

export const decServerFrame = (b: Buffer): ServerFrame => {
  const [h, ts, ins, root] = rlp.decode(b) as any[];
  const frame: ServerFrame = {
    height: bufToBn(h),
    ts: Number(ts.toString()),
    inputs: (ins as Buffer[]).map(decInput),
    root: `0x${root.toString('hex')}` as Hex,
    hash: '0x00' as Hex,
  };
  frame.hash = ('0x' + Buffer.from(keccak(encServerFrame(frame))).toString('hex')) as Hex;
  return frame;
};
