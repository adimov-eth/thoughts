import {
  Input, Replica, Command, addrKey, ServerFrame, ServerState,
  TS, Hex, Address, UInt64
} from '../types';
import { applyCommand } from './entity';
import { keccak_256 as keccak } from '@noble/hashes/sha3';
import { encServerFrame } from '../codec/rlp';

/* — helper: Merkle-root stub — */
const computeRoot = (reps: Map<string, Replica>): Hex =>
  ('0x' + Buffer.from(
      keccak(JSON.stringify(
        [...reps.values()].map(r => ({ addr: r.address, state: r.last.state })),
        (_, v) => typeof v === 'bigint' ? v.toString() : v
      ))
    ).toString('hex')) as Hex;


/** Deterministic one-tick reducer */
export function applyServerBlock(
  prev: ServerState,
  batch: Input[],
  ts: TS,
){
  let outbox: Input[] = [];
  const replicas = new Map(prev.replicas);

  const enqueue = (...msgs: Input[]) => { outbox = outbox.concat(msgs); };

  for (const { cmd } of batch) {
    const signerPart =
      cmd.type === 'ADD_TX' ? cmd.tx.from :
      cmd.type === 'SIGN'   ? cmd.signer   : '';
    const key = cmd.type === 'IMPORT'
      ? ''
      : cmd.addrKey + (signerPart ? ':' + signerPart : '');

    if (cmd.type === 'IMPORT') {
      const base = cmd.replica;
      const eKey = addrKey(base.address);
      for (const m of Object.keys(base.last.state.quorum.members)) {
        replicas.set(`${eKey}:${m}`, { ...base, proposer: m as Address });
      }
      continue;
    }

    const rep = replicas.get(key) || [...replicas.values()][0];
    if (!rep) continue;

    const nextRep = applyCommand(rep, cmd);
    replicas.set(key, nextRep);

    switch (cmd.type) {
      case 'PROPOSE':
        if (!rep.proposal && nextRep.proposal) {
          for (const s of Object.keys(nextRep.last.state.quorum.members)) {
            if (s === nextRep.proposer) continue;
            enqueue({
              from:s as Address, to:nextRep.proposer,
              cmd:{ type:'SIGN', addrKey:cmd.addrKey,
                    signer:s as Address, frameHash:nextRep.proposal.hash, sig:'0x00' }
            });
          }
        } break;

      case 'SIGN':
        if (nextRep.isAwaitingSignatures && nextRep.proposal) {
          const q   = nextRep.last.state.quorum;
          const pre = rep.proposal ? power(rep.proposal.sigs,q) : 0;
          const now = power(nextRep.proposal.sigs,q);
          if (pre < q.threshold && now >= q.threshold) {
            enqueue({
              from:nextRep.proposer, to:'*' as Address,
              cmd:{ type:'COMMIT', addrKey:cmd.addrKey,
                    hanko:'0x00', frame:nextRep.proposal as any }
            });
          }
        } break;

      case 'ADD_TX':
        if (!nextRep.isAwaitingSignatures && nextRep.mempool.length) {
          enqueue({
            from:rep.proposer, to:rep.proposer,
            cmd:{ type:'PROPOSE', addrKey:cmd.addrKey, ts }
          });
        }
    }
  }

  const root  = computeRoot(replicas);
  const frame: ServerFrame = {
    height: (prev.height + 1n) as UInt64,
    ts,
    inputs: batch,
    root,
    hash: '0x00' as Hex,
  };
  frame.hash = ('0x' + Buffer.from(keccak(encServerFrame(frame))).toString('hex')) as Hex;

  return {
    state : { replicas, height: frame.height },
    frame,
    outbox,
  };
}

const power = (sigs:Map<Address,string>, q:any)=>
  [...sigs.keys()].length; // trivial weight=1 implementation
