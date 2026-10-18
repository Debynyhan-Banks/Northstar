import { createSaveQueue } from "./cloud-save-queue.js";

export function initGrowthWorkspace(config) {
'use strict';
// C.F. Mechanical shared business discovery and growth workspace.
// Browser-only demo by default; Supabase mode provides authenticated, shared persistence.
const CONFIG=config||{};
const CLOUD=Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
const KEY='cf-mechanical-growth-portal-v1';
const SEATS={christian:'Christian Okoh',growth:'Debynyhan Banks'};
const NAV=[['overview','◫','Overview'],['discovery','◇','Business discovery'],['alignment','≋','Alignment'],['roadmap','▥','90-day roadmap'],['tasks','☑','Accountability'],['decisions','◎','Decisions'],['opportunities','▣','Bid pipeline'],['updates','✎','Weekly updates'],['settings','⚙','Workspace']];
const GROUPS=[
  {id:'vision',title:'Vision and direction',sub:'Where C.F. Mechanical should go, and how you define success.'},
  {id:'foundation',title:'Current business position',sub:'What exists today and what we need to strengthen.'},
  {id:'services',title:'Capabilities and capacity',sub:'Types of work, supervision, staffing and project delivery.'},
  {id:'estimating',title:'Estimating and bids',sub:'Professional takeoff software, estimates and bidding workflow.'},
  {id:'finance',title:'Financial readiness',sub:'Resources, project funding and financial priorities.'},
  {id:'partnership',title:'Working together',sub:'Leadership, decisions, communication and responsibilities.'},
  {id:'website',title:'Market presence',sub:'Brand, website, credibility and customer acquisition.'},
  {id:'priorities',title:'The first 90 days',sub:'Realistic outcomes, constraints and how we will track progress.'},
];
const QUESTIONS=[
{id:'three_year',group:'vision',label:'What would a successful C.F. Mechanical look like in three years?',type:'long',hint:'Consider project size, markets, annual revenue, staffing, and your role in the business.'},
{id:'primary_goal',group:'vision',label:'What is the highest priority for the company right now?',type:'single',align:true,options:['Build a steady commercial customer base','Win larger mechanical construction bids','Develop recurring service and maintenance revenue','Build a specialized industrial or data-center practice','Improve the company foundation before pursuing growth']},
{id:'target_markets',group:'vision',label:'Which customer markets interest you most?',type:'multi',options:['General contractors','Restaurants and commercial kitchens','Commercial property owners','Industrial facilities','Hospitals and healthcare','Schools and universities','Data centers','Government/public projects','Multifamily properties']},
{id:'three_year_role',group:'vision',label:'How do you envision your role as the company grows?',type:'single',options:['Remain employed and oversee selected projects','Transition to working in C.F. Mechanical full time','Lead technical direction while foremen run sites','Undecided; depends on contract opportunities']},
{id:'success_definition',group:'vision',label:'What would make the first year a success?',type:'long'},
{id:'completed_project',group:'foundation',label:'Describe the job C.F. Mechanical has completed.',type:'long',hint:'Scope, rough contract size, dates, customer type, photographs, and reference availability.'},
{id:'company_assets',group:'foundation',label:'Which of these are already in place?',type:'multi',options:['Business bank account','General liability insurance','Ohio workers’ compensation coverage','Commercial auto coverage','Accountant or bookkeeper','Accounting software','Supplier accounts','Business credit line','Safety program','Current company portfolio','Bonding relationship']},
{id:'registration_details',group:'foundation',label:'What license classifications, registrations, and additional qualifications does the company currently hold?',type:'long',hint:'We already have the reported Ohio license number 50350 and expiration October 17, 2027. Please confirm exact classifications and any local registrations.'},
{id:'past_contacts',group:'foundation',label:'Do you have existing customers, general-contractor relationships or industry contacts we can approach?',type:'long'},
{id:'preferred_services',group:'services',label:'Which services should C.F. Mechanical offer first?',type:'multi',options:['Commercial HVAC installations','Rooftop units and replacements','Commercial kitchen hoods and ventilation','Ductwork and sheet metal','Industrial ventilation','Refrigeration','Hydronic piping and pumps','Chillers / mission-critical cooling','Mechanical service and maintenance','Other (explain below)']},
{id:'special_capabilities',group:'services',label:'Which mechanical systems and project types can the company perform confidently today?',type:'long',hint:'Distinguish personal trade experience from contracts completed by C.F. Mechanical.'},
{id:'labor_model',group:'services',label:'What staffing approach should we plan around?',type:'single',align:true,options:['Union workforce when contracts justify it','Small regular W-2 crew plus union labor as needed','Qualified subcontractors for complementary trades','Build crews gradually based on contract awards','Not yet determined']},
{id:'site_supervision',group:'services',label:'Who can provide site supervision while Christian is employed on another project?',type:'long',hint:'Include foreman options, availability, and any restrictions we should confirm.'},
{id:'contract_range',group:'services',label:'What contract size should we initially focus on?',type:'single',align:true,options:['Under $25,000','$25,000–$75,000','$75,000–$150,000','$150,000–$300,000','Over $300,000','Assess capacity before choosing a range']},
{id:'estimating_background',group:'estimating',label:'What experience do we have estimating commercial mechanical projects?',type:'long',hint:'Include quantity takeoffs, labor estimates, project specifications, subcontractor quotes, and software.'},
{id:'software_budget',group:'estimating',label:'What monthly budget would be appropriate for professional estimating software?',type:'single',align:true,options:['Under $100','$100–$300','$300–$750','Over $750','Review product options before setting a budget']},
{id:'estimating_needs',group:'estimating',label:'Which estimating capabilities matter most?',type:'multi',options:['PDF digital takeoffs','HVAC and ductwork assemblies','Pipe and fittings libraries','Labor-hour estimating','Supplier pricing and quote comparison','Revision/addendum tracking','Proposal generation','Team collaboration','Accounting export']},
{id:'technical_signoff',group:'estimating',label:'How should technical reviews and final bid approvals work?',type:'single',options:['Both review and approve every bid','Business lead prepares; Christian approves scope and price','Separate approval thresholds based on contract size','Decide after we test the first estimating workflow']},
{id:'capital_available',group:'finance',label:'How much working capital is realistically available for starting projects?',type:'single',options:['Under $5,000','$5,000–$20,000','$20,000–$50,000','More than $50,000','Prefer to discuss privately before entering an amount']},
{id:'cash_requirements',group:'finance',label:'Which financial items need attention first?',type:'multi',options:['Business banking/bookkeeping','Supplier credit','Business line of credit','Bonding prequalification','Cash-flow forecasting','Insurance and workers’ compensation','Contract/job-cost accounting','Prevailing-wage payroll processes']},
{id:'funding_preference',group:'finance',label:'What is the preferred approach to financing larger jobs?',type:'single',align:true,options:['Start with smaller self-financed contracts','Supplier credit and negotiated progress payments','Working-capital lender or line of credit','Partner with an established contractor','Evaluate all options based on each project']},
{id:'spending_approval',group:'finance',label:'Which spending or borrowing decisions should always receive joint approval?',type:'long',hint:'You can suggest thresholds or categories. No commitments are created by answering.'},
{id:'partner_role_title',group:'partnership',label:'What is your current title and role at C.F. Mechanical, and what responsibilities do you handle?',type:'long',hint:'Describe your title, day-to-day responsibilities, and any HVAC work you perform.'},
{id:'business_lead_scope',group:'partnership',label:'What do you expect Debynyhan Banks to lead?',type:'multi',options:['Business administration','Long-term strategy','Website, branding and marketing','Customer acquisition and GC relationships','Estimating software implementation','Bid intake and submission administration','Accounting and financial planning coordination','Vendor and supplier relationships','Project management systems','Hiring and HR administration']},
{id:'technical_lead_scope',group:'partnership',label:'What should Christian lead directly?',type:'multi',options:['Technical scope review','Licensed trade supervision','Field operations and quality','Workforce and union coordination','Safety and compliance','Supplier technical selections','Construction scheduling','Technical estimator reviews','Customer/project site meetings']},
{id:'joint_decisions',group:'partnership',label:'Which decisions should always be made together?',type:'multi',options:['Final bids and major contracts','New services or target markets','Financing, debt and guarantees','Significant purchases','Hiring management roles','Major website and marketing direction','New ownership arrangements','Annual budget and strategy']},
{id:'meeting_rhythm',group:'partnership',label:'How should we coordinate and review progress?',type:'single',align:true,options:['Weekly 30-minute meeting','Weekly 60-minute meeting','Twice-monthly working meeting','As needed plus shared dashboard'],hint:'The shared workspace can track progress between meetings.'},
{id:'partner_expectations',group:'partnership',label:'What does a productive business partnership look like to you?',type:'long',hint:'Consider decision-making, communication, responsibilities, compensation discussions, and future ownership expectations.'},
{id:'brand_position',group:'website',label:'How should C.F. Mechanical be positioned in the market?',type:'single',align:true,options:['Commercial mechanical contractor','Commercial and industrial HVAC specialist','Full-service mechanical construction partner','Specialized ventilation and kitchen hood contractor','Decide after analyzing market opportunities']},
{id:'website_priority',group:'website',label:'What should the website accomplish first?',type:'single',options:['Help general contractors prequalify us','Generate customer and bid requests','Communicate capabilities and experience','Establish credibility and professional presence','All of the above, with priorities to be determined']},
{id:'marketing_assets',group:'website',label:'What assets can we use for the company website and capability statement?',type:'multi',options:['Company logo','Domain name','Business email','Project photos (authorized)','Completed-project reference','Leadership biographies','License/insurance information','Safety qualifications','Existing brochures or proposals']},
{id:'brand_ideas',group:'website',label:'What visual style, messages, or competitors should influence the brand?',type:'long'},
{id:'ninety_success',group:'priorities',label:'Which 90-day outcomes are most useful to prioritize?',type:'multi',options:['Document business readiness','Define responsibilities and priorities','Launch a professional website','Choose/test estimating software','Create a capability statement','Build a GC prospect list','Submit qualified prequalification packages','Submit feasible commercial bids','Establish a supplier/financing plan','Create a sustainable project-delivery process']},
{id:'weekly_time',group:'priorities',label:'How much time can you realistically dedicate each week?',type:'single',options:['Less than 5 hours','5–10 hours','10–15 hours','15–25 hours','More than 25 hours','Varies by week']},
{id:'roadblocks',group:'priorities',label:'What could prevent us from making progress over the next 90 days?',type:'long'},
{id:'first_actions',group:'priorities',label:'What are the first three actions we should take together?',type:'long'},
];
const DECISIONS=[
{id:'focus',title:'First target market',desc:'Where do we concentrate our first business-development efforts?',options:['Commercial HVAC replacements','Kitchen hood and ventilation packages','Mechanical subcontracting with established GCs','Industrial / data-center mechanical projects','Decide after reviewing company capacity']},
{id:'sizing',title:'Initial project size',desc:'Choose a conservative initial bidding range, based on readiness and financing.',options:['Under $25,000','$25,000–$75,000','$75,000–$150,000','$150,000–$300,000','Determine after readiness review']},
{id:'estimating',title:'Professional estimating software',desc:'What is the first software selection approach?',options:['Trial affordable cloud takeoff tools','Evaluate mechanical-specific estimating platforms','Use existing tools until requirements are established','Obtain product demonstrations before deciding']},
{id:'approvals',title:'Major decision approvals',desc:'How should significant commitments and final bids be approved?',options:['Both approve all major commitments and final bids','Agree on written approval thresholds','Review and establish policy after discovery']},
{id:'roadmap',title:'90-day roadmap direction',desc:'How do we treat the preliminary roadmap?',options:['Approve overall direction; revise milestones together','Complete discovery before approving roadmap','Rework scope and timing first']},
];
const DEFAULT_TASKS=[
{id:'t1',title:'Complete both discovery questionnaires',owner:'both',start:1,duration:2,status:'not-started',priority:'high',notes:'Capture the company vision and the business-development perspective.',depends:''},
{id:'t2',title:'Review company license, registrations and business records',owner:'christian',start:1,duration:3,status:'not-started',priority:'high',notes:'Document verified license classifications and current company readiness.',depends:''},
{id:'t3',title:'Define lead responsibilities and joint approvals',owner:'both',start:2,duration:2,status:'not-started',priority:'high',notes:'Use discovery answers to define an operating decision matrix.',depends:'t1'},
{id:'t4',title:'Confirm workforce and field-supervision plan',owner:'christian',start:2,duration:4,status:'not-started',priority:'high',notes:'Confirm union and employer requirements before relying on crew availability.',depends:'t2'},
{id:'t5',title:'Review insurance, bonding and cash-flow options',owner:'growth',start:3,duration:3,status:'not-started',priority:'high',notes:'Identify funding requirements before accepting a sizeable project.',depends:'t2'},
{id:'t6',title:'Build company capability statement',owner:'growth',start:3,duration:3,status:'not-started',priority:'medium',notes:'Separate founder experience from company project history.',depends:'t2'},
{id:'t7',title:'Agree on brand positioning and website structure',owner:'both',start:3,duration:2,status:'not-started',priority:'medium',notes:'Decide based on target services and real credentials.',depends:'t1'},
{id:'t8',title:'Launch the initial public company website',owner:'growth',start:4,duration:4,status:'not-started',priority:'medium',notes:'Professional capabilities and request-a-bid intake; no unsupported project claims.',depends:'t7'},
{id:'t9',title:'Shortlist estimating software and compare options',owner:'growth',start:4,duration:3,status:'not-started',priority:'high',notes:'Compare mechanical takeoff, assemblies, licensing costs and collaboration.',depends:'t1'},
{id:'t10',title:'Validate a sample mechanical estimate together',owner:'both',start:6,duration:3,status:'not-started',priority:'high',notes:'Test the complete bid workflow before pursuing complex opportunities.',depends:'t9'},
{id:'t11',title:'Build a qualified general-contractor contact list',owner:'growth',start:5,duration:4,status:'not-started',priority:'medium',notes:'Focus on commercial mechanical subcontract opportunities.',depends:'t7'},
{id:'t12',title:'Complete suitable contractor prequalifications',owner:'growth',start:7,duration:5,status:'not-started',priority:'medium',notes:'Only submit where credentials and capacity are accurate.',depends:'t6'},
{id:'t13',title:'Review and submit qualified bids when ready',owner:'both',start:9,duration:5,status:'not-started',priority:'high',notes:'No mandatory award target; verify labor, insurance, price and cash flow first.',depends:'t10'},
{id:'t14',title:'Review progress and define SMART goals',owner:'both',start:10,duration:4,status:'not-started',priority:'medium',notes:'Finalize measurable goals after the discovery and strategy discussions.',depends:'t1'},
];
const STATUS={ 'not-started':'Not started','in-progress':'In progress','needs-review':'Needs review','completed':'Completed'};
const STAGES=['New lead','Qualifying','Invited to bid','Estimating','Submitted','Awarded','Not pursued'];
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attr=esc;
const uid=()=>crypto.randomUUID?.()||('id-'+Date.now()+'-'+Math.floor(Math.random()*1e7));
const short=s=>String(s||'').slice(0,110);
const formatDate=s=>s?new Date(s).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'—';
const stable=v=>Array.isArray(v)?JSON.stringify([...v].sort()):String(v??'');
const val=v=>Array.isArray(v)?v.join(', '):String(v??'');
const now=()=>new Date().toISOString();
let sdk=null,db=null,auth=null,workspace=null,membership=null,pollTimer=null;
const state={view:'overview',seat:'christian',group:0,records:{},modal:null,submitting:false,lastSaved:'',search:'',demo:!CLOUD,cloudError:'',authScreen:'login'};
const recordKey=(category,id)=>`${category}|${id}`;
const rec=(category,id)=>state.records[recordKey(category,id)]?.body||null;
const collection=category=>Object.values(state.records).filter(r=>r.category===category).map(r=>({...r.body,_id:r.object_id,_created_at:r.created_at,_updated_at:r.updated_at}));
const isCloud=()=>Boolean(CLOUD&&auth&&workspace&&membership);
function storeDemo(){localStorage.setItem(KEY,JSON.stringify({records:state.records,seat:state.seat}));}
function seedDemo(){
  try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved?.records){state.records=saved.records;state.seat=saved.seat||'christian';return}}catch{ /* Initialize a new preview if stored data cannot be read. */ }
  for(const t of DEFAULT_TASKS){const id=recordKey('task',t.id);state.records[id]={category:'task',object_id:t.id,body:{...t,evidence:'',createdAt:now()},created_at:now(),updated_at:now()}}
  storeDemo();
}
let saveTimer=null;
const saveQueue=createSaveQueue({
 isActive:isCloud,
 saveRows:async rows=>{
  // Immutable records can be retried after an ambiguous network failure without
  // attempting an update forbidden by the append-only policies.
  for(const immutable of [false,true]){
   const batch=rows.filter(row=>['event','comment','update'].includes(row.category)===immutable);
   if(!batch.length)continue;
   const {error}=await db.from('app_records').upsert(batch,{onConflict:'workspace_id,category,object_id',ignoreDuplicates:immutable});
   if(error)throw error;
  }
 },
 onSaved:hasPending=>{state.lastSaved=hasPending?'Changes waiting to save':'Saved to shared workspace'},
 onFailure:()=>{state.lastSaved='Changes not saved';toast('Cloud save failed. Keep this page open and use Refresh shared data to retry.',true)}
});
function saveRecord(category,id,body,delay=0){
 const rk=recordKey(category,id);const existing=state.records[rk];state.records[rk]={category,object_id:id,body,created_at:existing?.created_at||now(),updated_at:now()};
 if(!isCloud()){storeDemo();state.lastSaved='Saved on this device';return}
 saveQueue.enqueue(rk,{workspace_id:workspace.id,category,object_id:id,body});
 state.lastSaved='Changes waiting to save';
 clearTimeout(saveTimer);saveTimer=setTimeout(()=>{void saveQueue.flush()},delay);
}
async function flushQueue(){return saveQueue.flush()}
function actionEvent(action,details){const id=uid();saveRecord('event',id,{action,details,actor:state.seat,createdAt:now()})}
function toast(message,isError=false){const el=$('#toast');el.textContent=message;el.style.background=isError?'#8e4245':'#1e3e49';el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3500)}
async function connectCloud(){
 try{
   sdk=await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
   db=sdk.createClient(CONFIG.supabaseUrl,CONFIG.supabaseAnonKey);
   const {data,error}=await db.auth.getSession();if(error)throw error;
   auth=data.session?.user||null;
   db.auth.onAuthStateChange((_event,session)=>{const newId=session?.user?.id||null;if(newId!==(auth?.id||null)){auth=session?.user||null;workspace=null;membership=null;setTimeout(()=>initCloudWorkspace(),0)}});
   if(auth)await initCloudWorkspace();else render();
 }catch(e){state.cloudError=e.message||String(e);render()}
}
async function initCloudWorkspace(){
 if(!auth){workspace=null;membership=null;render();return}
 const {data,error}=await db.from('workspace_members').select('workspace_id,seat,role,workspaces(id,name)').eq('user_id',auth.id).limit(1);
 if(error){state.cloudError=error.message;render();return}
 if(data?.length){membership=data[0];workspace=membership.workspaces;state.seat=membership.seat;await loadCloudRecords(true);if(pollTimer)clearInterval(pollTimer);pollTimer=setInterval(()=>loadCloudRecords(false),20000)}
 else{workspace=null;membership=null;render()}
}
async function loadCloudRecords(shouldRender=true){
 if(!isCloud())return false;
 if(!(await flushQueue()))return false;
 const {data,error}=await db.from('app_records').select('category,object_id,body,created_at,updated_at').eq('workspace_id',workspace.id);
 if(error){if(shouldRender)toast('Could not retrieve workspace records: '+error.message,true);return false}
 // Do not replace local edits made while the request was in flight.
 if(saveQueue.hasUnsaved())return false;
 const fresh={};for(const r of data||[])fresh[recordKey(r.category,r.object_id)]=r;
 state.records=fresh;
 if(!collection('task').length){const rows=DEFAULT_TASKS.map(t=>({workspace_id:workspace.id,category:'task',object_id:t.id,body:{...t,evidence:'',createdAt:now()}}));const {error:se}=await db.from('app_records').upsert(rows,{onConflict:'workspace_id,category,object_id',ignoreDuplicates:true});if(!se){rows.forEach(r=>state.records[recordKey(r.category,r.object_id)]={...r,created_at:now(),updated_at:now()})}}
 if(shouldRender)render();else if(!state.modal && document.activeElement?.tagName!=='INPUT' && document.activeElement?.tagName!=='TEXTAREA')render();
 return true;
}
function render(){
 if(CLOUD&&state.cloudError&&!sdk){$('#root').innerHTML=`<div class="auth-wrap"><div class="auth-card"><div class="auth-mark">CF</div><h1>Connection unavailable</h1><p>${esc(state.cloudError)}</p><p>Check your network connection or ask the workspace owner for help.</p><button class="btn primary" onclick="location.reload()">Retry</button></div></div>`;return}
 if(CLOUD&&!auth){renderAuth();return}
 if(CLOUD&&!workspace){renderWorkspaceSetup();return}
 const page=({overview:pageOverview,discovery:pageDiscovery,alignment:pageAlignment,roadmap:pageRoadmap,tasks:pageTasks,decisions:pageDecisions,opportunities:pageOpportunities,updates:pageUpdates,settings:pageSettings})[state.view]||pageOverview;
 $('#root').innerHTML=`<div class="app-shell"><aside class="sidebar"><div class="logo"><div class="logo-mark">CF</div><div><strong>C.F. MECHANICAL</strong><small>GROWTH WORKSPACE</small></div></div><div class="nav-group"><div class="nav-heading">Strategy & execution</div>${navItems()}</div><div class="sidebar-bottom"><div class="sync-pill"><span class="sync-dot ${isCloud()?'cloud':''}"></span><div><strong>${isCloud()?'Private shared workspace':'Local preview'}</strong><br>${isCloud()?'Updates synchronize across the two accounts.':'Only this browser has these changes. Configure Supabase to collaborate.'}</div></div></div><div class="mobile-nav">${navItems()}</div></aside><div class="main-panel"><header class="topbar"><div class="topbar-left"><strong>C.F. Mechanical, LLC</strong> / ${NAV.find(x=>x[0]===state.view)?.[2]}</div><div class="topbar-actions">${!isCloud()?`<div class="person-pill">Preview as: <select id="seat-select" class="select" style="width:auto;min-height:30px;padding:4px 7px"><option value="christian" ${state.seat==='christian'?'selected':''}>Christian</option><option value="growth" ${state.seat==='growth'?'selected':''}>Debynyhan Banks</option></select></div>`:`<div class="person-pill"><div class="avatar">${state.seat==='christian'?'CO':'DB'}</div><span>${esc(SEATS[state.seat])}</span></div>`}<button class="btn small" data-action="export">Export progress ↓</button></div></header><main class="page">${page()}</main></div></div>${renderModal()}`;
 bindListeners();
}
function navItems(){return NAV.map(([k,ico,label])=>`<button class="nav-item ${state.view===k?'active':''}" data-view="${k}"><span class="nav-icon">${ico}</span>${label}</button>`).join('')}
function heading(eyebrow,title,sub,actions=''){return `<div class="heading-line"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p class="subhead">${sub}</p></div>${actions?`<div class="button-row">${actions}</div>`:''}</div>`}
function statusBadge(status){const cls=status==='completed'?'ready':status==='in-progress'?'blue':status==='needs-review'?'warn':'';return `<span class="tag ${cls}">${esc(STATUS[status]||status||'—')}</span>`}
function ownerLabel(owner){return owner==='both'?'Both partners':owner==='christian'?'Christian':'Debynyhan Banks'}
function progress(){const tasks=collection('task');return {tasks,finished:tasks.filter(t=>t.status==='completed').length,total:tasks.length,questions:QUESTIONS.length,answered:QUESTIONS.filter(q=>rec('response',`${state.seat}:${q.id}`)?.value?.length).length}}
function votesFor(id){return {christian:rec('vote',`christian:${id}`)?.choice||'',growth:rec('vote',`growth:${id}`)?.choice||''}}
function decisionCounts(){let agreed=0,pending=0,different=0;for(const d of DECISIONS){const v=votesFor(d.id);if(v.christian&&v.growth){if(v.christian===v.growth)agreed++;else different++}else pending++}return {agreed,pending,different}}
function surveyPct(seat){return Math.round(100*QUESTIONS.filter(q=>hasAnswer(rec('response',`${seat}:${q.id}`)?.value)).length/QUESTIONS.length)}
function hasAnswer(v){return Array.isArray(v)?v.length>0:String(v??'').trim().length>0}
function getQValue(seat,id){return rec('response',`${seat}:${id}`)?.value??(QUESTIONS.find(q=>q.id===id)?.type==='multi'?[]:'')}
function pageOverview(){
 const p=progress(),d=decisionCounts(),latest=collection('event').sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,6);
 return `${heading('Shared direction, measurable progress','Building C.F. Mechanical Together','A workspace to understand the business, clarify responsibilities and develop a realistic 90-day roadmap. The timeline is a working draft until you both review it.','<button class="btn primary" data-view="discovery">Continue discovery →</button>')}
 <section class="welcome"><div><span class="eyebrow">Our vision · our strategy · our growth</span><h2>Strong business systems. Skilled mechanical execution.</h2><p>Christian is the president and works in HVAC. Use discovery to clarify each partner’s title, role and responsibilities. Major decisions are shared.</p></div><button class="btn gold" data-view="alignment">Review alignment →</button></section>
 <section class="stat-grid"><div class="panel stat"><div class="micro">Christian discovery</div><div class="stat-num">${surveyPct('christian')}%</div><div class="stat-label">Questions answered</div><div class="progress-track" style="margin-top:12px"><div class="progress-fill" style="width:${surveyPct('christian')}%"></div></div></div><div class="panel stat"><div class="micro">Debynyhan Banks</div><div class="stat-num">${surveyPct('growth')}%</div><div class="stat-label">Questions answered</div><div class="progress-track" style="margin-top:12px"><div class="progress-fill" style="width:${surveyPct('growth')}%"></div></div></div><div class="panel stat"><div class="micro">Roadmap completion</div><div class="stat-num">${p.finished}<span style="font-size:15px;color:#94a0a9"> / ${p.total}</span></div><div class="stat-label">Work items completed</div></div><div class="panel stat"><div class="micro">Joint decisions</div><div class="stat-num">${d.agreed}<span style="font-size:15px;color:#94a0a9"> / ${DECISIONS.length}</span></div><div class="stat-label">Aligned choices · ${d.different} to discuss</div></div></section>
 <div class="two-col"><section class="panel pad"><div class="heading-line"><div><h3>90-day roadmap snapshot</h3><p class="item-desc">Provisional tasks; dates and priorities are editable.</p></div><button class="btn small" data-view="roadmap">View Gantt →</button></div><div class="divider"></div><ul class="list">${p.tasks.sort((a,b)=>a.start-b.start).slice(0,6).map(t=>`<li><div class="item-head"><div><strong>${esc(t.title)}</strong><p class="item-desc">Weeks ${t.start}–${Math.min(13,t.start+t.duration-1)} · ${ownerLabel(t.owner)}</p></div>${statusBadge(t.status)}</div></li>`).join('')}</ul></section>
 <section class="panel pad"><div class="heading-line"><div><h3>Focus this week</h3><p class="item-desc">Prepare for a productive planning conversation.</p></div></div><div class="divider"></div><ul class="list"><li><strong>Finish discovery</strong><p class="item-desc">Each partner answers independently; open questions stay visible.</p></li><li><strong>Review assumptions</strong><p class="item-desc">Confirm what the company can bid, staff and finance today.</p></li><li><strong>Align expectations</strong><p class="item-desc">Agree on approval boundaries and day-to-day responsibilities.</p></li><li><strong>Define SMART goals later</strong><p class="item-desc">Set targets only after discovery and readiness review.</p></li></ul><button class="btn primary" style="margin-top:13px" data-view="decisions">Open joint decisions →</button></section></div>
 <div class="two-col" style="margin-top:18px"><section class="panel pad"><div class="heading-line"><div><h3>Business facts to verify</h3><p class="item-desc">Information provided by the partners, not independently validated.</p></div></div><div class="divider"></div><div class="mini-cards"><div class="mini-card"><strong>C.F. Mechanical, LLC</strong><p>Existing Ohio mechanical contracting business</p></div><div class="mini-card"><strong>Christian Okoh</strong><p>Owner and reported license holder</p></div><div class="mini-card"><strong>Ohio license 50350</strong><p>Reported expiration: October 17, 2027</p></div><div class="mini-card"><strong>One company project</strong><p>Professional experience and company work are separate</p></div></div></section><section class="panel pad"><h3>Recent workspace changes</h3><p class="item-desc">Shared updates are logged for reference.</p><div class="divider"></div>${latest.length?`<ul class="list">${latest.map(e=>`<li><strong>${esc(e.action)}</strong><p class="item-desc">${esc(e.details)} · ${ownerLabel(e.actor)} · ${formatDate(e.createdAt)}</p></li>`).join('')}</ul>`:'<div class="empty"><strong>No changes logged yet</strong><p>Tasks, decisions and progress updates will appear here.</p></div>'}</section></div>
 <p class="footnote">A practical workspace for working together. We will confirm priorities, owners and timelines as we learn more about the business.</p>`;
}
function questionField(q,seat){
 const current=getQValue(seat,q.id);let control='';
 if(q.type==='single'||q.type==='multi'){
  const multi=q.type==='multi';const arr=Array.isArray(current)?current:[current];
  control=`<div class="choice-grid">${q.options.map(o=>`<label class="choice"><input type="${multi?'checkbox':'radio'}" data-q="${q.id}" name="q-${q.id}" value="${attr(o)}" ${arr.includes(o)?'checked':''} ${isCloud()&&seat!==state.seat?'disabled':''}><span>${esc(o)}</span></label>`).join('')}</div>`;
 }else control=`<textarea class="textarea" rows="4" placeholder="Share your thoughts…" data-q="${q.id}" ${isCloud()&&seat!==state.seat?'readonly':''}>${esc(current)}</textarea>`;
 return `<div class="question"><div class="question-name"><span class="question-num">${String(QUESTIONS.indexOf(q)+1).padStart(2,'0')}</span>${esc(q.label)}</div>${q.hint?`<p class="field-hint">${esc(q.hint)}</p>`:''}${control}</div>`;
}
function pageDiscovery(){const group=GROUPS[state.group],qs=QUESTIONS.filter(q=>q.group===group.id),seat=state.seat;
 const answered=QUESTIONS.filter(q=>hasAnswer(getQValue(seat,q.id))).length;
 return `${heading('Business discovery','Define our direction','Complete your own answers to help us understand the company, decide where to focus, and clarify the responsibilities and expectations of each partner.')}
 <div class="panel survey-header"><div class="heading-line"><div><div class="micro">CURRENT RESPONDENT</div><h3 style="margin:4px 0">${esc(SEATS[seat])}</h3><p class="item-desc">${isCloud()?'Your responses are private to edit, but visible to both partners.':'Use the preview selector at the top to try each partner’s questionnaire.'}</p></div><div style="text-align:right;min-width:140px"><strong>${answered} of ${QUESTIONS.length}</strong><div class="caption">questions answered</div><div class="progress-track" style="margin-top:10px"><div class="progress-fill" style="width:${Math.round(100*answered/QUESTIONS.length)}%"></div></div></div></div><div class="sectiontabs">${GROUPS.map((g,i)=>{const groupQ=QUESTIONS.filter(q=>q.group===g.id);const filled=groupQ.filter(q=>hasAnswer(getQValue(seat,q.id))).length;return `<button class="sectiontab ${state.group===i?'active':''}" data-group="${i}">${i+1}. ${esc(g.title)}<small>${filled}/${groupQ.length} answered</small></button>`}).join('')}</div></div>
 <div class="panel survey-body" style="border-top:0;border-radius:0"><span class="eyebrow">Section ${state.group+1} of ${GROUPS.length}</span><h2>${esc(group.title)}</h2><p class="subhead">${esc(group.sub)}</p>${qs.map(q=>questionField(q,seat)).join('')}<p class="caption" id="save-note">${isCloud()?'Answers save to the private shared workspace.':'Preview answers are saved on this device only.'}</p></div>
 <div class="panel survey-bottom" style="border-top:0"><button class="btn" data-action="prev-group" ${state.group===0?'disabled':''}>← Previous</button><span class="caption">No answers are required. We can discuss open questions together.</span><button class="btn primary" data-action="next-group">${state.group===GROUPS.length-1?'Review alignment →':'Next section →'}</button></div>`;
}
function compareAnswers(){return QUESTIONS.map(q=>{const a=getQValue('christian',q.id),b=getQValue('growth',q.id);const status=!hasAnswer(a)||!hasAnswer(b)?'pending':q.type==='long'?'discussion':stable(a)===stable(b)?'aligned':'different';return {q,a,b,status}})}
function pageAlignment(){const aligned=compareAnswers(),counts={aligned:aligned.filter(x=>x.status==='aligned').length,different:aligned.filter(x=>x.status==='different'||x.status==='discussion').length,pending:aligned.filter(x=>x.status==='pending').length};
 return `${heading('Compare perspectives','Business alignment','A side-by-side view of your answers. Different priorities are conversation topics—not scores or failures. Agreements help shape the eventual strategy.', '<button class="btn" data-view="decisions">Record joint decisions →</button>')}
 <div class="stat-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div class="panel stat"><div class="micro">Shared perspective</div><div class="stat-num">${counts.aligned}</div><div class="stat-label">Comparable answers match</div></div><div class="panel stat"><div class="micro">Discuss together</div><div class="stat-num">${counts.different}</div><div class="stat-label">Different choices or written responses</div></div><div class="panel stat"><div class="micro">Need responses</div><div class="stat-num">${counts.pending}</div><div class="stat-label">Open questions</div></div></div>
 <div class="draft-note" style="margin-bottom:17px"><strong>Discovery precedes strategy.</strong> These comparisons identify topics to discuss; they do not automatically set company policy, transfer authority or finalize goals.</div>
 ${aligned.map(({q,a,b,status})=>`<div class="alignment-card panel"><div class="item-head"><strong>${esc(q.label)}</strong><span class="tag ${status==='aligned'?'ready':(status==='different'||status==='discussion')?'warn':''}">${status==='aligned'?'Matching choices':status==='different'?'Different choices':status==='discussion'?'Discuss written responses':'Awaiting answers'}</span></div><div class="alignment-answers"><div class="answer-box"><strong>CHRISTIAN</strong><p>${hasAnswer(a)?esc(val(a)):'Not answered yet'}</p></div><div class="answer-box"><strong>DEBYNYHAN BANKS</strong><p>${hasAnswer(b)?esc(val(b)):'Not answered yet'}</p></div></div></div>`).join('')}
`;
}
function sortedTasks(){return collection('task').sort((a,b)=>a.start-b.start||a.title.localeCompare(b.title))}
function ganttHTML(){const tasks=sortedTasks();return `<div class="gantt-scroll"><div class="gantt"><div class="gantt-head"><div class="micro">Activity / owner</div>${Array.from({length:13},(_,i)=>`<span>W${i+1}</span>`).join('')}</div>${tasks.map(t=>`<div class="gantt-row" data-edit-task="${attr(t.id)}" title="Edit ${attr(t.title)}"><div class="gantt-label"><strong>${esc(short(t.title))}</strong><small>${esc(ownerLabel(t.owner))} · ${esc(STATUS[t.status]||'Not started')}</small></div>${Array.from({length:13},(_,i)=>`<div class="gantt-cell ${i+1>=t.start&&i+1<t.start+t.duration?`active ${t.owner} ${t.status==='completed'?'done':t.status==='needs-review'?'review':''}`:''}"></div>`).join('')}</div>`).join('')}</div></div>`}
function pageRoadmap(){const ready=surveyPct('christian')===100&&surveyPct('growth')===100;return `${heading('Planning and scheduling','90-day growth roadmap','An editable 13-week Gantt chart showing proposed workstreams, owners and dependencies. Update the milestones as discovery and joint decisions clarify the direction.','<button class="btn primary" data-action="add-task">+ Add a work item</button>')}
 <div class="draft-note" style="margin-bottom:20px"><strong>${ready?'Ready for joint review':'Working draft—not yet approved'}.</strong> ${ready?'Both discovery questionnaires are complete. Review and adjust these tasks together before converting them into SMART goals.':'These are suggested activities, not agreed performance targets. Both partners should complete discovery and discuss priorities before confirming dates and metrics.'}</div>
 <section class="panel pad"><div class="heading-line"><div><h3>13-week Gantt chart</h3><p class="item-desc">Select any workstream to edit owner, timing, completion evidence, and status.</p></div><div class="legend"><span><i class="dot shared"></i>Both</span><span><i class="dot christian"></i>Christian</span><span><i class="dot growth"></i>Debynyhan Banks</span></div></div><div class="divider"></div>${ganttHTML()}</section>
 <section class="panel pad" style="margin-top:18px"><h3>How this roadmap becomes a working business plan</h3><div class="mini-cards" style="margin-top:15px"><div class="mini-card"><strong>01 · Discovery</strong><p>Document vision, capacity and available resources.</p></div><div class="mini-card"><strong>02 · Decisions</strong><p>Resolve target markets, responsibilities and approval processes.</p></div><div class="mini-card"><strong>03 · Strategy</strong><p>Select workstreams that address validated needs.</p></div><div class="mini-card"><strong>04 · SMART goals</strong><p>Define realistic owners, metrics and deadlines.</p></div></div></section>`}
function pageTasks(){let tasks=sortedTasks();const query=state.search.trim().toLowerCase();if(query)tasks=tasks.filter(t=>(t.title+' '+t.owner+' '+t.status).toLowerCase().includes(query));
 return `${heading('Ownership and follow-through','Accountability board','Every task has a lead, an expected timeframe and a clear status. Record the evidence of completion and review changes together.','<button class="btn primary" data-action="add-task">+ New task</button>')}
 <section class="panel pad"><div class="heading-line"><div><h3>Work items <span class="caption">(${tasks.length})</span></h3><p class="item-desc">The proposed workstreams can be revised after discovery.</p></div><input aria-label="Search tasks" id="task-search" value="${attr(state.search)}" class="input" style="max-width:270px" placeholder="Search tasks…"></div><div class="table-wrap" style="margin-top:17px"><table><thead><tr><th>Work item</th><th>Lead</th><th>Weeks</th><th>Priority</th><th>Status</th></tr></thead><tbody>${tasks.map(t=>`<tr class="tr-click" data-edit-task="${attr(t.id)}"><td class="title-cell">${esc(t.title)}<div class="caption">${esc(short(t.notes||''))}</div></td><td>${esc(ownerLabel(t.owner))}</td><td>${t.start}–${Math.min(13,t.start+t.duration-1)}</td><td>${esc(t.priority||'—')}</td><td>${statusBadge(t.status)}</td></tr>`).join('')}</tbody></table></div>${!tasks.length?'<div class="empty"><strong>No matching tasks</strong><p>Change the search or create a new work item.</p></div>':''}</section>`;
}
function pageDecisions(){const c=decisionCounts();return `${heading('Joint ownership of strategic choices','Decision log','Choose a direction independently, compare the responses, and discuss differences before finalizing the roadmap. Your selection is a planning preference, not a binding authorization.')}
 <div class="draft-note" style="margin-bottom:19px"><strong>Shared decision-making:</strong> Christian and Debynyhan Banks both participate in significant spending, final bids, major changes of strategy and other decisions you designate together.</div>
 <div class="stat-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div class="panel stat"><div class="micro">Aligned</div><div class="stat-num">${c.agreed}</div><div class="stat-label">Matching selections</div></div><div class="panel stat"><div class="micro">To discuss</div><div class="stat-num">${c.different}</div><div class="stat-label">Different selections</div></div><div class="panel stat"><div class="micro">Waiting</div><div class="stat-num">${c.pending}</div><div class="stat-label">One or more missing choices</div></div></div>
 ${DECISIONS.map(d=>{const votes=votesFor(d.id),current=votes[state.seat],status=votes.christian&&votes.growth?(votes.christian===votes.growth?'aligned':'different'):'pending';return `<section class="decision panel"><div class="item-head"><div><h3>${esc(d.title)}</h3><p style="margin:0">${esc(d.desc)}</p></div><span class="tag ${status==='aligned'?'ready':(status==='different'||status==='discussion')?'warn':''}">${status==='aligned'?'Shared direction':status==='different'?'Discuss together':'Open'}</span></div><div class="decision-select"><div><label class="label">Your proposed direction (${esc(SEATS[state.seat])})</label><select class="select" data-vote="${d.id}"><option value="">Select a direction…</option>${d.options.map(o=>`<option value="${attr(o)}" ${current===o?'selected':''}>${esc(o)}</option>`).join('')}</select></div><div class="review-box"><div class="micro">The other perspective</div><p style="margin:7px 0 0;font-size:12px;color:#3e5567">${esc(votes[state.seat==='christian'?'growth':'christian']||'Not selected yet')}</p></div></div></section>`}).join('')}`}
function pageOpportunities(){const ops=collection('opportunity').sort((a,b)=>(a.deadline||'9999').localeCompare(b.deadline||'9999'));return `${heading('Relationship-led business development','Commercial bid pipeline','Track real leads, GC contacts and bid invitations. An opportunity is not a confirmed contract; the company must validate scope, staffing, financing and licensing before bidding.','<button class="btn primary" data-action="add-opportunity">+ Add opportunity</button>')}
 <section class="panel pad"><div class="heading-line"><div><h3>Current opportunities</h3><p class="item-desc">${ops.length} recorded · no example projects are treated as real opportunities.</p></div></div><div class="table-wrap" style="margin-top:15px"><table><thead><tr><th>Project / GC</th><th>Scope</th><th>Estimated value</th><th>Deadline</th><th>Stage</th></tr></thead><tbody>${ops.map(o=>`<tr class="tr-click" data-edit-opportunity="${attr(o.id)}"><td class="title-cell">${esc(o.name)}<div class="caption">${esc(o.gc||'—')}</div></td><td>${esc(o.scope||'—')}</td><td>${esc(o.value||'—')}</td><td>${esc(o.deadline||'—')}</td><td><span class="tag blue">${esc(o.stage)}</span></td></tr>`).join('')}</tbody></table></div>${!ops.length?'<div class="empty"><strong>Your pipeline starts here</strong><p>Add the first genuine project lead or general-contractor invitation. This board begins empty on purpose.</p><button class="btn primary" data-action="add-opportunity">Add first opportunity</button></div>':''}</section>`}
function pageUpdates(){const updates=collection('update').sort((a,b)=>b.createdAt.localeCompare(a.createdAt));return `${heading('Communication and follow-through','Weekly progress updates','Capture wins, blockers, decisions needed, and priorities. These check-ins help both partners stay aligned between meetings.','<button class="btn primary" data-action="add-update">+ Weekly update</button>')}
 <div class="two-col"><section>${updates.length?updates.map(u=>`<div class="panel pad" style="margin-bottom:14px"><div class="item-head"><div><span class="micro">${esc(ownerLabel(u.author))} · ${formatDate(u.createdAt)}</span><h3 style="margin:7px 0">${esc(u.title||'Progress update')}</h3></div></div><div class="divider"></div><strong class="label">Progress</strong><p style="white-space:pre-wrap;color:#405767">${esc(u.progress||'—')}</p><strong class="label">Obstacles / questions</strong><p style="white-space:pre-wrap;color:#405767">${esc(u.blockers||'—')}</p><strong class="label">Next actions</strong><p style="white-space:pre-wrap;color:#405767;margin:0">${esc(u.next||'—')}</p></div>`).join(''):'<div class="panel pad empty"><strong>No weekly updates yet</strong><p>Start with a short update after your first discovery and planning meeting.</p></div>'}</section>
 <aside><div class="panel pad"><h3>Suggested weekly check-in</h3><p class="item-desc">Keep meetings focused on outcomes and obstacles.</p><ul class="list"><li><strong>What was completed?</strong><p class="item-desc">Show evidence or deliverables.</p></li><li><strong>What is delayed?</strong><p class="item-desc">Identify the blocker and action needed.</p></li><li><strong>What needs joint approval?</strong><p class="item-desc">Record significant decisions in the decision log.</p></li><li><strong>What will happen next week?</strong><p class="item-desc">Assign tasks and reasonable due dates.</p></li></ul></div></aside></div>`}
function pageSettings(){return `${heading('Company information and access','Workspace settings','Reference facts, secure collaboration setup, and tools for exporting a record of progress.')}
 <div class="two-col"><section class="panel pad"><h3>Business profile</h3><p class="item-desc">Based on information provided; verify against current registration and license records.</p><div class="divider"></div><table><tbody><tr><td>Legal name</td><td><strong>C.F. Mechanical, LLC</strong></td></tr><tr><td>Current owner and president</td><td>Christian Okoh</td></tr><tr><td>Reported Ohio license</td><td>50350</td></tr><tr><td>Reported expiration</td><td>October 17, 2027</td></tr><tr><td>Track record</td><td>One company job reported</td></tr><tr><td>Partner</td><td>Debynyhan Banks</td></tr></tbody></table><div class="info-note" style="margin-top:17px">Current project experience and company experience should be presented separately. No license classification is asserted until it is verified.</div></section>
 <section class="panel pad"><h3>Collaboration and data</h3><p class="item-desc">${isCloud()?'Private Supabase workspace with authenticated accounts and row-level security.':'Local preview: changes remain on this device and are not shared with Christian or Debynyhan Banks on another device.'}</p><div class="divider"></div><p><strong>Previous questionnaire</strong><br><span class="caption">If you saved answers in the earlier questionnaire on this browser, <a href="/previous/">open it to review and download them</a>.</span></p><div class="divider"></div><p><strong>Data export</strong><br><span class="caption">Download a JSON backup of questionnaire answers, decisions, tasks and bid leads.</span></p><button class="btn" data-action="export">Export workspace data ↓</button><div class="divider"></div>${isCloud()?`<p><strong>Invite the second partner</strong></p><p class="caption">Enter the email your partner will use to create their account. Share the workspace link with them; after confirming their email, they can select “Join my invitation.”</p>${membership?.role==='owner'?`<div class="field"><label class="label" for="invite-email">Partner's email address</label><input class="input" type="email" id="invite-email" placeholder="partner@company.com"></div><div class="field"><label class="label">Partner's role</label><select class="select" id="invite-seat"><option value="${state.seat==='christian'?'growth':'christian'}">${esc(SEATS[state.seat==='christian'?'growth':'christian'])}</option></select></div><button class="btn primary" data-action="send-invite">Create secure invitation</button>`:'<p class="caption">The workspace owner manages invitations.</p>'}<div class="divider"></div><button class="btn" data-action="refresh">Refresh shared data</button><button class="btn" data-action="sign-out">Sign out</button>`:`<p><strong>Preview tools</strong></p><div class="button-row"><button class="btn" data-action="import">Import JSON backup</button><button class="btn" data-action="reset-demo">Reset local preview</button></div><input class="hide" id="import-file" type="file" accept=".json,application/json"><p class="caption" style="margin-top:12px">This preview is not shared. Set up the private workspace before entering confidential information.</p>`}</section></div><p class="footnote">Before accepting projects, confirm licensing, workforce, insurance, estimating and financing readiness.</p>`}
function renderModal(){if(!state.modal)return '';const {kind,id}=state.modal;let title='',content='',footer='';
 if(kind==='task'){
  const t=rec('task',id)||{id,title:'',owner:'both',start:1,duration:2,status:'not-started',priority:'medium',notes:'',evidence:'',depends:''};
  title=id?'Edit work item':'New work item';
  const comments=collection('comment').filter(c=>c.taskId===id).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  content=`<div class="field"><label class="label" for="task-title">Work item</label><input id="task-title" class="input" maxlength="170" value="${attr(t.title)}" placeholder="What needs to be accomplished?"></div><div class="modal-grid"><div class="field"><label class="label">Lead</label><select class="select" id="task-owner">${[['both','Both partners'],['christian','Christian Okoh'],['growth','Debynyhan Banks']].map(([k,v])=>`<option value="${k}" ${t.owner===k?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label class="label">Priority</label><select class="select" id="task-priority">${['low','medium','high'].map(o=>`<option value="${o}" ${t.priority===o?'selected':''}>${o[0].toUpperCase()+o.slice(1)}</option>`).join('')}</select></div><div class="field"><label class="label">Start week (1–13)</label><input type="number" class="input" id="task-start" min="1" max="13" value="${t.start}"></div><div class="field"><label class="label">Duration (weeks)</label><input type="number" class="input" id="task-duration" min="1" max="13" value="${t.duration}"></div><div class="field"><label class="label">Status</label><select class="select" id="task-status">${Object.entries(STATUS).map(([k,v])=>`<option value="${k}" ${t.status===k?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label class="label">Depends on (task)</label><select class="select" id="task-depends"><option value="">No dependency</option>${sortedTasks().filter(x=>x.id!==id).map(x=>`<option value="${attr(x.id)}" ${t.depends===x.id?'selected':''}>${esc(short(x.title))}</option>`).join('')}</select></div></div><div class="field"><label class="label">Description and completion criteria</label><textarea class="textarea" id="task-notes">${esc(t.notes)}</textarea></div><div class="field"><label class="label">Completion evidence / link</label><textarea class="textarea" id="task-evidence" rows="2" placeholder="Deliverable link, decision note, or proof of completion">${esc(t.evidence||'')}</textarea></div>${id?`<div class="divider"></div><h3>Discussion</h3>${comments.length?comments.map(c=>`<div class="comment"><strong>${esc(ownerLabel(c.author))} · ${formatDate(c.createdAt)}</strong><p>${esc(c.message)}</p></div>`).join(''):'<p class="caption">No comments yet.</p>'}<textarea class="textarea" id="new-comment" rows="2" placeholder="Ask a question or share progress…"></textarea><div class="button-row end" style="margin-top:9px"><button class="btn small" data-action="add-comment" data-task="${attr(id)}">Post comment</button></div>`:''}`;
  footer=`<button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="save-task" data-id="${attr(id||'')}">Save work item</button>`;
 }else if(kind==='opportunity'){
  const o=rec('opportunity',id)||{name:'',gc:'',scope:'',value:'',deadline:'',stage:STAGES[0],notes:''};title=id?'Edit opportunity':'Add opportunity';
  content=`<div class="field"><label class="label">Project or lead name</label><input class="input" id="op-name" maxlength="170" value="${attr(o.name)}" placeholder="Actual project / lead"></div><div class="modal-grid"><div class="field"><label class="label">General contractor or customer</label><input class="input" id="op-gc" value="${attr(o.gc)}"></div><div class="field"><label class="label">Mechanical scope</label><input class="input" id="op-scope" value="${attr(o.scope)}"></div><div class="field"><label class="label">Estimated contract value</label><input class="input" id="op-value" placeholder="Optional; e.g. $75,000" value="${attr(o.value)}"></div><div class="field"><label class="label">Bid deadline</label><input type="date" class="input" id="op-deadline" value="${attr(o.deadline)}"></div></div><div class="field"><label class="label">Pipeline stage</label><select id="op-stage" class="select">${STAGES.map(s=>`<option ${o.stage===s?'selected':''}>${s}</option>`).join('')}</select></div><div class="field"><label class="label">Notes and next action</label><textarea class="textarea" id="op-notes">${esc(o.notes)}</textarea></div>`;
  footer=`<button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="save-opportunity" data-id="${attr(id||'')}">Save opportunity</button>`;
 }else if(kind==='update'){
  title='Add weekly progress update';content=`<div class="field"><label class="label">Update title</label><input class="input" id="up-title" maxlength="130" placeholder="Week 1: readiness review"></div><div class="field"><label class="label">What moved forward?</label><textarea class="textarea" id="up-progress" placeholder="Deliverables, conversations and completed tasks"></textarea></div><div class="field"><label class="label">What is blocked or needs a decision?</label><textarea class="textarea" id="up-blockers"></textarea></div><div class="field"><label class="label">What happens next?</label><textarea class="textarea" id="up-next"></textarea></div>`;
  footer=`<button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="save-update">Post update</button>`;
 }
 return `<div class="modal-backdrop" id="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="${attr(title)}"><div class="modal-header"><h2>${esc(title)}</h2><button class="icon-btn" aria-label="Close dialog" data-action="close-modal">×</button></div><div class="modal-body">${content}</div><div class="modal-footer">${footer}</div></div></div>`;
}
function renderAuth(){const signup=state.authScreen==='signup';$('#root').innerHTML=`<div class="auth-wrap"><div class="auth-card"><div class="auth-mark">CF</div><span class="eyebrow">Private strategy workspace</span><h1>${signup?'Create your account':'Welcome back'}</h1><p>Use your own account to answer discovery questions and collaborate on C.F. Mechanical's growth roadmap.</p><form id="auth-form"><div class="field"><label for="auth-email" class="label">Email address</label><input class="input" id="auth-email" type="email" autocomplete="email" required></div><div class="field"><label for="auth-password" class="label">Password</label><input class="input" id="auth-password" type="password" minlength="8" autocomplete="${signup?'new-password':'current-password'}" required></div><button type="submit" class="btn primary" style="width:100%">${signup?'Create account':'Sign in'} →</button></form><div class="divider"></div><button class="btn linky" data-action="auth-toggle">${signup?'Already registered? Sign in':'New partner? Create an account'}</button><p class="caption" style="margin-top:16px">Access requires an invitation or an existing workspace. Email verification should remain enabled in Supabase.</p></div></div>`}
function renderWorkspaceSetup(){$('#root').innerHTML=`<div class="auth-wrap"><div class="auth-card"><div class="auth-mark">CF</div><span class="eyebrow">First-time setup</span><h1>Connect your workspace</h1><p>Join an invitation from your partner, or create the private C.F. Mechanical workspace if you are setting it up for the first time.</p><button class="btn primary" style="width:100%;margin-bottom:20px" data-action="join-workspace">Join my invitation →</button><div class="divider"></div><div class="field"><label class="label">Workspace name</label><input class="input" id="setup-name" value="C.F. Mechanical, LLC"></div><div class="field"><label class="label">Which partner are you?</label><select id="setup-seat" class="select"><option value="christian">Christian Okoh</option><option value="growth">Debynyhan Banks</option></select></div><button class="btn" style="width:100%" data-action="create-workspace">Create private workspace</button><button class="btn linky" data-action="sign-out" style="margin-top:15px">Sign out</button><p class="caption">Only create one workspace. The first account can invite the other partner from Workspace settings.</p></div></div>`}
function closeModal(){state.modal=null;render()}
function read(id){return document.getElementById(id)?.value?.trim()||''}
function changeView(v){state.view=v;state.modal=null;state.search='';window.scrollTo({top:0,behavior:'instant'});render()}
async function clickAction(e){const nav=e.target.closest('[data-view]');if(nav){changeView(nav.dataset.view);return}
 const groupBtn=e.target.closest('[data-group]');if(groupBtn){state.group=Number(groupBtn.dataset.group);render();return}
 const task=e.target.closest('[data-edit-task]');if(task){state.modal={kind:'task',id:task.dataset.editTask};render();return}
 const op=e.target.closest('[data-edit-opportunity]');if(op){state.modal={kind:'opportunity',id:op.dataset.editOpportunity};render();return}
 const act=e.target.closest('[data-action]');if(!act)return;const k=act.dataset.action;
 if(k==='prev-group'){state.group=Math.max(0,state.group-1);render()}
 else if(k==='next-group'){if(state.group===GROUPS.length-1)changeView('alignment');else{state.group++;render()}}
 else if(k==='add-task'){state.modal={kind:'task',id:''};render()}
 else if(k==='add-opportunity'){state.modal={kind:'opportunity',id:''};render()}
 else if(k==='add-update'){state.modal={kind:'update',id:''};render()}
 else if(k==='close-modal'){closeModal()}
 else if(k==='save-task'){
  const title=read('task-title');if(!title){toast('Enter a task title.',true);return}
  const id=act.dataset.id||uid(),old=rec('task',id),start=Math.min(13,Math.max(1,Number(read('task-start'))||1)),duration=Math.min(14-start,Math.max(1,Number(read('task-duration'))||1));
  const body={...(old||{}),id,title,owner:read('task-owner'),priority:read('task-priority'),start,duration,status:read('task-status'),depends:read('task-depends'),notes:read('task-notes'),evidence:read('task-evidence'),createdAt:old?.createdAt||now()};
  if(body.status==='completed'&&!body.evidence){toast('Add completion evidence before marking the task completed.',true);return}
  saveRecord('task',id,body);actionEvent('Task updated',title+': '+STATUS[body.status]);state.modal=null;render();toast(isCloud()?'Work item queued for saving':'Work item saved');
 }else if(k==='save-opportunity'){
  const name=read('op-name');if(!name){toast('Add a project or lead name.',true);return}
  const id=act.dataset.id||uid(),old=rec('opportunity',id);
  saveRecord('opportunity',id,{...old,id,name,gc:read('op-gc'),scope:read('op-scope'),value:read('op-value'),deadline:read('op-deadline'),stage:read('op-stage'),notes:read('op-notes'),createdAt:old?.createdAt||now()});actionEvent('Bid pipeline changed',name);state.modal=null;render();toast(isCloud()?'Opportunity queued for saving':'Opportunity saved');
 }else if(k==='save-update'){
  if(!read('up-progress')&&!read('up-next')){toast('Enter a progress or next-action note.',true);return}
  const id=uid();saveRecord('update',id,{id,title:read('up-title')||'Weekly progress update',progress:read('up-progress'),blockers:read('up-blockers'),next:read('up-next'),author:state.seat,createdAt:now()});actionEvent('Weekly update posted',read('up-title')||'Progress and next actions');state.modal=null;render();toast(isCloud()?'Progress update queued for saving':'Progress update posted');
 }else if(k==='add-comment'){
  const message=read('new-comment'),taskId=act.dataset.task;if(!message){toast('Write a comment first.',true);return}
  saveRecord('comment',uid(),{taskId,message,author:state.seat,createdAt:now()});state.modal={kind:'task',id:taskId};render();toast(isCloud()?'Comment queued for saving':'Comment added');
 }else if(k==='export'){downloadBackup()}
 else if(k==='import'){$('#import-file')?.click()}
 else if(k==='reset-demo'){if(confirm('Reset your local preview? This removes local answers and restores the proposed roadmap.')){localStorage.removeItem(KEY);state.records={};seedDemo();changeView('overview')}}
 else if(k==='auth-toggle'){state.authScreen=state.authScreen==='login'?'signup':'login';render()}
 else if(k==='sign-out'){while(isCloud()&&saveQueue.hasUnsaved()){if(!(await flushQueue())){toast('Changes are not saved. Retry before signing out.',true);return}}if(db)await db.auth.signOut();auth=null;workspace=null;membership=null;if(pollTimer)clearInterval(pollTimer);render()}
 else if(k==='join-workspace'){const {data,error}=await db.rpc('claim_workspace_invitation');if(error)toast(error.message,true);else if(!data)toast('No invitation matches this verified email. Ask the workspace owner to invite you.',true);else await initCloudWorkspace()}
 else if(k==='create-workspace'){const {error}=await db.rpc('create_growth_workspace',{p_name:read('setup-name')||'C.F. Mechanical, LLC',p_seat:read('setup-seat')});if(error)toast(error.message,true);else await initCloudWorkspace()}
 else if(k==='send-invite'){
  const email=read('invite-email').toLowerCase(),seat=read('invite-seat');if(!/^\S+@\S+\.\S+$/.test(email)){toast('Enter a valid email address.',true);return}
  const {error}=await db.from('workspace_invitations').insert({workspace_id:workspace.id,email,seat});if(error)toast(error.message,true);else toast('Invitation recorded. Share the portal URL and ask your partner to sign up with that email, then select “Join my invitation.”')
 }else if(k==='refresh'){if(await loadCloudRecords(true))toast('Workspace refreshed')}
}
function onChange(e){const target=e.target;
 if(target.id==='seat-select'){state.seat=target.value;storeDemo();render();return}
 if(target.matches('[data-q]')){
  const q=QUESTIONS.find(x=>x.id===target.dataset.q);if(!q)return;const seat=state.seat;
  let value=q.type==='multi'?[...document.querySelectorAll(`[data-q="${q.id}"]:checked`)].map(el=>el.value):target.value;
  saveRecord('response',`${seat}:${q.id}`,{seat,value,respondent_uid:isCloud()?auth.id:'demo:'+seat,updatedAt:now()},600);
  if(q.type!=='long')render();else{const note=$('#save-note');if(note)note.textContent=isCloud()?'Saving to shared workspace…':'Saved in this browser.'}
 }else if(target.matches('[data-vote]')){
  const decision=DECISIONS.find(d=>d.id===target.dataset.vote);if(!decision)return;
  saveRecord('vote',`${state.seat}:${decision.id}`,{seat:state.seat,choice:target.value,respondent_uid:isCloud()?auth.id:'demo:'+state.seat,updatedAt:now()});actionEvent('Planning decision response',decision.title);render();
 }else if(target.id==='import-file')importBackup(target.files?.[0]);
}
function onInput(e){if(e.target.matches('textarea[data-q]')){
 const qid=e.target.dataset.q,seat=state.seat,value=e.target.value;
 saveRecord('response',`${seat}:${qid}`,{seat,value,respondent_uid:isCloud()?auth.id:'demo:'+seat,updatedAt:now()},900);
 const note=$('#save-note');if(note)note.textContent=isCloud()?'Saving to shared workspace…':'Saved in this browser.';
 }else if(e.target.id==='task-search'){
 state.search=e.target.value;const position=e.target.selectionStart;render();const input=$('#task-search');input?.focus();input?.setSelectionRange(position,position);
 }}
async function onSubmit(e){if(e.target.id!=='auth-form')return;e.preventDefault();const email=read('auth-email'),password=read('auth-password'),signup=state.authScreen==='signup';
 const {data,error}=signup?await db.auth.signUp({email,password}):await db.auth.signInWithPassword({email,password});if(error){toast(error.message,true);return}
 if(signup&&!data.session){toast('Please verify your email using the confirmation message, then sign in.');state.authScreen='login';render()}else{auth=data.user;await initCloudWorkspace()}
}
function downloadBackup(){const data={application:'C.F. Mechanical Growth Workspace',version:1,exportedAt:now(),mode:isCloud()?'shared':'local-preview',records:Object.values(state.records)};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});downloadBlob(blob,'CF-Mechanical-Growth-Workspace-'+new Date().toISOString().slice(0,10)+'.json')}
function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
async function importBackup(file){if(!file||isCloud())return;try{const parsed=JSON.parse(await file.text());if(parsed.application!=='C.F. Mechanical Growth Workspace'||!Array.isArray(parsed.records)||parsed.records.length>5000)throw Error('Invalid growth workspace backup');if(!confirm('Replace the local preview data with this backup?'))return;
  const fresh={};for(const r of parsed.records){if(typeof r.category!=='string'||typeof r.object_id!=='string'||typeof r.body!=='object'||!r.body)continue;fresh[recordKey(r.category,r.object_id)]=r}state.records=fresh;storeDemo();changeView('overview');toast('Backup imported into this browser')
 }catch(e){toast('Could not import backup: '+e.message,true)}}
function bindListeners(){} // Global delegation below is bound once, outside render() to avoid duplicates.
document.addEventListener('click',clickAction);
document.addEventListener('change',onChange);
document.addEventListener('input',onInput);
document.addEventListener('submit',onSubmit);
function onKeydown(e){if(e.key==='Escape'&&state.modal)closeModal()}
document.addEventListener('keydown',onKeydown);
function onBeforeUnload(e){if(isCloud()&&saveQueue.hasUnsaved()){e.preventDefault();e.returnValue=''}}
window.addEventListener('beforeunload',onBeforeUnload);
if(CLOUD)connectCloud();else{seedDemo();render()}

return () => {
  document.removeEventListener('click',clickAction);
  document.removeEventListener('change',onChange);
  document.removeEventListener('input',onInput);
  document.removeEventListener('submit',onSubmit);
  document.removeEventListener('keydown',onKeydown);
  window.removeEventListener('beforeunload',onBeforeUnload);
  if (pollTimer) clearInterval(pollTimer);
  if (saveTimer) clearTimeout(saveTimer);
};
}
