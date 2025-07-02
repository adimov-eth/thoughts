import { applyServerBlock } from './server';
import { sign, aggregate, randomPriv, pub, addr } from '../crypto/bls';
import { Input, Replica, Frame, EntityState, Quorum, Hex, ServerState } from '../types';

/* ──────────── deterministic key‑gen for demo ──────────── */
const PRIVS = [...Array(5)].map((_,i)=>randomPriv());
const PUBS  = PRIVS.map(pub);
const ADDRS = PUBS.map(addr);

/* ──────────── build initial replica (empty chat) ──────────── */
const genesis = ():Replica =>{
  const quorum:Quorum={
    threshold:3,
    members:Object.fromEntries(
      ADDRS.map(a=>[a,{nonce:0n as bigint,shares:1}]),
    ),
  };
  const state:EntityState={quorum,chat:[]};
  const frame:Frame<EntityState>={height:0n,ts:0,txs:[],state};
  return{
    address:{jurisdiction:'demo',entityId:'chat'},
    proposer:ADDRS[0],
    isAwaitingSignatures:false,
    mempool:[],
    last:frame,
  };
};

/* ──────────── runtime shell ──────────── */
export class Runtime {
  private state: ServerState = { replicas:new Map(), height:0n };
  constructor(){
    /* IMPORT each signer‑replica */
    const base=genesis();
    ADDRS.forEach(a=>{
      const rep={...base,proposer:a};
      this.state.replicas.set(`demo:chat:${a}`,rep);
    });
  }

  async tick(now:number, inc:Input[]){
    let { state:next, frame, outbox } =
      applyServerBlock(this.state, inc, now);

    /* fill sig placeholders */
    outbox = await Promise.all(outbox.map(async m=>{
      if(m.cmd.type==='SIGN'&&m.cmd.sig==='0x00'){
        const i=ADDRS.indexOf(m.cmd.signer);
        m.cmd.sig = await sign(
          Buffer.from(m.cmd.frameHash.slice(2),'hex'), PRIVS[i],
        );
      }
      if(m.cmd.type==='COMMIT'&&m.cmd.hanko==='0x00'){
        const sigs=(m.cmd.frame as any).sigs as Map<string,Hex>;
        m.cmd.hanko = aggregate([...sigs.values()]);
        delete (m.cmd.frame as any).sigs;
        delete (m.cmd.frame as any).hash;
      }
      return m;
    }));

    /* side-effects */
    console.log('Committed ServerFrame', frame.height.toString(),
                'hash', frame.hash.slice(0,10),
                'root', frame.root.slice(0,10));

    this.state = next;
    return { outbox, frame };
  }
}
