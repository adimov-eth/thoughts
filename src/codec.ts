/**
 * Minimal deterministic RLP codec.
 * Encodes / decodes Frames & Envelopes byte-perfectly.
 *
 * NOTE:  optimisation, checksum-address & streaming encoder are out-of-scope -
 *        this is enough for dev-net interoperability.
 */

import * as rlp from 'rlp';
import type {
  Frame, Transaction, TxKind, Envelope, Command, Hex, UInt64,
} from './schema';

/* ————————————————— helpers ————————————————— */

const bnToBuf = (n: UInt64) => Buffer.from(n.toString(16), 'hex');
const bufToBn = (b: Buffer)  => BigInt('0x' + b.toString('hex'));

const str = (x: unknown) => (typeof x === 'string' ? x : JSON.stringify(x));

/* ————————————————— transaction ————————————————— */

export function encodeTx(tx: Transaction): Buffer {
  return rlp.encode([
    tx.kind,
    bnToBuf(tx.nonce),
    tx.from,
    str(tx.body),
    tx.sig,
  ]);
}

export function decodeTx(buf: Buffer): Transaction {
  const [k, n, from, body, sig] = rlp.decode(buf) as Buffer[];
  return {
    kind  : k.toString() as TxKind,
    nonce : bufToBn(n),
    from  : `0x${from.toString('hex')}`,
    body  : JSON.parse(body.toString()),
    sig   : `0x${sig.toString('hex')}`,
  } as Transaction;
}

/* ————————————————— frame ————————————————— */

export function encodeFrame<F = unknown>(f: Frame<F>): Buffer {
  return rlp.encode([
    bnToBuf(f.height),
    f.ts,
    f.txs.map(encodeTx),
    JSON.stringify(f.state),          // dev-net only
  ]);
}

export function decodeFrame<F = unknown>(buf: Buffer): Frame<F> {
  const [h, ts, txs, st] = rlp.decode(buf) as any[];
  return {
    height: bufToBn(h),
    ts    : Number(ts),
    txs   : (txs as Buffer[]).map(decodeTx),
    state : JSON.parse(st.toString()),
  };
}

/* ————————————————— envelope (command) ————————————————— */

function encodeCmd(cmd: Command): unknown {
  return [cmd.type, JSON.stringify(cmd)];
}

function decodeCmd(arr: any[]): Command {
  return JSON.parse(arr[1].toString());
}

export function encodeEnvelope(env: Envelope): Buffer {
  return rlp.encode([
    env.from,
    env.to,
    encodeCmd(env.cmd),
  ]);
}

export function decodeEnvelope(buf: Buffer): Envelope {
  const [from, to, c] = rlp.decode(buf) as any[];
  return {
    from: from.toString(),
    to  : to.toString(),
    cmd : decodeCmd(c),
  };
}
