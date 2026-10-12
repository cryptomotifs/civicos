import {db,owner,json,text,date,readBody,requireSameOrigin,verifyChain} from '../../../lib/server';
import {newDossier,addEvent,invalidate,digest,canonical,frozenPayload,runEvidenceChecks,validateClaims,type Claim,type Dossier} from '../../../lib/evidence';
import {sampleDossier} from '../../../lib/sample';
export const dynamic='force-dynamic';
export async function GET(req:Request){const who=owner(req);try{const rows=await db().prepare('SELECT data, revision FROM dossiers WHERE owner = ? ORDER BY updated DESC LIMIT 50').bind(who.id).all<{data:string;revision:number}>();return json({dossiers:rows.results.map(r=>({...JSON.parse(r.data),revision:r.revision}))},200,who.cookie);}catch{return json({error:'The evidence store could not be opened. Please retry.'},503,who.cookie);}}
export async function POST(req:Request){const who=owner(req);try{
requireSameOrigin(req);const b=await readBody(req);const op=b.op;let d:Dossier;
if(op==='create'||op==='sample'){
const count=await db().prepare('SELECT COUNT(*) AS n FROM dossiers WHERE owner = ?').bind(who.id).first<{n:number}>();if((count?.n||0)>=30)throw new Error('Workspace limit reached: 30 dossiers.');
if(op==='sample')d=await sampleDossier();else{const title=text(b.title,180),question=text(b.question,1500);if(!title||!question)throw new Error('A title and review question are required.');d=newDossier(title,question,text(b.kind,50)||'Grant review');}
await db().prepare('INSERT INTO dossiers (id,owner,data,revision,updated) VALUES (?,?,?,0,?)').bind(d.id,who.id,JSON.stringify(d),d.updatedAt).run();return json({dossier:d},200,who.cookie);}
const row=await db().prepare('SELECT data,revision FROM dossiers WHERE id=? AND owner=?').bind(text(b.id,80),who.id).first<{data:string;revision:number}>();if(!row)return json({error:'Dossier not found.'},404,who.cookie);
if(row.revision!==b.revision)return json({error:'This dossier changed in another tab. Refresh and try again.'},409,who.cookie);
d={...JSON.parse(row.data),revision:row.revision};
if(d.state==='frozen'&&!['amend','anchor'].includes(op))throw new Error('This record is frozen. Start a correction to preserve its history.');
if(op==='source'){
if(d.sources.length>=16)throw new Error('Maximum 16 sources per dossier.');
const s=b.source||{};const body=text(s.text,40000);if(body.length<30)throw new Error('Add at least 30 characters of source text.');
if(d.sources.reduce((n,s)=>n+s.text.length,0)+body.length>100000)throw new Error('This prototype supports 100,000 characters per dossier.');
const url=text(s.url,600);if(url&&!/^https?:\/\//i.test(url))throw new Error('Source links must start with https:// or http://.');
d.sources.push({id:'S'+crypto.randomUUID().slice(0,8),title:text(s.title,180)||'Untitled source',publisher:text(s.publisher,180)||'Not specified',url,availableAt:date(s.availableAt),effectiveAt:date(s.effectiveAt||s.availableAt),family:text(s.family,100)||crypto.randomUUID(),text:body,hash:await digest(body),addedAt:new Date().toISOString()});invalidate(d);addEvent(d,'Source added',text(s.title,180));
}else if(op==='remove-source'){d.sources=d.sources.filter(s=>s.id!==b.sourceId);invalidate(d);addEvent(d,'Source removed','Earlier frozen versions remain unchanged.');
}else if(op==='cutoff'){d.cutoff=date(b.cutoff);invalidate(d);addEvent(d,'Review date changed',d.cutoff);
}else if(op==='criteria'){d.criteria=text(b.criteria,4000);invalidate(d);addEvent(d,'Review criteria changed','The next frozen record will preserve these criteria.');
}else if(op==='check'){runEvidenceChecks(d);addEvent(d,'Evidence checks completed','Dates, source families and exact quotations checked without an AI service.');
}else if(op==='review'){const claim=d.claims.find(c=>c.id===b.claimId);if(!claim)throw new Error('Claim not found.');if(!['accepted','challenged'].includes(b.review))throw new Error('Invalid review.');claim.review=b.review;claim.note=text(b.note,2000);if(b.review==='challenged'&&!claim.note)throw new Error('Explain why you challenge this finding.');addEvent(d,'Claim reviewed',claim.id+': '+claim.review);
}else if(op==='manual-claim'||op==='edit-claim'){
const statement=text(b.statement,1600),reason=text(b.reason,2000),status=b.status||'unsupported';
if(!statement||reason.length<10)throw new Error('Enter a claim and an assessment of at least 10 characters.');
if(!['supported','contradicted','unsupported'].includes(status))throw new Error('Choose a valid assessment.');
const existing=op==='edit-claim'?d.claims.find(c=>c.id===b.claimId):null;
if(op==='edit-claim'&&!existing)throw new Error('Claim not found.');
if(!existing&&d.claims.length>=24)throw new Error('Maximum 24 claims.');
const citations=Array.isArray(b.citations)?b.citations.slice(0,6).map((q:any)=>({sourceId:text(q.sourceId,80),quote:text(q.quote,3000),matched:false})).filter((q:any)=>q.sourceId||q.quote):[];
const proposed={id:existing?.id||'C'+(d.claims.length+1),text:statement,status,reason,citations,review:'pending',note:''} as Claim;
const checked=validateClaims([proposed],d.sources,d.cutoff)[0];
if(citations.some((_:unknown,i:number)=>!checked.citations[i].matched))throw new Error('Each quotation must exactly match an eligible source. Check the quote and publication date.');
if(status!=='unsupported'&&!citations.length)throw new Error('Supported or contradicted findings require at least one exact quotation.');
const claim={...proposed,citations:checked.citations};
if(existing)d.claims=d.claims.map(c=>c.id===existing.id?claim:c);else d.claims.push(claim);
d.analysis={mode:'manual',model:'Human-authored',at:new Date().toISOString(),promptVersion:'manual-2'};
d.summary='Reviewer-authored findings. Exact quotation matching checks provenance; a person must assess meaning and review every finding.';
addEvent(d,existing?'Finding revised':'Finding added',statement.slice(0,100));
}else if(op==='freeze'){
if(!d.claims.length||d.claims.some(c=>c.review==='pending'))throw new Error('Review every claim before freezing this dossier.');
d.reviewer=text(b.reviewer,120);d.rationale=text(b.rationale,4000);d.decision=text(b.decision,80);
if(!d.reviewer||d.rationale.length<20)throw new Error('Enter your name and a rationale of at least 20 characters.');
if(!['Request more evidence','Proceed with conditions','Do not proceed'].includes(d.decision))throw new Error('Select a review outcome.');
const at=new Date().toISOString();const payload=frozenPayload(d,at);d.snapshots.push({hash:await digest(canonical(payload)),payload,createdAt:at});d.state='frozen';addEvent(d,'Record frozen',d.decision+' · '+d.reviewer);
}else if(op==='amend'){if(d.state!=='frozen')throw new Error('Only frozen records can be corrected.');d.state='draft';d.claims=d.claims.map(c=>({...c,review:'pending',note:''}));addEvent(d,'Correction started','Original snapshot retained. Next version links to its predecessor.');
}else if(op==='anchor'){const snapshot=d.snapshots.at(-1);if(!snapshot)throw new Error('Freeze the record first.');if(await digest(canonical(snapshot.payload))!==snapshot.hash)throw new Error('Snapshot integrity check failed.');snapshot.receipt=await verifyChain(text(b.signature,100),snapshot.hash,text(b.signer,60));addEvent(d,'Solana receipt verified',snapshot.receipt.signature);
}else throw new Error('Unknown action.');
if(d.history.length>300)throw new Error('Dossier event limit reached. Export this record and start another.');
d.revision++;const result=await db().prepare('UPDATE dossiers SET data=?, revision=?, updated=? WHERE id=? AND owner=? AND revision=?').bind(JSON.stringify(d),d.revision,d.updatedAt,d.id,who.id,row.revision).run();
if(result.meta.changes!==1)return json({error:'Dossier changed during this operation. Refresh and retry.'},409,who.cookie);
return json({dossier:d},200,who.cookie);
}catch(e){return json({error:e instanceof Error?e.message:'Request failed.'},400,who.cookie);}}
