import { EntityId } from '../types/brands.js';

export interface OutMsg {
  readonly from: EntityId;
  readonly to: EntityId;
  readonly seq: number;
  readonly payload: Uint8Array;
}

export interface InboxInput {
  readonly to: EntityId;
  readonly payload: Uint8Array;
}

export interface RouterState {
  readonly queue: readonly OutMsg[];
}

export function route(
  state: RouterState,
  emitted: readonly OutMsg[],
  opts: { hasEntity: (id: EntityId) => boolean }
): { nextRouter: RouterState; inboxBatch: readonly InboxInput[] } {
  const merged = [...state.queue, ...emitted].sort((a, b) =>
    a.from === b.from ? a.seq - b.seq : a.from.localeCompare(b.from)
  );
  const deliver: InboxInput[] = [];
  const remain: OutMsg[] = [];
  for (const m of merged) {
    (opts.hasEntity(m.to) ? deliver : remain).push(m);
  }
  return { nextRouter: { queue: remain }, inboxBatch: deliver };
}

export const initRouter = (): RouterState => ({ queue: [] });
