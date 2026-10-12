import {env} from 'cloudflare:workers';
import {digest,canonical,admissible,validateClaims,type Dossier,type Claim,type Receipt} from './evidence';
export const MEMO_PROGRAM='MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
export const memoFor=(hash:string)=>'CIVICOS:v1:sha256:'+hash;
export function db(){const database=(env as unknown as {DB:D1Database}).DB;if(!database)throw new Error('Evidence storage is not configured.');return database;}
export function owner(req:Request){const id=req.headers.get('oai-authenticated-user-id');if(id)return {id:'user:'+id,cookie:null};const existing=req.headers.get('cookie')?.match(/(?:^|;\s*)civicos_session=([a-f0-9-]{36})/i)?.[1];const token=existing||crypto.randomUUID();return {id:'session:'+token,cookie:existing?null:'civicos_session='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000'+(new URL(req.url).protocol==='https:'?'; Secure':'')};}
export function json(data:unknown,status=200,cookie:string|null=null){const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};if(cookie)headers['Set-Cookie']=cookie;return new Response(JSON.stringify(data),{status,headers});}
export function requireSameOrigin(req:Request){const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new Error('Cross-origin writes are not allowed.');if(req.headers.get('sec-fetch-site')==='cross-site')throw new Error('Cross-site request rejected.');}
export async function readBody(req:Request){if(Number(req.headers.get('content-length')||0)>500000)throw new Error('Request exceeds the 500 KB limit.');const raw=await req.text();if(raw.length>500000)throw new Error('Request exceeds the 500 KB limit.');return JSON.parse(raw);}
export const text=(value:unknown,max=2000)=>typeof value==='string'?value.trim().slice(0,max):'';
export function date(value:unknown){const s=text(value,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s)))throw new Error('A valid date is required.');return s;}
export async function rpc(method:string,params:unknown[]){const url=(env as unknown as {SOLANA_RPC_URL?:string}).SOLANA_RPC_URL||'https://api.devnet.solana.com';const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error('Solana devnet is unavailable ('+r.status+'). Try again shortly.');const v=await r.json() as {result:any;error?:{message:string}};if(v.error)throw new Error('Solana: '+v.error.message.slice(0,160));return v.result;}
export async function verifyChain(signature:string,hash:string,signer:string):Promise<Receipt>{
if(!/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(signature)||!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(signer))throw new Error('Invalid Solana signature or public key.');
const tx=await rpc('getTransaction',[signature,{encoding:'jsonParsed',commitment:'confirmed',maxSupportedTransactionVersion:0}]);
if(!tx)throw new Error('Transaction is not confirmed or not yet available. Retry after confirmation.');
if(!tx.meta||tx.meta.err)throw new Error('The transaction failed on Solana.');
const signed=tx.transaction?.message?.accountKeys?.some((k:any)=>k.pubkey===signer&&k.signer===true);
const memo=tx.transaction?.message?.instructions?.some((i:any)=>i.programId===MEMO_PROGRAM&&i.parsed===memoFor(hash));
if(!signed||!memo)throw new Error('Receipt does not match this dossier hash and signing wallet.');
return {signature,signer,slot:tx.slot,blockTime:tx.blockTime??null,verifiedAt:new Date().toISOString(),network:'devnet'};
}
