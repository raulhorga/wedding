'use strict';

const BASE = 'https://calc.domainepublic.net';
const GUEST_ROOM = '286gugy2seqx';
const VENUE_ROOM = 'xrplrbue3waf';
const SYNC_MS = 15000;
const LOCAL_GUESTS_KEY = 'wedding_planner_guests_v8';
const LOCAL_VENUES_KEY = 'wedding_planner_venues_v8';
const GUEST_CATEGORIES = ['Invitati Raul','Invitati Andreea','Invitati comuni'];

const state = {
  guests: [], venues: [], syncing: false, savingGuests: false, savingVenues: false,
  lastGuestSaveAt: 0, lastVenueSaveAt: 0,
  calendarYear: 2027, calendarMonth: 0, selectedDate: '', venueDraftDates: [], activeGuestCategory: GUEST_CATEGORIES[0]
};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const el = {
  syncStatus:$('#syncStatus'), statGuests:$('#statGuests'), statGuestPeople:$('#statGuestPeople'), statConfirmed:$('#statConfirmed'), statVenues:$('#statVenues'), statVenueCapacity:$('#statVenueCapacity'),
  guestSummary:$('#guestSummary'), guestSearch:$('#guestSearch'), guestStatusFilter:$('#guestStatusFilter'), guestsRaul:$('#guestsRaul'), guestsAndreea:$('#guestsAndreea'), guestsCommon:$('#guestsCommon'), countRaul:$('#countRaul'), countAndreea:$('#countAndreea'), countCommon:$('#countCommon'), tabCountRaul:$('#tabCountRaul'), tabCountAndreea:$('#tabCountAndreea'), tabCountCommon:$('#tabCountCommon'), openGuestDialog:$('#openGuestDialog'),
  venueSearch:$('#venueSearch'), venueCapacityFilter:$('#venueCapacityFilter'), venueGrid:$('#venueGrid'),
  calendarTitle:$('#calendarTitle'), calendarGrid:$('#calendarGrid'), selectedWeekendTitle:$('#selectedWeekendTitle'), availabilityContent:$('#availabilityContent'),
  guestDialog:$('#guestDialog'), guestForm:$('#guestForm'), guestId:$('#guestId'), guestDialogTitle:$('#guestDialogTitle'), guestName:$('#guestName'), guestCategory:$('#guestCategory'), guestStatus:$('#guestStatus'), guestAdults:$('#guestAdults'), guestChildren:$('#guestChildren'), guestPhone:$('#guestPhone'), guestTable:$('#guestTable'), guestMenu:$('#guestMenu'), guestNotes:$('#guestNotes'), guestCrossed:$('#guestCrossed'), deleteGuest:$('#deleteGuest'),
  venueDialog:$('#venueDialog'), venueForm:$('#venueForm'), venueId:$('#venueId'), venueDialogTitle:$('#venueDialogTitle'), venueName:$('#venueName'), venueCity:$('#venueCity'), venueAddress:$('#venueAddress'), venueCapacity:$('#venueCapacity'), venuePrice:$('#venuePrice'), venueMenuPrice:$('#venueMenuPrice'), venueDeposit:$('#venueDeposit'), venueContact:$('#venueContact'), venuePhone:$('#venuePhone'), venueWebsite:$('#venueWebsite'), venueParking:$('#venueParking'), venueAccommodation:$('#venueAccommodation'), venueFeatures:$('#venueFeatures'), venueAvailabilityDate:$('#venueAvailabilityDate'), availabilityChips:$('#availabilityChips'), venueNotes:$('#venueNotes'), deleteVenue:$('#deleteVenue'), toast:$('#toast')
};

function setSync(text,type=''){el.syncStatus.textContent=text;el.syncStatus.dataset.type=type}
function num(v){const n=Number(v);return Number.isFinite(n)?n:0}
function money(v){const n=num(v);return n?new Intl.NumberFormat('ro-RO',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n):'—'}
function localISO(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function fromISO(s){const [y,m,d]=String(s).split('-').map(Number);return new Date(y,m-1,d)}
function fmtDate(iso,opts={}){if(!iso)return '—';return fromISO(iso).toLocaleDateString('ro-RO',{weekday:'short',day:'numeric',month:'short',year:'numeric',...opts})}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function csvEscape(v){const s=String(v??'');return /[",\r\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
function rowsToCsv(rows){return rows.map(r=>r.map(csvEscape).join(',')).join('\n')}
function parseCsv(text){const rows=[];let row=[],field='',q=false;for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='"'&&text[i+1]==='"'){field+='"';i++}else if(c==='"')q=false;else field+=c}else if(c==='"')q=true;else if(c===','){row.push(field);field=''}else if(c==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field=''}else field+=c}if(field||row.length){row.push(field.replace(/\r$/,''));rows.push(row)}return rows}
function headerIndex(h,n){return h.findIndex(x=>String(x||'').trim().toLowerCase()===n)}
function bool(v){const x=String(v??'').trim().toLowerCase();return ['true','1','yes','y','da','x','on'].includes(x)}
function timestamp(r){const t=Date.parse(r?.updatedAt||'');return Number.isFinite(t)?t:0}
function mergeRecords(...sets){const m=new Map();sets.flat().forEach(r=>{if(!r?.id)return;const old=m.get(r.id);if(!old||timestamp(r)>=timestamp(old))m.set(r.id,{...r})});return [...m.values()]}

function loadLocal(key){
  try{
    const raw=localStorage.getItem(key);
    if(!raw)return[];
    const data=JSON.parse(raw);
    return Array.isArray(data)?data:[];
  }catch(e){console.warn('Cache local invalid',e);return[]}
}
function saveLocal(key,records){
  try{localStorage.setItem(key,JSON.stringify(records||[]))}catch(e){console.warn('Cache local indisponibil',e)}
}
function persistLocal(){saveLocal(LOCAL_GUESTS_KEY,state.guests);saveLocal(LOCAL_VENUES_KEY,state.venues)}
function sameGuestPersistence(a,b){return !!a&&!!b&&String(a.id)===String(b.id)&&!!a.crossedOut===!!b.crossedOut&&num(a.sortOrder)===num(b.sortOrder)&&String(a.updatedAt||'')===String(b.updatedAt||'')}
async function verifyGuestSave(expected){
  const remote=parseGuests(await getCsv(GUEST_ROOM));
  const missing=expected.filter(x=>{const r=remote.find(y=>y.id===x.id);return !sameGuestPersistence(r,x)});
  if(missing.length)throw new Error(`Serverul nu a confirmat ${missing.length} modificări de invitați.`);
  return remote;
}
function activeGuests(){return state.guests.filter(x=>!x.deleted)}
function activeVenues(){return state.venues.filter(x=>!x.deleted)}

function parseGuests(csv){const rows=parseCsv(csv).filter(r=>r.some(v=>String(v).trim()));if(!rows.length)return[];const h=rows[0].map(x=>String(x||'').trim().toLowerCase());if(!h.includes('id'))return[];const ix=n=>headerIndex(h,n);return rows.slice(1).map(r=>({
  id:r[ix('id')]||crypto.randomUUID(), name:r[ix('name')]||'', category:r[ix('category')]||GUEST_CATEGORIES[0], status:r[ix('status')]||'În așteptare', adults:num(r[ix('adults')]), children:num(r[ix('children')]), phone:r[ix('phone')]||'', table:r[ix('table')]||'', menu:r[ix('menu')]||'', notes:r[ix('notes')]||'', crossedOut:ix('crossed_out')>=0?bool(r[ix('crossed_out')]):false, sortOrder:ix('sort_order')>=0?num(r[ix('sort_order')]):0, updatedAt:r[ix('updated_at')]||'', deleted:ix('deleted')>=0?bool(r[ix('deleted')]):false
})).filter(x=>x.id)}
function guestsCsv(records=state.guests){return rowsToCsv([['id','name','category','status','adults','children','phone','table','menu','notes','crossed_out','sort_order','updated_at','deleted'],...records.slice().sort((a,b)=>(a.category||'').localeCompare(b.category||'','ro')||(num(a.sortOrder)-num(b.sortOrder))||a.id.localeCompare(b.id)).map(x=>[x.id,x.name,x.category,x.status,x.adults,x.children,x.phone,x.table,x.menu,x.notes,!!x.crossedOut,num(x.sortOrder),x.updatedAt,!!x.deleted])])}

function parseVenues(csv){const rows=parseCsv(csv).filter(r=>r.some(v=>String(v).trim()));if(!rows.length)return[];const h=rows[0].map(x=>String(x||'').trim().toLowerCase());if(!h.includes('id'))return[];const ix=n=>headerIndex(h,n);return rows.slice(1).map(r=>({
  id:r[ix('id')]||crypto.randomUUID(), name:r[ix('name')]||'', city:r[ix('city')]||'', address:r[ix('address')]||'', capacity:num(r[ix('capacity')]), price:num(r[ix('price')]), menuPrice:num(r[ix('menu_price')]), deposit:num(r[ix('deposit')]), contact:r[ix('contact')]||'', phone:r[ix('phone')]||'', website:r[ix('website')]||'', parking:r[ix('parking')]||'', accommodation:r[ix('accommodation')]||'', features:r[ix('features')]||'', availability:String(r[ix('availability_dates')]||'').split(';').map(s=>s.trim()).filter(s=>/^202[78]-\d{2}-\d{2}$/.test(s)).sort(), notes:r[ix('notes')]||'', updatedAt:r[ix('updated_at')]||'', deleted:ix('deleted')>=0?bool(r[ix('deleted')]):false
})).filter(x=>x.id)}
function venuesCsv(records=state.venues){return rowsToCsv([['id','name','city','address','capacity','price','menu_price','deposit','contact','phone','website','parking','accommodation','features','availability_dates','notes','updated_at','deleted'],...records.slice().sort((a,b)=>a.id.localeCompare(b.id)).map(x=>[x.id,x.name,x.city,x.address,x.capacity,x.price,x.menuPrice,x.deposit,x.contact,x.phone,x.website,x.parking,x.accommodation,x.features,[...new Set(x.availability||[])].sort().join(';'),x.notes,x.updatedAt,!!x.deleted])])}

async function fetchWithTimeout(url,options={},timeoutMs=15000){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeoutMs);try{return await fetch(url,{...options,signal:c.signal})}finally{clearTimeout(t)}}
function csvReadUrls(room){const r=encodeURIComponent(room);return [`${BASE}/_/${r}/csv?t=${Date.now()}`,`${BASE}/=${r}.csv?t=${Date.now()}`]}
async function getCsv(room){let last;for(const url of csvReadUrls(room)){try{const r=await fetchWithTimeout(url,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.text()}catch(e){last=e}}throw new Error(last?.message||'Citire eșuată')}
async function putCsv(room,csv){const url=`${BASE}/_/${encodeURIComponent(room)}`;const r=await fetchWithTimeout(url,{method:'PUT',cache:'no-store',headers:{'Content-Type':'text/csv;charset=UTF-8'},body:csv},20000);if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.text().catch(()=>'')}

async function saveCollection(kind){
  const isGuest=kind==='guest',room=isGuest?GUEST_ROOM:VENUE_ROOM,parse=isGuest?parseGuests:parseVenues,toCsv=isGuest?guestsCsv:venuesCsv,key=isGuest?'guests':'venues',saving=isGuest?'savingGuests':'savingVenues',lastSave=isGuest?'lastGuestSaveAt':'lastVenueSaveAt';
  // Nu pierdem modificările dacă o salvare este deja în curs: așteptăm și reluăm cu starea curentă.
  while(state[saving])await new Promise(r=>setTimeout(r,120));
  state[saving]=true;
  try{
    setSync('Se salvează…');
    persistLocal();
    let remote=[];try{remote=parse(await getCsv(room))}catch(_){remote=[]}
    const merged=mergeRecords(remote,state[key]);
    let lastError;
    for(let attempt=0;attempt<3;attempt++){
      try{
        await putCsv(room,toCsv(merged));
        if(isGuest){
          await new Promise(r=>setTimeout(r,500+attempt*500));
          const verified=await verifyGuestSave(merged);
          state[key]=mergeRecords(verified,merged);
        }else state[key]=merged;
        state[lastSave]=Date.now();
        persistLocal();
        setSync('Salvat live ✓','ok');
        renderAll();
        return;
      }catch(e){lastError=e;console.warn(`Salvare ${kind} încercarea ${attempt+1}/3`,e);await new Promise(r=>setTimeout(r,700+attempt*700))}
    }
    throw lastError||new Error('Salvarea nu a putut fi confirmată.');
  }finally{state[saving]=false}
}

async function syncAll({notify=false}={}){if(state.syncing||state.savingGuests||state.savingVenues)return;state.syncing=true;setSync('Se conectează…');let ge=null,ve=null;try{
  // Îmbinăm mereu datele remote cu cache-ul local pe baza updatedAt. Astfel un refresh nu poate șterge o modificare locală recentă.
  try{const remote=parseGuests(await getCsv(GUEST_ROOM));state.guests=mergeRecords(remote,state.guests,loadLocal(LOCAL_GUESTS_KEY));saveLocal(LOCAL_GUESTS_KEY,state.guests)}catch(e){ge=e;console.error(e);state.guests=mergeRecords(state.guests,loadLocal(LOCAL_GUESTS_KEY))}
  try{const remote=parseVenues(await getCsv(VENUE_ROOM));state.venues=mergeRecords(remote,state.venues,loadLocal(LOCAL_VENUES_KEY));saveLocal(LOCAL_VENUES_KEY,state.venues)}catch(e){ve=e;console.error(e);state.venues=mergeRecords(state.venues,loadLocal(LOCAL_VENUES_KEY))}
  renderAll();
  if(ge&&ve){setSync('Foile nu pot fi citite','error');if(notify)showToast('Sincronizarea a eșuat pentru ambele foi.')}else if(ge||ve){setSync('Sincronizare parțială','error');if(notify)showToast(ge?'Invitații nu au putut fi citiți.':'Sălile nu au putut fi citite.')}else{setSync(`Live ✓ · ${new Date().toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'})}`,'ok');if(notify)showToast('Datele au fost recitite din foile live.')}
}finally{state.syncing=false}}

function renderStats(){const gs=activeGuests(),included=gs.filter(g=>!g.crossedOut),vs=activeVenues(),people=included.reduce((s,g)=>s+g.adults+g.children,0),confirmed=included.filter(g=>g.status==='Confirmat').length,maxCap=Math.max(0,...vs.map(v=>v.capacity));el.statGuests.textContent=included.length;el.statGuestPeople.textContent=`${people} persoane`;el.statConfirmed.textContent=confirmed;el.statVenues.textContent=vs.length;el.statVenueCapacity.textContent=maxCap?`capacitate max. ${maxCap}`:'capacitate max. —'}
function statusClass(s){return s==='Confirmat'?'confirmed':s==='Refuzat'?'declined':'pending'}
function filteredGuests(){const q=el.guestSearch.value.trim().toLowerCase(),status=el.guestStatusFilter.value;return activeGuests().filter(g=>g.category===state.activeGuestCategory&&(!status||g.status===status)&&(!q||[g.name,g.phone,g.table,g.menu,g.notes].join(' ').toLowerCase().includes(q)))}
function categoryShort(cat){return cat==='Invitati Raul'?'Raul':cat==='Invitati Andreea'?'Andreea':'Comuni'}
function guestRow(g){const d=document.createElement('article');d.className=`guest-row${g.crossedOut?' is-crossed':''}`;d.dataset.guestId=g.id;const people=g.adults+g.children;const details=[g.menu,g.notes].filter(Boolean).join(' · ')||'—';d.innerHTML=`<div class="guest-cell guest-cell--name" data-label="Nume / familie"><div class="guest-name-line"><span class="drag-handle" title="Trage pentru reordonare" aria-label="Trage pentru reordonare">⋮⋮</span><strong>${esc(g.name)}</strong>${g.crossedOut?'<span class="crossed-badge">Retras</span>':''}</div><small>${g.adults} adulți${g.children?` + ${g.children} copii`:''}</small></div><div class="guest-cell" data-label="RSVP"><span class="pill ${statusClass(g.status)}">${esc(g.status)}</span></div><div class="guest-cell guest-cell--people" data-label="Persoane"><strong>${people}</strong></div><div class="guest-cell" data-label="Telefon">${g.phone?esc(g.phone):'<span class="cell-muted">—</span>'}</div><div class="guest-cell" data-label="Masă">${g.table?esc(g.table):'<span class="cell-muted">—</span>'}</div><div class="guest-cell guest-cell--details" data-label="Meniu / notițe" title="${esc(details)}">${esc(details)}</div><div class="guest-cell guest-cell--action"><button class="mini-button edit" type="button" title="Editează">✎</button></div>`;d.querySelector('.edit').onclick=()=>openGuest(g.id);return d}
let guestSortable=null;
function guestOrderValue(g,index=0){return Number.isFinite(Number(g.sortOrder))&&Number(g.sortOrder)>0?Number(g.sortOrder):(index+1)*100}
function initGuestSortable(){
  if(guestSortable){guestSortable.destroy();guestSortable=null}
  const map={'Invitati Raul':el.guestsRaul,'Invitati Andreea':el.guestsAndreea,'Invitati comuni':el.guestsCommon};
  const box=map[state.activeGuestCategory];
  const filtered=!!el.guestSearch.value.trim()||!!el.guestStatusFilter.value;
  if(!box||filtered||typeof Sortable==='undefined')return;

  const touchMode=window.matchMedia('(pointer: coarse)').matches||window.innerWidth<=720;
  guestSortable=Sortable.create(box,{
    animation:110,
    handle:touchMode?'.guest-cell--name':'.drag-handle',
    draggable:'.guest-row',
    ghostClass:'guest-row--ghost',
    chosenClass:'guest-row--chosen',
    dragClass:'guest-row--drag',
    forceFallback:touchMode,
    fallbackOnBody:true,
    fallbackTolerance:3,
    delay:touchMode?65:0,
    delayOnTouchOnly:false,
    touchStartThreshold:2,
    scroll:true,
    scrollSensitivity:80,
    scrollSpeed:14,
    bubbleScroll:true,
    onChoose:evt=>{if(touchMode)evt.item.classList.add('is-touch-dragging')},
    onUnchoose:evt=>evt.item.classList.remove('is-touch-dragging'),
    onMove:evt=>{
      const dragged=state.guests.find(g=>g.id===evt.dragged?.dataset.guestId);
      const related=state.guests.find(g=>g.id===evt.related?.dataset.guestId);
      if(!dragged||!related)return true;
      // Activi și retrași se ordonează separat; retrașii rămân mereu jos.
      if(!!dragged.crossedOut!==!!related.crossedOut)return false;
      return true;
    },
    onEnd:async()=>{
      const ids=[...box.querySelectorAll('.guest-row')].map(r=>r.dataset.guestId).filter(Boolean);
      if(!ids.length)return;
      const byId=new Map(state.guests.map(g=>[g.id,g]));
      const activeIds=ids.filter(id=>!byId.get(id)?.crossedOut);
      const crossedIds=ids.filter(id=>!!byId.get(id)?.crossedOut);
      const now=new Date().toISOString();
      const pos=new Map();
      activeIds.forEach((id,i)=>pos.set(id,(i+1)*100));
      crossedIds.forEach((id,i)=>pos.set(id,(i+1)*100));
      state.guests=state.guests.map(g=>pos.has(g.id)?{...g,sortOrder:pos.get(g.id),updatedAt:now}:g);
      renderGuests();
      try{await saveCollection('guest');showToast('Ordinea invitaților a fost salvată.')}catch(err){console.error(err);showToast(`Ordinea nu a putut fi salvată: ${err.message}`)}
    }
  });
}

function renderGuests(){const all=activeGuests(),included=all.filter(g=>!g.crossedOut),list=filteredGuests();const map={'Invitati Raul':[el.guestsRaul,el.countRaul,el.tabCountRaul],'Invitati Andreea':[el.guestsAndreea,el.countAndreea,el.tabCountAndreea],'Invitati comuni':[el.guestsCommon,el.countCommon,el.tabCountCommon]};for(const cat of GUEST_CATEGORIES){const [box,count,tabCount]=map[cat],categoryGuests=all.filter(g=>g.category===cat),categoryIncluded=categoryGuests.filter(g=>!g.crossedOut),totalItems=categoryGuests.length,crossedItems=categoryGuests.length-categoryIncluded.length,totalPeople=categoryIncluded.reduce((sum,g)=>sum+num(g.adults)+num(g.children),0),items=cat===state.activeGuestCategory?list.slice().sort((a,b)=>{const crossedDiff=Number(!!a.crossedOut)-Number(!!b.crossedOut);if(crossedDiff)return crossedDiff;const ai=categoryGuests.indexOf(a),bi=categoryGuests.indexOf(b);return guestOrderValue(a,ai)-guestOrderValue(b,bi)||a.name.localeCompare(b.name,'ro')}):[];tabCount.textContent=totalPeople;tabCount.title=`${totalPeople} persoane active · ${totalItems} înregistrări${crossedItems?` · ${crossedItems} retrași`:''}`;count.textContent=`${totalPeople} pers.`;count.title=`${totalItems} înregistrări${crossedItems?` · ${crossedItems} retrași`:''}`;box.innerHTML='';if(cat===state.activeGuestCategory){if(!items.length)box.innerHTML='<div class="empty-list">Niciun invitat găsit în această listă.</div>';else items.forEach(g=>box.appendChild(guestRow(g)))}}
  $$('.guest-group').forEach(p=>p.classList.toggle('is-active',p.dataset.category===state.activeGuestCategory));
  $$('.guest-category-tab').forEach(b=>b.classList.toggle('is-active',b.dataset.guestCategory===state.activeGuestCategory));
  el.openGuestDialog.textContent=`+ Adaugă la ${categoryShort(state.activeGuestCategory)}`;
  const totalPeople=included.reduce((s,g)=>s+g.adults+g.children,0),confirmedPeople=included.filter(g=>g.status==='Confirmat').reduce((s,g)=>s+g.adults+g.children,0),pending=included.filter(g=>g.status==='În așteptare').length,declined=included.filter(g=>g.status==='Refuzat').length,crossed=all.filter(g=>g.crossedOut).length;el.guestSummary.innerHTML=`<article class="summary-card summary-card--total"><span>Total persoane</span><strong>${totalPeople}</strong><small>${included.length} active${crossed?` · ${crossed} retrași păstrați`:''}</small></article><article class="summary-card"><span>Persoane confirmate</span><strong>${confirmedPeople}</strong><small>RSVP confirmat</small></article><article class="summary-card"><span>În așteptare</span><strong>${pending}</strong><small>invitații fără răspuns final</small></article><article class="summary-card"><span>Refuzate</span><strong>${declined}</strong><small>înregistrări active</small></article>`;initGuestSortable()}

function venueCard(v){const d=document.createElement('article');d.className='venue-card';const dates=(v.availability||[]).filter(x=>/^202[78]-/.test(x));d.innerHTML=`<div class="venue-card__top"><div><h3>${esc(v.name)}</h3><span class="venue-card__city">${esc([v.city,v.address].filter(Boolean).join(' · ')||'Locație nespecificată')}</span></div><div class="mini-actions"><button class="mini-button edit" type="button">✎</button></div></div><div class="venue-card__metrics"><div class="venue-card__metric"><span>Capacitate</span><strong>${v.capacity||'—'} pers.</strong></div><div class="venue-card__metric"><span>Închiriere</span><strong>${money(v.price)}</strong></div><div class="venue-card__metric"><span>Meniu / pers.</span><strong>${money(v.menuPrice)}</strong></div></div><div class="venue-card__features">${esc([v.features,v.parking?`Parcare: ${v.parking}`:'',v.accommodation?`Cazare: ${v.accommodation}`:''].filter(Boolean).join(' · ')||'Fără facilități notate.')}</div><div class="venue-card__dates">${dates.slice(0,5).map(x=>`<span class="date-pill">${esc(fmtDate(x,{year:undefined}))}</span>`).join('')}${dates.length>5?`<span class="date-pill">+${dates.length-5}</span>`:''}</div><div class="venue-card__footer"><small>${dates.length} zile disponibile${v.deposit?` · avans ${money(v.deposit)}`:''}</small>${v.website?`<a class="button button--ghost" href="${esc(v.website)}" target="_blank" rel="noopener noreferrer">Site ↗</a>`:''}</div>`;d.querySelector('.edit').onclick=()=>openVenue(v.id);return d}
function renderVenues(){const q=el.venueSearch.value.trim().toLowerCase(),min=num(el.venueCapacityFilter.value),list=activeVenues().filter(v=>(!min||v.capacity>=min)&&(!q||[v.name,v.city,v.address,v.features,v.notes].join(' ').toLowerCase().includes(q))).sort((a,b)=>a.name.localeCompare(b.name,'ro'));el.venueGrid.innerHTML='';if(!list.length){el.venueGrid.innerHTML='<div class="empty-list panel">Nicio sală găsită. Adaugă prima ofertă.</div>';return}list.forEach(v=>el.venueGrid.appendChild(venueCard(v)))}

function availableVenues(date){return activeVenues().filter(v=>(v.availability||[]).includes(date)).sort((a,b)=>a.name.localeCompare(b.name,'ro'))}
function renderCalendar(){const y=state.calendarYear,m=state.calendarMonth,first=new Date(y,m,1),offset=(first.getDay()+6)%7,start=new Date(y,m,1-offset);el.calendarTitle.textContent=new Date(y,m,1).toLocaleDateString('ro-RO',{month:'long',year:'numeric'});el.calendarGrid.innerHTML='';for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const iso=localISO(d),day=d.getDay(),weekend=day===0||day===6,outside=d.getMonth()!==m,avail=weekend?availableVenues(iso):[];const b=document.createElement('button');b.type='button';b.disabled=!weekend;b.className=`calendar-day${outside?' is-outside':''}${weekend?' is-weekend':''}${avail.length?' has-availability':''}${state.selectedDate===iso?' is-selected':''}`;b.innerHTML=`<span class="calendar-day__number">${d.getDate()}</span>${avail.length?`<span class="calendar-day__count">${avail.length} ${avail.length===1?'sală':'săli'}</span>`:''}`;if(weekend)b.onclick=()=>{state.selectedDate=iso;renderCalendar();renderAvailability()};el.calendarGrid.appendChild(b)}}
function weekendPair(iso){const d=fromISO(iso),day=d.getDay();const sat=new Date(d);if(day===0)sat.setDate(d.getDate()-1);const sun=new Date(sat);sun.setDate(sat.getDate()+1);return [localISO(sat),localISO(sun)]}
function renderAvailability(){if(!state.selectedDate){el.selectedWeekendTitle.textContent='Alege un weekend';el.availabilityContent.innerHTML='<div class="empty-state"><div>📅</div><h3>Selectează o sâmbătă sau duminică</h3><p>Vei vedea sălile disponibile în ziua aleasă și în cealaltă zi a aceluiași weekend.</p></div>';return}const [sat,sun]=weekendPair(state.selectedDate);el.selectedWeekendTitle.textContent=`Weekend ${fmtDate(sat,{weekday:undefined,year:undefined})} – ${fmtDate(sun,{weekday:undefined})}`;el.availabilityContent.innerHTML='';for(const date of [sat,sun]){const block=document.createElement('section');block.className='day-availability';const list=availableVenues(date);block.innerHTML=`<h4>${fmtDate(date)}</h4>`;if(!list.length)block.innerHTML+='<div class="availability-none">Nicio sală marcată disponibilă în această zi.</div>';else list.forEach(v=>{const row=document.createElement('div');row.className='availability-venue';row.innerHTML=`<div><strong>${esc(v.name)}</strong><span>${v.capacity||'—'} pers. · ${v.menuPrice?`${money(v.menuPrice)}/pers.`:'meniu —'}</span></div><button class="mini-button" type="button">✎</button>`;row.querySelector('button').onclick=()=>openVenue(v.id);block.appendChild(row)});el.availabilityContent.appendChild(block)}}

function renderAll(){renderStats();renderGuests();renderVenues();renderCalendar();renderAvailability()}

function openGuest(id='',category=state.activeGuestCategory){el.guestForm.reset();el.guestId.value='';el.guestAdults.value=1;el.guestChildren.value=0;el.guestStatus.value='În așteptare';el.guestCrossed.checked=false;el.guestCategory.value=category||GUEST_CATEGORIES[0];el.guestDialogTitle.textContent=`Adaugă invitat · ${categoryShort(el.guestCategory.value)}`;el.deleteGuest.hidden=true;if(id){const g=state.guests.find(x=>x.id===id);if(!g)return;el.guestId.value=g.id;el.guestName.value=g.name;el.guestCategory.value=g.category;el.guestStatus.value=g.status;el.guestAdults.value=g.adults;el.guestChildren.value=g.children;el.guestPhone.value=g.phone;el.guestTable.value=g.table;el.guestMenu.value=g.menu;el.guestNotes.value=g.notes;el.guestCrossed.checked=!!g.crossedOut;el.guestDialogTitle.textContent='Editează invitat';el.deleteGuest.hidden=false}el.guestDialog.showModal()}
async function handleGuestSubmit(e){e.preventDefault();const name=el.guestName.value.trim(),adults=num(el.guestAdults.value),children=num(el.guestChildren.value);if(!name||adults<0||children<0){showToast('Completează numele și numărul de persoane.');return}const id=el.guestId.value||crypto.randomUUID(),old=state.guests.find(x=>x.id===id),category=el.guestCategory.value,crossedOut=!!el.guestCrossed.checked,statusChangedGroup=!!old&&(old.category!==category||!!old.crossedOut!==crossedOut),sameBucket=activeGuests().filter(x=>x.category===category&&!!x.crossedOut===crossedOut&&x.id!==id),bucketMax=Math.max(0,...sameBucket.map(x=>num(x.sortOrder))),sortOrder=old&&!statusChangedGroup&&num(old.sortOrder)>0?num(old.sortOrder):bucketMax+100,r={id,name,category,status:el.guestStatus.value,adults,children,phone:el.guestPhone.value.trim(),table:el.guestTable.value.trim(),menu:el.guestMenu.value.trim(),notes:el.guestNotes.value.trim(),crossedOut,sortOrder,updatedAt:new Date().toISOString(),deleted:false};state.guests=old?state.guests.map(x=>x.id===id?r:x):[...state.guests,r];persistLocal();el.guestDialog.close();renderAll();try{await saveCollection('guest');showToast(old?'Invitat actualizat.':'Invitat adăugat.')}catch(err){console.error(err);showToast(`Salvarea a eșuat: ${err.message}`)}}
async function deleteGuest(){const id=el.guestId.value,g=state.guests.find(x=>x.id===id);if(!g)return;state.guests=state.guests.map(x=>x.id===id?{...x,deleted:true,updatedAt:new Date().toISOString()}:x);persistLocal();el.guestDialog.close();renderAll();try{await saveCollection('guest');showToast('Invitat șters.')}catch(err){console.error(err);showToast(`Ștergerea a eșuat: ${err.message}`)}}

function renderDateChips(){el.availabilityChips.innerHTML='';state.venueDraftDates.slice().sort().forEach(date=>{const c=document.createElement('span');c.className='date-chip';c.innerHTML=`${esc(fmtDate(date))}<button type="button" aria-label="Elimină">×</button>`;c.querySelector('button').onclick=()=>{state.venueDraftDates=state.venueDraftDates.filter(x=>x!==date);renderDateChips()};el.availabilityChips.appendChild(c)})}
function addAvailabilityDate(){const date=el.venueAvailabilityDate.value;if(!/^202[78]-\d{2}-\d{2}$/.test(date)){showToast('Alege o dată din 2027 sau 2028.');return}const day=fromISO(date).getDay();if(day!==0&&day!==6){showToast('Calendarul urmărește weekend-urile. Alege sâmbătă sau duminică.');return}if(!state.venueDraftDates.includes(date))state.venueDraftDates.push(date);el.venueAvailabilityDate.value='';renderDateChips()}
function openVenue(id=''){el.venueForm.reset();el.venueId.value='';state.venueDraftDates=[];el.venueDialogTitle.textContent='Adaugă sală';el.deleteVenue.hidden=true;if(id){const v=state.venues.find(x=>x.id===id);if(!v)return;el.venueId.value=v.id;el.venueName.value=v.name;el.venueCity.value=v.city;el.venueAddress.value=v.address;el.venueCapacity.value=v.capacity||'';el.venuePrice.value=v.price||'';el.venueMenuPrice.value=v.menuPrice||'';el.venueDeposit.value=v.deposit||'';el.venueContact.value=v.contact;el.venuePhone.value=v.phone;el.venueWebsite.value=v.website;el.venueParking.value=v.parking||'Da';el.venueAccommodation.value=v.accommodation||'Nu';el.venueFeatures.value=v.features;el.venueNotes.value=v.notes;state.venueDraftDates=[...(v.availability||[])];el.venueDialogTitle.textContent='Editează sală';el.deleteVenue.hidden=false}renderDateChips();el.venueDialog.showModal()}
async function handleVenueSubmit(e){e.preventDefault();const name=el.venueName.value.trim(),capacity=num(el.venueCapacity.value);if(!name||capacity<1){showToast('Completează numele sălii și capacitatea.');return}const id=el.venueId.value||crypto.randomUUID(),old=state.venues.find(x=>x.id===id),r={id,name,city:el.venueCity.value.trim(),address:el.venueAddress.value.trim(),capacity,price:num(el.venuePrice.value),menuPrice:num(el.venueMenuPrice.value),deposit:num(el.venueDeposit.value),contact:el.venueContact.value.trim(),phone:el.venuePhone.value.trim(),website:el.venueWebsite.value.trim(),parking:el.venueParking.value,accommodation:el.venueAccommodation.value,features:el.venueFeatures.value.trim(),availability:[...new Set(state.venueDraftDates)].sort(),notes:el.venueNotes.value.trim(),updatedAt:new Date().toISOString(),deleted:false};state.venues=old?state.venues.map(x=>x.id===id?r:x):[...state.venues,r];persistLocal();el.venueDialog.close();renderAll();try{await saveCollection('venue');showToast(old?'Sala a fost actualizată.':'Sala a fost adăugată.')}catch(err){console.error(err);showToast(`Salvarea a eșuat: ${err.message}`)}}
async function deleteVenue(){const id=el.venueId.value,v=state.venues.find(x=>x.id===id);if(!v)return;state.venues=state.venues.map(x=>x.id===id?{...x,deleted:true,updatedAt:new Date().toISOString()}:x);persistLocal();el.venueDialog.close();renderAll();try{await saveCollection('venue');showToast('Sala a fost ștearsă.')}catch(err){console.error(err);showToast(`Ștergerea a eșuat: ${err.message}`)}}

function exportExcel(){if(typeof XLSX==='undefined'){showToast('Modulul Excel nu s-a încărcat.');return}const guestRows=activeGuests().map(g=>({'Categorie':g.category,'Nume / familie':g.name,'Retras / tăiat':g.crossedOut?'Da':'Nu','Status RSVP':g.status,'Adulți':g.adults,'Copii':g.children,'Total persoane':g.adults+g.children,'Inclus în total':g.crossedOut?'Nu':'Da','Telefon':g.phone,'Masa':g.table,'Preferințe meniu':g.menu,'Notițe':g.notes}));const venueRows=activeVenues().map(v=>({'Sală':v.name,'Oraș':v.city,'Adresă':v.address,'Capacitate':v.capacity,'Preț închiriere (€)':v.price,'Meniu / persoană (€)':v.menuPrice,'Avans (€)':v.deposit,'Contact':v.contact,'Telefon':v.phone,'Website':v.website,'Parcare':v.parking,'Cazare':v.accommodation,'Facilități':v.features,'Zile disponibile':(v.availability||[]).join(', '),'Notițe':v.notes}));const availabilityRows=[];activeVenues().forEach(v=>(v.availability||[]).forEach(date=>availabilityRows.push({'Data':date,'Zi':fromISO(date).toLocaleDateString('ro-RO',{weekday:'long'}),'Sală':v.name,'Oraș':v.city,'Capacitate':v.capacity,'Meniu / persoană (€)':v.menuPrice,'Preț închiriere (€)':v.price})));const wb=XLSX.utils.book_new();const wsG=XLSX.utils.json_to_sheet(guestRows.length?guestRows:[{'Categorie':'','Nume / familie':'Fără invitați'}]);const wsV=XLSX.utils.json_to_sheet(venueRows.length?venueRows:[{'Sală':'Fără săli'}]);const wsA=XLSX.utils.json_to_sheet(availabilityRows.length?availabilityRows:[{'Data':'','Sală':'Fără disponibilități'}]);wsG['!cols']=[{wch:20},{wch:28},{wch:14},{wch:16},{wch:9},{wch:9},{wch:14},{wch:14},{wch:18},{wch:14},{wch:25},{wch:36}];wsV['!cols']=Array(15).fill({wch:18});wsV['!cols'][0]={wch:28};wsV['!cols'][12]={wch:32};wsV['!cols'][13]={wch:44};wsV['!cols'][14]={wch:36};wsA['!cols']=[{wch:12},{wch:12},{wch:28},{wch:18},{wch:12},{wch:20},{wch:20}];XLSX.utils.book_append_sheet(wb,wsG,'Invitati');XLSX.utils.book_append_sheet(wb,wsV,'Sali');XLSX.utils.book_append_sheet(wb,wsA,'Disponibilitate');XLSX.writeFile(wb,'nunta_Raul_Andreea_date_complete.xlsx');showToast('Excel-ul complet a fost generat.')}

let toastTimer;function showToast(msg){clearTimeout(toastTimer);el.toast.textContent=msg;el.toast.classList.add('show');toastTimer=setTimeout(()=>el.toast.classList.remove('show'),3000)}

$$('.tab').forEach(b=>b.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('is-active'));$$('.tab-panel').forEach(x=>x.classList.remove('is-active'));b.classList.add('is-active');$(`#tab-${b.dataset.tab}`).classList.add('is-active')});
$$('.year-button').forEach(b=>b.onclick=()=>{state.calendarYear=Number(b.dataset.year);state.calendarMonth=0;state.selectedDate='';$$('.year-button').forEach(x=>x.classList.toggle('is-active',x===b));renderCalendar();renderAvailability()});
$('#prevMonth').onclick=()=>{state.calendarMonth--;if(state.calendarMonth<0){state.calendarMonth=11;state.calendarYear=Math.max(2027,state.calendarYear-1)}$$('.year-button').forEach(x=>x.classList.toggle('is-active',Number(x.dataset.year)===state.calendarYear));renderCalendar()};
$('#nextMonth').onclick=()=>{state.calendarMonth++;if(state.calendarMonth>11){state.calendarMonth=0;state.calendarYear=Math.min(2028,state.calendarYear+1)}$$('.year-button').forEach(x=>x.classList.toggle('is-active',Number(x.dataset.year)===state.calendarYear));renderCalendar()};
el.openGuestDialog.onclick=()=>openGuest('',state.activeGuestCategory);$$('.guest-category-tab').forEach(b=>b.onclick=()=>{state.activeGuestCategory=b.dataset.guestCategory;el.guestSearch.value='';renderGuests()});$('#closeGuestDialog').onclick=()=>el.guestDialog.close();$('#cancelGuest').onclick=()=>el.guestDialog.close();el.guestForm.addEventListener('submit',handleGuestSubmit);el.deleteGuest.onclick=deleteGuest;el.guestSearch.addEventListener('input',renderGuests);el.guestStatusFilter.addEventListener('change',renderGuests);
$('#openVenueDialog').onclick=()=>openVenue();$('#closeVenueDialog').onclick=()=>el.venueDialog.close();$('#cancelVenue').onclick=()=>el.venueDialog.close();$('#addAvailabilityDate').onclick=addAvailabilityDate;el.venueForm.addEventListener('submit',handleVenueSubmit);el.deleteVenue.onclick=deleteVenue;el.venueSearch.addEventListener('input',renderVenues);el.venueCapacityFilter.addEventListener('change',renderVenues);
$('#syncButton').onclick=()=>syncAll({notify:true});$('#exportExcel').onclick=exportExcel;
window.addEventListener('online',()=>syncAll({notify:true}));document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncAll()});setInterval(()=>{if(!document.hidden&&!state.savingGuests&&!state.savingVenues)syncAll()},SYNC_MS);
window.addEventListener('error',e=>{console.error(e.error||e.message);setSync(`Eroare aplicație: ${e.message}`,'error')});window.addEventListener('unhandledrejection',e=>{console.error(e.reason);setSync(`Eroare: ${e.reason?.message||e.reason}`,'error')});

state.guests=loadLocal(LOCAL_GUESTS_KEY);state.venues=loadLocal(LOCAL_VENUES_KEY);renderAll();syncAll();
