import { expect } from 'chai';
import * as fc from 'fast-check';
import { Server } from './server';
import { TxKind, Replica, Quorum, Frame, EntityState, Stage } from './schema';

/* deterministic genesis */
function genesis(server: Server): Replica {
  const [a, b, c] = server.signers;
  const quorum: Quorum = {
    threshold: 600,
    members: [
      { address: a.addr, shares: 300 },
      { address: b.addr, shares: 300 },
      { address: c.addr, shares: 400 },
    ],
  };
  const init: EntityState = {
    quorum, nonces: { [a.addr]: 0n, [b.addr]: 0n, [c.addr]: 0n }, chat: [],
  };
  const frame: Frame<EntityState> = {
    height: 0n, ts: Date.now(), txs: [], state: init,
  };
  return {
    id: 'dao-chat',
    address: 'dao-chat@xln',
    quorum, proposer: a.addr, stage: Stage.Ready,
    mempool: [], last: frame,
  };
}

describe('XLN happy-path', () => {
  it('commits a chat frame', async () => {
    const srv = new Server();
    const rep = genesis(srv);
    srv.enqueue({ from: rep.proposer, to: rep.proposer,
      cmd: { type: 'IMPORT', replica: rep },
    });

    const bSigner = srv.signers[1];
    srv.enqueue({ from: bSigner.addr, to: rep.proposer,
      cmd: { type: 'ADD_TX',
             entityId: rep.id,
             tx: { kind: TxKind.Chat,
                   nonce: 0n,
                   from: bSigner.addr,
                   body: { message: 'hi' },
                   sig: '0x00' } }});

    srv.enqueue({ from: rep.proposer, to: rep.proposer,
      cmd: { type: 'PROPOSE', entityId: rep.id }});

    await srv.tick();   // IMPORT
    await srv.tick();   // ADD_TX
    await srv.tick();   // PROPOSE + multicast SIGN
    await srv.tick();   // SIGNs processed, COMMIT queued
    await srv.tick();   // COMMIT applied

    const final = srv.replicas.get(rep.id)!;
    expect(final.last.height).to.equal(1n);
    expect(final.last.state.chat).to.have.length(1);
  });
});
