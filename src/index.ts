import { Runtime } from './core/runtime';
import { Input, Transaction } from './types';
import { randomPriv, pub, addr, sign } from './crypto/bls';

const rt=new Runtime();

/* build one chat Tx from signer 0 to say “hello” */
(async ()=>{
  const priv=randomPriv();
  const from=addr(pub(priv));
  // TAKE signer 0 from runtime instead (for nonce 0)
})();

// (left minimal – insert your own test harness; see "next steps" below).
