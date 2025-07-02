import { EntityId, SignerId, asSignerId } from '../types/brands.js';
import { applyConsensus, Command, decodeCommit, Frame, EntityRoot } from './consensus.js';
import { InboxInput, initRouter, route, RouterState, OutMsg } from './router.js';

export interface ServerState {
  readonly router: RouterState;
  readonly entities: Map<EntityId, EntityRoot>;
  readonly keyStore: Record<SignerId, Uint8Array>;
}

export const initServer = (
  keys: Record<SignerId, Uint8Array> = {}
): ServerState => ({
  router: initRouter(),
  entities: new Map(),
  keyStore: keys,
});

const initEntity = (
  id: EntityId,
  store: Record<SignerId, Uint8Array>
): EntityRoot => {
  const signer = asSignerId(String(id));
  const pk = store[signer];
  if (!pk) throw new Error('missing public key for signer');
  return {
    id,
    quorum: { members: [signer], pubKeys: { [signer]: pk }, threshold: 1, weights: { [signer]: 1 } },
    signerRecords: { [signer]: { nonce: 0 } },
  };
};

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
  let outbox: OutMsg[] = [];
  for (const { ent, cmd } of toRun) {
    if (!entities.has(ent)) entities.set(ent, initEntity(ent, state.keyStore));
    const { next, outbox: o } = applyConsensus(entities.get(ent)!, cmd);
    entities.set(ent, next);
    outbox = [...outbox, ...o];
  }

  const { nextRouter } = route(state.router, outbox, {
    hasEntity: (id) => entities.has(id),
  });

  return { router: nextRouter, entities, keyStore: state.keyStore };
}

function decodeInbox(d: InboxInput): { ent: EntityId; cmd: Command } {
  const payload = decodeCommit(d.payload);
  return { ent: d.to, cmd: { type: 'COMMIT_FRAME', ...payload } };
}
