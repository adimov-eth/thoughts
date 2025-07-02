import { EntityId, SignerId, asSignerId } from '../types/brands.js';
import { applyConsensus, Command, decodeCommit, Frame, EntityRoot } from './consensus.js';
import { DeliveredInput, initRouter, route, RouterState, OutMsg } from './router.js';

export interface ServerState {
  readonly router: RouterState;
  readonly entities: Map<EntityId, EntityRoot>;
}

export const initServer = (): ServerState => ({
  router: initRouter(),
  entities: new Map(),
});

const initEntity = (id: EntityId): EntityRoot => ({
  id,
  quorum: {
    members: [asSignerId(String(id))],
    pubKeys: { [asSignerId(String(id))]: new Uint8Array(48) },
    threshold: 1,
  },
});

export type Incoming = { ent: EntityId; cmd: Command } | DeliveredInput;

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
    if (!entities.has(ent)) entities.set(ent, initEntity(ent));
    const { next, outbox: o } = applyConsensus(entities.get(ent)!, cmd);
    entities.set(ent, next);
    outbox = [...outbox, ...o];
  }

  const { nextRouter } = route(state.router, outbox, {
    hasEntity: (id) => entities.has(id),
  });

  return { router: nextRouter, entities };
}

function decodeInbox(d: DeliveredInput): { ent: EntityId; cmd: Command } {
  const payload = decodeCommit(d.payload);
  return { ent: d.to, cmd: { type: 'COMMIT_FRAME', ...payload } };
}
