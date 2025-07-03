import { EntityId, SignerId } from '../types/brands.js';
import { reducer, Command, ConsensusState } from './consensus.js';
import { decodeInbox as decodeInboxInfra } from '../infra/decodeInbox.js';
import type { InboxInput } from './router.js';

export interface ServerState {
  readonly entities: Map<EntityId, ConsensusState>;
  readonly keyStore: Record<SignerId, Uint8Array>;
}

export const initServer = (
  keys: Record<SignerId, Uint8Array> = {}
): ServerState => ({
  entities: new Map(),
  keyStore: keys,
});

const initEntity = (): ConsensusState => ({ head: null, votes: [], nonceMap: {} });

export type Incoming = { ent: EntityId; cmd: Command } | InboxInput;

export function applyServerFrame(
  state: ServerState,
  incoming: readonly Incoming[]
): ServerState {
  const toRun: { ent: EntityId; cmd: Command }[] = [];

  for (const item of incoming) {
    if ('cmd' in item) {
      toRun.push(item);
    } else {
      toRun.push(decodeInbox(item));
    }
  }

  const entities = new Map(state.entities);
  for (const { ent, cmd } of toRun) {
    if (!entities.has(ent)) entities.set(ent, initEntity());
    const next = reducer(entities.get(ent)!, cmd, {
      weightMap: {},
      threshold: 1,
    });
    entities.set(ent, next);
  }

  return { entities, keyStore: state.keyStore };
}

function decodeInbox(d: InboxInput): { ent: EntityId; cmd: Command } {
  const { ent, cmd } = decodeInboxInfra({ from: d.to, payload: d.payload });
  return { ent: ent as EntityId, cmd };
}
