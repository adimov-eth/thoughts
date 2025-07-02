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
  const newMsgs = [...emitted].sort((a, b) =>
    a.from === b.from ? a.seq - b.seq : a.from.localeCompare(b.from)
  );
  const merged: OutMsg[] = [];
  const q = state.queue;
  let i = 0,
    j = 0;
  while (i < q.length && j < newMsgs.length) {
    const cmp =
      q[i].from === newMsgs[j].from
        ? q[i].seq - newMsgs[j].seq
        : q[i].from.localeCompare(newMsgs[j].from);
    if (cmp <= 0) {
      merged.push(q[i++]);
    } else {
      merged.push(newMsgs[j++]);
    }
  }
  for (; i < q.length; i++) merged.push(q[i]);
  for (; j < newMsgs.length; j++) merged.push(newMsgs[j]);
  const deliver: InboxInput[] = [];
  const remain: OutMsg[] = [];
  for (const m of merged) {
    (opts.hasEntity(m.to) ? deliver : remain).push(m);
  }
  return { nextRouter: { queue: remain }, inboxBatch: deliver };
}

export const initRouter = (): RouterState => ({ queue: [] });
