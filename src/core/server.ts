import { keccak_256 as keccak } from '@noble/hashes/sha3';
import { encServerFrame } from '../codec/rlp';
import {
  Address,
  Hex,
  Input,
  Replica,
  ServerFrame,
  ServerState,
  Quorum,
} from '../types';
import { applyCommand } from './entity';

/* — helper: Merkle-root stub — */
const computeRoot = (reps: Map<string, Replica>): Hex =>
  ('0x' + Buffer.from(
      keccak(JSON.stringify(
        [...reps.values()].map(r => r.state),
        (_, v) => typeof v === 'bigint' ? v.toString() : v
      ))
    ).toString('hex')) as Hex;


/** Deterministic one-tick reducer */
export function applyServerBlock(
  prev: ServerState,
  batch: Input[],
  ts: number,
){
  let outbox: Input[] = [];
  const replicas = new Map(prev.replicas);

  const enqueue = (...msgs: Input[]) => { outbox = outbox.concat(msgs); };

  for (const input of batch) {
    const [signerIdx, entityId, cmd] = input;
    const replica = replicas.get(entityId);
    if (!replica) continue;

    const nextReplica = applyCommand(replica, cmd);
    replicas.set(entityId, nextReplica);

    // Outbox logic to be updated based on spec
  }

  const root  = computeRoot(replicas);
  const inputsRoot = ('0x' + Buffer.from(keccak(JSON.stringify(batch))).toString('hex')) as Hex;

  const frame: ServerFrame = {
    frameId: Number(prev.height + 1n),
    timestamp: BigInt(ts),
    inputsRoot,
    root,
  };

  return {
    state : { replicas, height: BigInt(frame.frameId) },
    frame,
    outbox,
  };
}

const power = (sigs:Record<string, string>, q:Quorum)=>
  Object.keys(sigs).length; // trivial weight=1 implementation
