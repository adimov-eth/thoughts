import { EntityId, SignerId } from '../types/brands.js';
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
  quorum: { members: [id as unknown as SignerId], pubKeys: {}, threshold: 1 },
});

export function applyServerFrame(
  state: ServerState,
  incoming: readonly (Command | DeliveredInput)[]
): ServerState {
  const toRun: { ent: EntityId; cmd: Command }[] = [];

  for (const item of incoming) {
    if ('type' in item) {
      const ent = (item as any).entity ?? (item as any).frame?.proposer;
      toRun.push({ ent: ent as EntityId, cmd: item });
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
