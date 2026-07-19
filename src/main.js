import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import './style.css';
import './map-popup.css';
import './dashboard-compact.css';
import './android-native.css';
import './supervisor.css';
import L from 'leaflet';
import 'leaflet.markercluster';
import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';
import { listResults, saveResult, getSetting, saveSetting } from './db.js';
import { signIn, signOut, getUser, getMyProfile, uploadSubmission, fetchCloudResults, subscribeToResults, signedFormUrl, reviewSubmission, SUPABASE_URL } from './cloud.js';

const isNativeAndroid=Capacitor.isNativePlatform();
if(isNativeAndroid){
  document.documentElement.classList.add('native-android');
  document.querySelector('meta[name="viewport"]')?.setAttribute('content','width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover');
}else registerSW({ immediate: true });

const base = import.meta.env.BASE_URL;
const [stations, candidates, frameSummary] = await Promise.all([
  fetch(`${base}data/polling-stations.json`).then(r=>r.json()),
  fetch(`${base}data/candidates.json`).then(r=>r.json()),
  fetch(`${base}data/summary.json`).then(r=>r.json())
]);
const stationById = new Map(stations.map(s=>[s.id,s]));
let results = await listResults();
let cloudResults = [];
let myProfile = null;
let activeTab = 'dashboard';
let map;

const app = document.querySelector('#app');

function shell(content) {
  app.innerHTML = `
    <header><div><span class="flag">ZM</span><h1>Zambia Election Monitoring and Results System</h1></div><span id="network" class="pill"></span></header>
    <nav>
      ${[['dashboard','Dashboard'],['submit','Submit Result'],['records','Records'],...((myProfile?.role==='supervisor'||myProfile?.role==='administrator')?[['supervisor','Supervisor Review']]:[]),['settings','Settings']].map(([id,label])=>`<button data-tab="${id}" class="${activeTab===id?'active':''}">${label}</button>`).join('')}
    </nav>
    <main>${content}</main>`;
  app.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{activeTab=b.dataset.tab;render();});
  updateNetwork();
}

function updateNetwork(){
  const n=document.querySelector('#network'); if(!n)return;
  n.textContent=navigator.onLine?'Online':'Offline'; n.className=`pill ${navigator.onLine?'online':'offline'}`;
}
addEventListener('online',()=>{updateNetwork();syncResults();}); addEventListener('offline',updateNetwork);

const fmt=n=>new Intl.NumberFormat('en-ZM').format(n||0);
function allResults(){
  const remote=cloudResults.map(r=>({stationId:r.station_id,status:r.status,candidateVotes:r.candidate_votes||[],ballotsCast:r.ballots_cast,createdAt:r.submitted_at,syncStatus:'Synced'}));
  const ids=new Set(remote.map(r=>r.stationId)); return [...remote,...results.filter(r=>!ids.has(r.stationId))];
}
function statusFor(id){return allResults().find(r=>r.stationId===id)?.status || 'Not reported';}

function stationPopup(s){
  const result=allResults().find(r=>r.stationId===s.id);
  const status=result?.status||'Not reported';
  const statusClass=status.toLowerCase().replaceAll(' ','-');
  const reportedDetails=result?`<div class="station-popup__result"><span>Ballots cast <b>${fmt(result.ballotsCast)}</b></span><span>Submitted <b>${result.createdAt?new Date(result.createdAt).toLocaleString('en-ZM'):'—'}</b></span></div>`:'';
  return `<article class="station-popup">
    <header class="station-popup__header">
      <span class="station-popup__eyebrow">Polling station</span>
      <span class="station-popup__status ${statusClass}">${escapeHtml(status)}</span>
      <h4>${escapeHtml(s.station)}</h4><code>${escapeHtml(s.id)}</code>
    </header>
    <div class="station-popup__body">
      <dl>
        <div><dt>Polling district</dt><dd>${escapeHtml(s.pollingDistrict)}</dd></div>
        <div><dt>Ward</dt><dd>${escapeHtml(s.ward)}</dd></div>
        <div><dt>Constituency</dt><dd>${escapeHtml(s.constituency)}</dd></div>
        <div><dt>District</dt><dd>${escapeHtml(s.district)}</dd></div>
        <div><dt>Province</dt><dd>${escapeHtml(s.province)}</dd></div>
      </dl>
      <div class="station-popup__voters">
        <span><b>${fmt(s.registered)}</b>Total registered</span><span><b>${fmt(s.male)}</b>Male</span><span><b>${fmt(s.female)}</b>Female</span>
      </div>
      ${reportedDetails}
      <small class="station-popup__coordinates">${Number(s.latitude).toFixed(5)}, ${Number(s.longitude).toFixed(5)}</small>
    </div>
  </article>`;
}

function dashboard(){
  const combined=allResults();
  const reported=new Set(combined.map(r=>r.stationId)).size;
  const verified=new Set(combined.filter(r=>r.status==='Verified').map(r=>r.stationId)).size;
  const pct=frameSummary.stations?reported/frameSummary.stations*100:0;
  return `
    <section class="hero"><div><h2>Election monitoring dashboard</h2><p>Polling-station reporting progress and provisional results.</p></div><div class="updated">Updated ${new Date().toLocaleString()}</div></section>
    <section class="cards">
      <article><span>Polling stations</span><strong>${fmt(frameSummary.stations)}</strong></article>
      <article><span>Registered voters</span><strong>${fmt(frameSummary.registeredVoters)}</strong></article>
      <article><span>Reported</span><strong>${fmt(reported)}</strong><small>${pct.toFixed(1)}%</small></article>
      <article><span>Verified</span><strong>${fmt(verified)}</strong></article>
      <article><span>Pending sync</span><strong>${fmt(results.filter(r=>r.syncStatus!=='Synced').length)}</strong></article>
    </section>
    <section class="progress"><div style="width:${pct}%"></div></section>
    <section class="panel filters">
      <select id="province"><option value="">All provinces</option>${[...new Set(stations.map(s=>s.province))].sort().map(x=>`<option>${x}</option>`).join('')}</select>
      <select id="status"><option value="">All statuses</option><option>Not reported</option><option>Submitted</option><option>Verified</option></select>
      <button id="apply">Apply filters</button>
    </section>
    <section class="grid"><div class="panel"><h3>Polling-station status map</h3><div id="map"></div></div>${candidatePanel()}</section>`;
}

function candidatePanel(){
  const totals=new Map(candidates.map(c=>[c.id,0]));
  allResults().filter(r=>r.status==='Verified').forEach(r=>r.candidateVotes?.forEach(v=>totals.set(v.candidateId,(totals.get(v.candidateId)||0)+Number(v.votes||0))));
  const max=Math.max(1,...totals.values());
  return `<div class="panel"><h3>Verified presidential results</h3><p class="note">Only supervisor-verified submissions are included.</p><div class="bars">${candidates.map(c=>`<div><label>${c.name} <small>${c.party}</small><b>${fmt(totals.get(c.id))}</b></label><span><i style="width:${totals.get(c.id)/max*100}%"></i></span></div>`).join('')}</div></div>`;
}

async function addAdministrativeBoundaries(targetMap){
  const definitions=[
    {key:'provinces',label:'Province boundaries',color:'#0b5d3b',weight:2.4,defaultOn:true,name:'PROV_NAME'},
    {key:'districts',label:'District boundaries',color:'#775a9f',weight:1.6,defaultOn:true,name:'DIST_NAME'},
    {key:'constituencies',label:'Constituency boundaries (226)',color:'#d46b08',weight:1.25,defaultOn:false,name:'BOUNDARY_ID'},
    {key:'wards',label:'Ward boundaries',color:'#2676a5',weight:.9,defaultOn:false,name:'WARD_NAME'}
  ];
  const overlays={};
  await Promise.all(definitions.map(async d=>{
    const data=await fetch(`${base}data/boundaries/${d.key}.geojson`).then(r=>{if(!r.ok)throw new Error(`Could not load ${d.label}`);return r.json();});
    const layer=L.geoJSON(data,{
      pane:'overlayPane',
      style:{color:d.color,weight:d.weight,opacity:.8,fill:false},
      onEachFeature:(feature,item)=>{
        const name=feature.properties?.[d.name];
        if(name)item.bindTooltip(`${d.label.replace(' boundaries','')}: ${name}`,{sticky:true,className:'boundary-tooltip'});
      }
    });
    overlays[d.label]=layer;
    if(d.defaultOn&&map===targetMap)layer.addTo(targetMap);
  }));
  if(map===targetMap)L.control.layers(null,overlays,{collapsed:innerWidth<900,position:'topright'}).addTo(targetMap);
}

function initMap(province='',status=''){
  map=L.map('map',{preferCanvas:true}).setView([-13.3,28.2],6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);
  addAdministrativeBoundaries(map).catch(e=>console.warn(e.message));
  const cluster=L.markerClusterGroup({chunkedLoading:true});
  stations.filter(s=>(!province||s.province===province)&&(!status||statusFor(s.id)===status)).forEach(s=>{
    const st=statusFor(s.id); const color=st==='Verified'?'#16834b':st==='Submitted'?'#f0a500':'#8b96a3';
    const marker=L.circleMarker([s.latitude,s.longitude],{radius:6,weight:2,color:'#fff',fillColor:color,fillOpacity:.95,bubblingMouseEvents:false});
    marker.bindPopup(stationPopup(s),{maxWidth:370,minWidth:300,className:'station-details-popup',closeButton:true,autoPanPadding:[24,24]});
    marker.bindTooltip(s.station,{direction:'top',offset:[0,-7],opacity:.95});
    cluster.addLayer(marker);
  });
  map.addLayer(cluster);
}

function submitPage(){return `
  <section class="hero"><div><h2>Polling-station result entry</h2><p>Entries are stored safely on this device when offline.</p></div></section>
  <form id="resultForm" class="panel form">
    <label class="wide">Find polling station<input id="stationSearch" placeholder="Type station, polling district, ward or code" autocomplete="off"><div id="matches"></div></label>
    <input type="hidden" id="stationId" required>
    <div id="stationCard" class="wide station-card">No polling station selected.</div>
    <label>Opening status<select id="opening"><option>Opened on time</option><option>Opened late</option><option>Not opened</option></select></label>
    <label>Ballots cast<input id="ballots" type="number" min="0" required></label>
    <label>Rejected ballots<input id="rejected" type="number" min="0" value="0" required></label>
    <label>Total valid votes<input id="valid" type="number" min="0" required></label>
    <fieldset class="wide"><legend>Presidential candidate votes</legend><div class="candidate-grid">${candidates.map(c=>`<label>${c.name}<small>${c.party}</small><input data-candidate="${c.id}" type="number" min="0" value="0"></label>`).join('')}</div></fieldset>
    <label class="wide">Incident or observation<textarea id="incident" rows="3" placeholder="Leave blank if there was no incident"></textarea></label>
    <label class="wide">Signed results-form photograph<input id="photo" type="file" accept="image/*" capture="environment"></label>
    <label>Monitor name<input id="monitor" required></label><label>Phone number<input id="phone" inputmode="tel" required></label>
    <button class="primary wide" type="submit">Save and queue for synchronization</button>
  </form>`}

function wireSubmit(){
  const search=document.querySelector('#stationSearch'),matches=document.querySelector('#matches');
  search.oninput=()=>{
    const q=search.value.trim().toLowerCase(); if(q.length<2){matches.innerHTML='';return;}
    const found=stations.filter(s=>`${s.id} ${s.station} ${s.pollingDistrict} ${s.ward} ${s.district}`.toLowerCase().includes(q)).slice(0,20);
    matches.innerHTML=found.map(s=>`<button type="button" data-id="${s.id}"><b>${s.station}</b><small>${s.pollingDistrict} · ${s.ward} · ${s.district}</small></button>`).join('');
    matches.querySelectorAll('button').forEach(b=>b.onclick=()=>selectStation(b.dataset.id));
  };
  wireNumberInputs(document.querySelector('#resultForm'));
  document.querySelector('#resultForm').onsubmit=saveSubmission;
}
function wireNumberInputs(scope){
  scope?.querySelectorAll('input[type="number"]').forEach(input=>{
    input.addEventListener('focus',()=>{if(input.value==='0')input.value='';});
    input.addEventListener('input',()=>{if(/^0\d+/.test(input.value))input.value=String(Number(input.value));});
    input.addEventListener('blur',()=>{if(input.value==='')input.value='0';});
  });
}
function selectStation(id){const s=stationById.get(id);document.querySelector('#stationId').value=id;document.querySelector('#stationSearch').value=s.station;document.querySelector('#matches').innerHTML='';document.querySelector('#stationCard').innerHTML=`<b>${s.station}</b><span>${s.pollingDistrict}</span><span>${s.ward} · ${s.constituency} · ${s.district} · ${s.province}</span><span>Registered voters: ${fmt(s.registered)}</span>`;}
async function fileData(file){return file?new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);}):null;}
async function saveSubmission(e){
  e.preventDefault(); const stationId=document.querySelector('#stationId').value;if(!stationId)return alert('Select a polling station.');
  const candidateVotes=[...document.querySelectorAll('[data-candidate]')].map(i=>({candidateId:Number(i.dataset.candidate),votes:Number(i.value||0)}));
  const valid=Number(document.querySelector('#valid').value),sum=candidateVotes.reduce((a,b)=>a+b.votes,0);if(valid!==sum)return alert(`Candidate votes total ${fmt(sum)}, but valid votes are ${fmt(valid)}.`);
  const ballots=Number(document.querySelector('#ballots').value),rejected=Number(document.querySelector('#rejected').value);if(ballots!==valid+rejected)return alert('Ballots cast must equal valid votes plus rejected ballots.');
  const photo=await fileData(document.querySelector('#photo').files[0]);
  const result={id:crypto.randomUUID(),stationId,openingStatus:document.querySelector('#opening').value,ballotsCast:ballots,rejectedBallots:rejected,validVotes:valid,candidateVotes,incident:document.querySelector('#incident').value,photo,monitor:document.querySelector('#monitor').value,phone:document.querySelector('#phone').value,status:'Submitted',syncStatus:'Pending',createdAt:new Date().toISOString(),deviceLocation:null};
  if(navigator.geolocation) navigator.geolocation.getCurrentPosition(async p=>{result.deviceLocation={latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy};await saveResult(result);});
  await saveResult(result);results=await listResults();alert('Result saved on this device and queued for synchronization.');activeTab='records';render();syncResults();
}

function recordsPage(){return `<section class="hero"><div><h2>Saved result submissions</h2><p>Review synchronization and verification status.</p></div></section><section class="panel table-wrap"><table><thead><tr><th>Polling station</th><th>District</th><th>Ballots cast</th><th>Submitted</th><th>Verification</th><th>Sync</th></tr></thead><tbody>${results.length?results.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(r=>{const s=stationById.get(r.stationId)||{};return `<tr><td>${s.station||r.stationId}</td><td>${s.district||''}</td><td>${fmt(r.ballotsCast)}</td><td>${new Date(r.createdAt).toLocaleString()}</td><td><span class="tag">${r.status}</span></td><td>${r.syncStatus}</td></tr>`}).join(''):'<tr><td colspan="6">No submissions saved on this device.</td></tr>'}</tbody></table></section>`}

function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function supervisorPage(){
  const pending=cloudResults.filter(r=>['Submitted','Under review'].includes(r.status));
  const verified=cloudResults.filter(r=>r.status==='Verified').length;
  const rejected=cloudResults.filter(r=>r.status==='Rejected').length;
  const cards=pending.map(r=>{const s=stationById.get(r.station_id)||{};const sum=(r.candidate_votes||[]).reduce((a,b)=>a+Number(b.votes||0),0);return `<article class="review-card"><div class="review-head"><div><h3>${s.station||r.station_id}</h3><p>${s.pollingDistrict||''} · ${s.ward||''} · ${s.district||''}</p></div><span class="tag">${r.status}</span></div><div class="review-numbers"><span>Registered <b>${fmt(s.registered)}</b></span><span>Ballots cast <b>${fmt(r.ballots_cast)}</b></span><span>Valid <b>${fmt(r.valid_votes)}</b></span><span>Rejected <b>${fmt(r.rejected_ballots)}</b></span></div><p class="check ${sum===r.valid_votes?'pass':'fail'}">Candidate total: ${fmt(sum)} ${sum===r.valid_votes?'✓':'does not equal valid votes'}</p>${r.incident?`<p><b>Observation:</b> ${escapeHtml(r.incident)}</p>`:''}<details><summary>Candidate results</summary><div class="result-list">${(r.candidate_votes||[]).map(v=>{const c=candidates.find(x=>x.id===Number(v.candidateId));return `<span>${c?.name||v.candidateId}<b>${fmt(v.votes)}</b></span>`}).join('')}</div></details><div class="review-actions">${r.photo_path?`<button data-form="${r.id}">View signed form</button>`:'<span class="no-photo">No signed form attached</span>'}<button class="reject" data-review="Rejected" data-id="${r.id}">Reject</button><button class="verify" data-review="Verified" data-id="${r.id}" ${sum!==r.valid_votes?'disabled':''}>Verify result</button></div></article>`}).join('');
  return `<section class="hero"><div><h2>Supervisor review</h2><p>Verify every submission against the signed polling-station results form.</p></div></section><section class="review-summary"><article><b>${pending.length}</b><span>Awaiting review</span></article><article><b>${verified}</b><span>Verified</span></article><article><b>${rejected}</b><span>Rejected</span></article></section><section class="reviews">${cards||'<div class="panel">No submissions are awaiting review.</div>'}</section>`;
}
function wireSupervisor(){
  document.querySelectorAll('[data-review]').forEach(b=>b.onclick=async()=>{const action=b.dataset.review;const comment=prompt(`${action} comment (optional):`,'');if(comment===null)return;if(!confirm(`Confirm ${action.toLowerCase()} for this polling-station result?`))return;try{await reviewSubmission(b.dataset.id,action,comment);await refreshCloud();alert(`Result ${action.toLowerCase()}.`);render();}catch(e){alert(e.message);}});
  document.querySelectorAll('[data-form]').forEach(b=>b.onclick=async()=>{const r=cloudResults.find(x=>x.id===b.dataset.form);try{const url=await signedFormUrl(r.photo_path);if(url)window.open(url,'_blank','noopener');}catch(e){alert(e.message);}});
}

async function settingsPage(){const user=await getUser();return `<section class="hero"><div><h2>Secure cloud synchronization</h2><p>Connected to ${SUPABASE_URL}</p></div></section>${user?`<section class="panel"><h3>Signed in</h3><p>${user.email}</p><button id="syncNow" class="primary">Synchronize now</button> <button id="logout">Sign out</button></section>`:`<form id="loginForm" class="panel form"><label class="wide">Username<input id="email" value="demo" autocomplete="username" required></label><label class="wide">Password<input id="password" type="password" value="12345678" autocomplete="current-password" required></label><p class="wide note">Temporary demonstration account</p><button class="primary wide">Sign in and synchronize</button></form>`}`}

async function refreshCloud(){try{if(await getUser()){myProfile=await getMyProfile();cloudResults=await fetchCloudResults();}else{myProfile=null;cloudResults=[];}}catch(e){console.warn(e.message);}}
async function syncResults(){if(!navigator.onLine||!(await getUser()))return;for(const r of results.filter(x=>x.syncStatus!=='Synced')){try{await uploadSubmission(r);r.syncStatus='Synced';await saveResult(r);}catch(e){console.warn(e.message);break;}}results=await listResults();await refreshCloud();}

async function render(){
  if(activeTab==='settings'){shell(await settingsPage());const login=document.querySelector('#loginForm');if(login)login.onsubmit=async e=>{e.preventDefault();try{const identity=document.querySelector('#email').value.trim();const email=identity.includes('@')?identity:`${identity}@zemrs.org`;await signIn(email,document.querySelector('#password').value);await syncResults();alert('Signed in and synchronized.');render();}catch(err){alert(err.message);}};const logout=document.querySelector('#logout');if(logout)logout.onclick=async()=>{await signOut();cloudResults=[];render();};const sync=document.querySelector('#syncNow');if(sync)sync.onclick=async()=>{await syncResults();alert('Synchronization completed.');render();};return;}
  shell(activeTab==='dashboard'?dashboard():activeTab==='submit'?submitPage():activeTab==='supervisor'?supervisorPage():recordsPage());
  if(activeTab==='dashboard'){setTimeout(()=>{initMap();document.querySelector('#apply').onclick=()=>{map.remove();initMap(document.querySelector('#province').value,document.querySelector('#status').value);};},0);}
  if(activeTab==='submit')wireSubmit();
  if(activeTab==='supervisor')wireSupervisor();
}
await refreshCloud();
subscribeToResults(async()=>{await refreshCloud();if(activeTab==='dashboard')render();});
render();
