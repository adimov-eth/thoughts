import pino from 'pino';
import { addr, aggregate, pub, randomPriv, sign } from '../crypto/bls';
import { ILogger, makeLogger } from '../logging';
import { EntityState, EntityTx, Hex, Input, Quorum, Replica, ServerState } from '../types';
import { applyServerBlock } from './server';

/* ──────────── deterministic key‑gen for demo ──────────── */
const PRIVS = [...Array(5)].map((_,i)=>randomPriv());
const PUBS  = PRIVS.map(pub);
const ADDRS = PUBS.map(addr);

/* ──────────── build initial replica (empty chat) ──────────── */
const genesis = ():Replica =>{
  const quorum:Quorum={
    threshold:3n,
    members: ADDRS.map(a=>({address: a, shares:1n})),
  };
  const state:EntityState={
    height: 0n,
    quorum,
    signerRecords: Object.fromEntries(ADDRS.map(a => [a, {nonce: 0n}])),
    domainState: { chat: [] },
    mempool: [],
  };
  return { state };
};

/* ──────────── runtime shell ──────────── */
export class Runtime {
  private state: ServerState = { replicas:new Map(), height:0n };
  private log: ILogger;
  private pending: EntityTx[] = [];

  constructor(opts: { logLevel?: pino.Level } = {}){
    this.log = makeLogger(opts.logLevel ?? (process.env.LOG_LEVEL as any) ?? 'info');
    /* IMPORT each signer‑replica */
    const base=genesis();
    ADDRS.forEach((a, i) => {
      const rep: Replica = {
        ...base,
        // Proposer logic needs to be updated based on spec
      };
      this.state.replicas.set(`demo:chat:${i}`,rep);
    });
  }

  async tick(now:number, inc:Input[] = []){
    this.log.debug('tick start', { height: this.state.height });
    const pendingInputs = this.pending.map((tx, i) => {
      // This is a placeholder for signer index
      const signerIdx = i % ADDRS.length;
      return [signerIdx, 'chat', { type: 'addTx', tx }] as Input;
    });
    this.pending = [];
    const batch = inc.concat(pendingInputs);
    let { state:next, frame, outbox } =
      applyServerBlock(this.state, batch, now);

    /* fill sig placeholders */
    outbox = await Promise.all(outbox.map(async m=>{
      const [signerIdx, entityId, cmd] = m;
      if(cmd.type==='signFrame' && cmd.sig==='0x00'){
        // Signing logic to be updated
      }
      if(cmd.type==='commitFrame' && cmd.hanko==='0x00'){
        // Aggregation logic to be updated
      }
      return m;
    }));

    outbox.forEach(e => this.log.debug('outbox', e));
    if (frame) {
      this.log.info('commit', { height: frame.frameId, hash: frame.root });
    }

    this.state = next;
    return { outbox, frame };
  }

  injectClientTx(tx: EntityTx){
    this.log.info('client tx', tx);
    this.pending.push(tx);
  }
}
