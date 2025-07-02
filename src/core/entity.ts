import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex } from '@noble/hashes/utils';
import { encFrame } from '../codec/rlp';
import { verifyAggregate } from '../crypto/bls';
import {
  Address,
  Command, EntityState, Frame,
  Hex,
  ProposedFrame,
  Quorum,
  Replica,
  Transaction,
  TS
} from '../types';

export const hashFrame = (f: Frame<any>): Hex =>
  ('0x' + bytesToHex(keccak_256(encFrame(f)))) as Hex;

const sortTx = (a: Transaction, b: Transaction) =>
  a.nonce !== b.nonce ? (a.nonce < b.nonce ? -1 : 1)
  : a.from  !== b.from ? (a.from  < b.from  ? -1 : 1)
  : 0;

const sharesOf = (addr: Address, q: Quorum) => q.members[addr]?.shares ?? 0;

const power = (sigs: Map<Address, Hex>, q: Quorum) =>
  [...sigs.keys()].reduce((sum,a)=>sum+sharesOf(a,q),0);

const thresholdReached = (sigs: Map<Address, Hex>, q: Quorum) =>
  power(sigs,q) >= q.threshold;

/* ──────────── domain logic: chat ──────────── */
export const applyTx = (
  st: EntityState, tx: Transaction, ts:TS,
): EntityState => {
  if (tx.kind !== 'chat') throw new Error('unknown tx kind');
  const rec = st.quorum.members[tx.from];
  if (!rec) throw new Error('unknown signer');
  if (tx.nonce !== rec.nonce) throw new Error('bad nonce');

  const members = {
    ...st.quorum.members,
    [tx.from]: { nonce:rec.nonce+1n, shares:rec.shares },
  };
  return {
    quorum:{...st.quorum, members},
    chat:[...st.chat,{from:tx.from,msg:tx.body.message,ts}],
  };
};

export const execFrame = (
  prev: Frame<EntityState>, txs:Transaction[], ts:TS,
): Frame<EntityState> => {
  const ordered = txs.slice().sort(sortTx);
  let st = prev.state;
  for(const tx of ordered) st = applyTx(st,tx,ts);
  return { height:prev.height+1n, ts, txs:ordered, state:st };
};

/* ──────────── replica FSM ──────────── */
export const applyCommand = (rep:Replica, cmd:Command):Replica => {
  switch(cmd.type){
    case 'ADD_TX':
      return { ...rep, mempool:[...rep.mempool,cmd.tx] };

    case 'PROPOSE':{
      if(rep.isAwaitingSignatures||!rep.mempool.length) return rep;
      const frame = execFrame(rep.last,rep.mempool,cmd.ts);
      const proposal:ProposedFrame<EntityState>={
        ...frame, hash:hashFrame(frame),
        sigs:new Map([[rep.proposer,'0x00']]),
      };
      return{
        ...rep, mempool:[], isAwaitingSignatures:true, proposal
      };
    }

    case 'SIGN':{
      if(!rep.isAwaitingSignatures||!rep.proposal) return rep;
      if(cmd.frameHash!==rep.proposal.hash) return rep;
      if(!rep.last.state.quorum.members[cmd.signer]) return rep;
      if(rep.proposal.sigs.has(cmd.signer)) return rep;
      const sigs=new Map(rep.proposal.sigs).set(cmd.signer,cmd.sig);
      return{...rep, proposal:{...rep.proposal,sigs}};
    }

    case 'COMMIT':{
      if(!rep.isAwaitingSignatures||!rep.proposal) return rep;
      if(hashFrame(cmd.frame)!==rep.proposal.hash) return rep;
      if(!thresholdReached(rep.proposal.sigs,rep.last.state.quorum))
        return rep;
      if(!process.env.DEV_SKIP_SIGS){
        const pubs = Object.keys(rep.last.state.quorum.members);
        if(!verifyAggregate(cmd.hanko,hashFrame(cmd.frame),pubs as any))
          throw new Error('invalid hanko');
      }
      return{
        ...rep, isAwaitingSignatures:false, proposal:undefined,
        last:cmd.frame,
      };
    }
    default: return rep;
  }
};
