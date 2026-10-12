export type EvidenceSource={id:string;title:string;publisher:string;url:string;availableAt:string;effectiveAt:string;family:string;text:string;hash:string;addedAt:string};
export type Claim={id:string;text:string;status:'supported'|'contradicted'|'unsupported';reason:string;citations:{sourceId:string;quote:string;matched:boolean}[];review:'pending'|'accepted'|'challenged';note:string};
export type Receipt={signature:string;signer:string;slot:number;blockTime:number|null;verifiedAt:string;network:'devnet'};
export type Snapshot={hash:string;payload:Record<string,unknown>;createdAt:string;receipt?:Receipt};
export type Dossier={id:string;title:string;question:string;criteria:string;kind:string;cutoff:string;sources:EvidenceSource[];claims:Claim[];summary:string;analysis:{mode:'fixture'|'checks'|'manual';model:string;at:string;promptVersion:string}|null;history:{at:string;action:string;detail:string}[];snapshots:Snapshot[];decision:string;reviewer:string;rationale:string;state:'draft'|'frozen';revision:number;createdAt:string;updatedAt:string;sample:boolean};
export function canonical(v:unknown):string{if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';const o=v as Record<string,unknown>;return '{'+Object.keys(o).sort().map(k=>JSON.stringify(k)+':'+canonical(o[k])).join(',')+'}';}
export async function digest(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');}
export const normalize=(s:string)=>s.replace(/\s+/g,' ').trim();
export const admissible=(s:EvidenceSource,cutoff:string)=>s.availableAt<=cutoff;
export function validateClaims(claims:Claim[],sources:EvidenceSource[],cutoff:string):Claim[]{return claims.slice(0,24).map((c,i)=>{const citations=(c.citations||[]).map(q=>{const s=sources.find(s=>s.id===q.sourceId);return {sourceId:q.sourceId,quote:q.quote,matched:!!s&&admissible(s,cutoff)&&normalize(q.quote).length>=8&&normalize(s.text).includes(normalize(q.quote))};});const valid=citations.some(q=>q.matched);return {id:'C'+(i+1),text:c.text.slice(0,1600),status:valid?c.status:'unsupported',reason:valid?c.reason:'No exact passage was found in eligible evidence. '+c.reason,citations,review:'pending',note:''};});}
export function frozenPayload(d:Dossier,at:string){return {schema:'civicos.dossier.v1',id:d.id,title:d.title,question:d.question,reviewCriteria:d.criteria||'',kind:d.kind,knowledgeCutoff:d.cutoff,sources:d.sources,claims:d.claims,summary:d.summary,analysis:d.analysis,humanReview:{reviewer:d.reviewer,decision:d.decision,rationale:d.rationale},previousHash:d.snapshots.at(-1)?.hash??null,frozenAt:at};}
export function addEvent(d:Dossier,action:string,detail:string){const at=new Date().toISOString();d.history.push({at,action,detail});d.updatedAt=at;}
export function newDossier(title:string,question:string,kind='Grant review'):Dossier{const now=new Date().toISOString();return {id:crypto.randomUUID(),title,question,criteria:'',kind,cutoff:now.slice(0,10),sources:[],claims:[],summary:'Add source material to begin an evidence review.',analysis:null,history:[{at:now,action:'Dossier created',detail:'Evidence workspace opened.'}],snapshots:[],decision:'Request more evidence',reviewer:'',rationale:'',state:'draft',revision:0,createdAt:now,updatedAt:now,sample:false};}
export function invalidate(d:Dossier){d.claims=d.claims.map(c=>{const checked=validateClaims([c],d.sources,d.cutoff)[0];return {...checked,id:c.id};});d.analysis=d.claims.length?{mode:'manual',model:'Review required',at:new Date().toISOString(),promptVersion:'manual-2'}:null;d.summary='Evidence or criteria changed. Existing findings are retained and every review must be checked again.';}

export function evidenceChecks(d:Dossier){
 const eligible=d.sources.filter(s=>admissible(s,d.cutoff));
 const groups=new Map<string,number>();for(const s of eligible){const key=s.family.trim().toLowerCase();groups.set(key,(groups.get(key)||0)+1);}
 const quotes=d.claims.flatMap(c=>c.citations);
 const invalid=quotes.filter(q=>{const s=eligible.find(s=>s.id===q.sourceId);return !s||normalize(q.quote).length<8||!normalize(s.text).includes(normalize(q.quote));}).length;
 return [
 {label:'Evidence date',detail:(d.sources.length-eligible.length)+' source(s) excluded after '+d.cutoff,issue:eligible.length!==d.sources.length},
 {label:'Source independence',detail:groups.size+' declared families across '+eligible.length+' eligible sources. '+[...groups.values()].filter(n=>n>1).length+' repeated families.',issue:[...groups.values()].some(n=>n>1)},
 {label:'Exact quotations',detail:(quotes.length-invalid)+' of '+quotes.length+' passages match eligible text.',issue:invalid>0||quotes.length===0},
 {label:'Review criteria',detail:d.criteria?'A review rubric is recorded. Its meaning is assessed by the reviewer.':'No review rubric recorded.',issue:!d.criteria},
 {label:'Human review',detail:d.claims.filter(c=>c.review!=='pending').length+' of '+d.claims.length+' findings reviewed.',issue:!d.claims.length||d.claims.some(c=>c.review==='pending')}
 ];
}
export function runEvidenceChecks(d:Dossier){
 d.claims=d.claims.map(c=>{const checked=validateClaims([c],d.sources,d.cutoff)[0];return {...c,citations:checked.citations,...(checked.status!==c.status?{status:checked.status,reason:checked.reason,review:'pending' as const,note:''}:{})};});
 d.summary='Rule-based checks examine dates, declared source families and exact quotations. People assess what the evidence means. '+evidenceChecks(d).filter(c=>c.issue).length+' checks need attention.';
 d.analysis={mode:'checks',model:'Deterministic checks',at:new Date().toISOString(),promptVersion:'checks-1'};
}
