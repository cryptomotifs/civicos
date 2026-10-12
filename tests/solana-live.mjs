import {Keypair,Connection,Transaction,TransactionInstruction,PublicKey} from '@solana/web3.js';
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const conn=new Connection('https://api.devnet.solana.com',{commitment:'confirmed',disableRetryOnRateLimit:true});
const key=Keypair.generate();const cookie='civicos_session='+crypto.randomUUID();let d;
async function post(b){const r=await fetch('http://127.0.0.1:5173/api/workspace',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({id:d?.id,revision:d?.revision,...b})});const v=await r.json();if(!r.ok)throw Error(v.error);d=v.dossier;return d;}
try{
console.log('Requesting test-network funds for an ephemeral QA signer.');
const aid=await conn.requestAirdrop(key.publicKey,100000000);
await conn.confirmTransaction(aid,'confirmed');
await post({op:'sample'});for(const c of d.claims)await post({op:'review',claimId:c.id,review:'accepted',note:'Synthetic demonstration checked during end-to-end testing.'});
await post({op:'freeze',reviewer:'CivicOS test reviewer (synthetic)',decision:'Request more evidence',rationale:'The synthetic applicant must reconcile attendance and calibration before this grant could proceed.'});
const hash=d.snapshots.at(-1).hash;const bh=await conn.getLatestBlockhash();
const tx=new Transaction({feePayer:key.publicKey,recentBlockhash:bh.blockhash});
tx.add(new TransactionInstruction({programId:new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),keys:[{pubkey:key.publicKey,isSigner:true,isWritable:false}],data:Buffer.from('CIVICOS:v1:sha256:'+hash)}));
tx.sign(key);const signature=await conn.sendRawTransaction(tx.serialize());await conn.confirmTransaction({...bh,signature},'confirmed');
await post({op:'anchor',signature,signer:key.publicKey.toBase58()});
assert.equal(d.snapshots.at(-1).receipt.signature,signature);
await fs.writeFile('../../outputs/CivicOS-verified-demo-receipt.json',JSON.stringify(d.snapshots.at(-1),null,2));
console.log(JSON.stringify({verified:true,network:'devnet',signature,hash,signer:key.publicKey.toBase58()}));
}catch(e){console.log(JSON.stringify({verified:false,error:e.message}));process.exitCode=1;}
