(function(){
'use strict';
const V = window.VIDEOS;
const KEY = 'vw_state_v1';
const $ = id => document.getElementById(id);
let state = load();
let ui = {status:'all', tag:'', sort:'rec', q:''};
let current = null, player = null, playerReady = false, timer = null;

function load(){ try{ return JSON.parse(localStorage.getItem(KEY)) || {}; }catch(e){ return {}; } }
function save(){ if(current&&state[current.id]) state[current.id].u=Date.now();
  try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){ toast('השמירה בדפדפן נכשלה'); } pushSoon(); }

/* ---------- cloud sync (secret key in the address: ?key=...) ---------- */
const CFG = window.SYNC_CONFIG || {};
let syncKey = null;
try{ const p=new URLSearchParams(location.search).get('key'); if(p){ localStorage.setItem('vw_key',p); history.replaceState(null,'',location.pathname+location.hash); } syncKey=localStorage.getItem('vw_key'); }catch(e){}
const syncOn = !!(CFG.url && CFG.anonKey && syncKey && syncKey.length>=24);
function rpc(fn, body){ return fetch(CFG.url+'/rest/v1/rpc/'+fn,{method:'POST',headers:{apikey:CFG.anonKey,Authorization:'Bearer '+CFG.anonKey,'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>{ if(!r.ok) throw new Error(r.status); return r.status===204?null:r.json(); }); }
let pushT=null;
function pushSoon(){ if(!syncOn) return; clearTimeout(pushT); pushT=setTimeout(()=>rpc('save_progress',{k:syncKey,d:state}).catch(()=>toast('הסנכרון לענן נכשל')),1200); }
function pull(){ if(!syncOn) return; rpc('get_progress',{k:syncKey}).then(remote=>{
  let changed=false; remote=remote||{};
  Object.keys(remote).forEach(id=>{ if(!state[id]||(remote[id].u||0)>(state[id].u||0)){ state[id]=remote[id]; changed=true; } });
  if(changed){ try{ localStorage.setItem(KEY,JSON.stringify(state)); }catch(e){} if(!current) render(); else renderDetail(); }
  if(Object.keys(state).some(id=>!remote[id]||(state[id].u||0)>(remote[id].u||0))) pushSoon();
}).catch(()=>toast('אין חיבור לענן, עובד מקומית')); }
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) pull(); });
function st(id){ return state[id] || (state[id] = {watched:false, rating:0, tags:[], notes:[]}); }
function toast(t){ const el=$('toast'); el.textContent=t; el.hidden=false; clearTimeout(toast.h); toast.h=setTimeout(()=>el.hidden=true,2200); }
function fmtViews(n){ if(n==null) return 'צפיות לא פורסמו'; if(n>=1e6) return (n/1e6).toFixed(1).replace('.0','')+' מיליון צפיות'; if(n>=1000) return Math.round(n/1000)+' אלף צפיות'; return n+' צפיות'; }
function fmtTime(s){ s=Math.max(0,Math.floor(s)); const h=Math.floor(s/3600), m=Math.floor(s%3600/60), x=s%60; return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0'); }
function el(tag, cls, text){ const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }
const ytCount = {}; V.forEach(v=>ytCount[v.yt]=(ytCount[v.yt]||0)+1);
const byId = Object.fromEntries(V.map(v=>[v.id,v]));

function allTags(){ const s=new Set(); Object.values(state).forEach(x=>(x.tags||[]).forEach(t=>s.add(t))); return [...s].sort(); }

function filtered(){
  let l = V.filter(v=>{
    const s = state[v.id]||{};
    if(ui.status==='todo' && s.watched) return false;
    if(ui.status==='done' && !s.watched) return false;
    if(ui.status==='top' && !v.order) return false;
    if(ui.tag && !(s.tags||[]).includes(ui.tag)) return false;
    if(ui.q){ const h=(v.title+' '+v.creator+' '+v.technique+' '+(s.tags||[]).join(' ')).toLowerCase(); if(!h.includes(ui.q)) return false; }
    return true;
  });
  const rec = (a,b)=>(a.order||999)-(b.order||999) || V.indexOf(a)-V.indexOf(b);
  if(ui.sort==='views') l.sort((a,b)=>(b.views||0)-(a.views||0));
  else if(ui.sort==='rating') l.sort((a,b)=>((state[b.id]||{}).rating||0)-((state[a.id]||{}).rating||0) || rec(a,b));
  else l.sort(rec);
  return l;
}

function nextUnwatched(){ return V.slice().sort((a,b)=>(a.order||999)-(b.order||999)||V.indexOf(a)-V.indexOf(b)).find(v=>!(state[v.id]||{}).watched); }

function render(){
  const done = V.filter(v=>(state[v.id]||{}).watched).length;
  $('pDone').textContent=done; $('pTotal').textContent=V.length;
  $('barFill').style.width=(done/V.length*100)+'%';
  const n=nextUnwatched(); const pn=$('pNext'); pn.textContent='';
  if(n){ pn.append('הבא: '); const a=el('a',null,n.title); a.href='#'+n.id; a.style.cssText='color:#fff;direction:ltr;unicode-bidi:plaintext'; pn.append(a); } else pn.textContent='סיימת את כולם';
  const sel=$('tagSel'); const cur=ui.tag; sel.length=1;
  allTags().forEach(t=>{ const o=el('option',null,t); o.value=t; sel.append(o); }); sel.value=cur;
  const list=$('list'); list.textContent='';
  const l=filtered();
  if(!l.length){ list.append(el('div','empty','אין סרטונים שמתאימים לסינון')); return; }
  l.forEach(v=>{
    const s=state[v.id]||{};
    const c=el('button','card'+(s.watched?' done':'')); c.type='button'; c.onclick=()=>{ location.hash=v.id; };
    const th=el('div','thumb'); const img=el('img'); img.loading='lazy'; img.alt=''; img.src='https://i.ytimg.com/vi/'+v.yt+'/mqdefault.jpg'; th.append(img);
    if(v.order) th.append(el('span','badge','#'+v.order));
    const b=el('div','c-body');
    b.append(el('div','c-title',v.title));
    b.append(el('div','c-sub',v.creator+' · '+fmtViews(v.views)));
    b.append(el('div','c-sub',v.technique.replace(/\s*\(.*\)\s*$/,'')));
    const meta=el('div','c-tags');
    if(s.rating) meta.append(el('span','mini-stars','★'.repeat(s.rating)));
    (s.tags||[]).forEach(t=>meta.append(el('span','chip',t)));
    if((s.notes||[]).length) meta.append(el('span','note-count',s.notes.length+' הערות'));
    if(meta.childNodes.length) b.append(meta);
    c.append(th,b); list.append(c);
  });
}

/* ---------- detail ---------- */
function open(id){
  const v=byId[id]; if(!v) return closeDetail(true);
  current=v; const s=st(v.id);
  const idx=V.indexOf(v);
  $('dPos').textContent=(v.order?'מומלץ #'+v.order+' · ':'')+(idx+1)+' מתוך '+V.length;
  $('dTitle').textContent=v.title;
  $('dMeta').textContent=v.creator+' · '+fmtViews(v.views)+(v.stage?' · '+v.stage:'');
  $('dWhy').textContent=v.why||''; $('dDesc').textContent=v.desc||'';
  $('ytLink').href='https://www.youtube.com/watch?v='+v.yt;
  const w=$('dWarn'); if(ytCount[v.yt]>1){ w.hidden=false; w.textContent='שימו לב: בקובץ האקסל הלינק הזה מופיע ב-'+ytCount[v.yt]+' שורות עם שמות שונים, ולכן ייתכן שהסרטון לא תואם לכותרת.'; } else w.hidden=true;
  $('detail').hidden=false; document.body.style.overflow='hidden';
  $('detail').querySelector('.detail-body').scrollTop=0;
  $('fallback').hidden=true;
  renderDetail();
  loadPlayer(v.yt);
}
function closeDetail(noHash){
  $('detail').hidden=true; document.body.style.overflow='';
  clearInterval(timer);
  if(player&&player.pauseVideo) try{player.pauseVideo()}catch(e){}
  current=null; if(!noHash && location.hash) history.replaceState(null,'',location.pathname+location.search);
  render();
}
function renderDetail(){
  if(!current) return; const s=st(current.id);
  const wb=$('watchedBtn'); wb.textContent=s.watched?'✓ נצפה (לחיצה לביטול)':'סימון כנצפה'; wb.classList.toggle('is-done',!!s.watched);
  const stars=$('stars'); stars.textContent='';
  for(let i=5;i>=1;i--){ const b=el('button',i<=s.rating?'on':'','★'); b.type='button'; b.setAttribute('aria-label',i+' כוכבים'); b.onclick=()=>{ s.rating=(s.rating===i?0:i); save(); renderDetail(); }; stars.append(b); }
  const tg=$('dTags'); tg.textContent='';
  s.tags.forEach(t=>{ const c=el('span','chip',t); const x=el('button',null,'×'); x.type='button'; x.setAttribute('aria-label','הסרת '+t); x.onclick=()=>{ s.tags=s.tags.filter(y=>y!==t); save(); renderDetail(); }; c.append(x); tg.append(c); });
  const dl=$('tagList'); dl.textContent=''; allTags().forEach(t=>{ const o=el('option'); o.value=t; dl.append(o); });
  const nl=$('notes'); nl.textContent='';
  s.notes.slice().sort((a,b)=>(a.t==null)-(b.t==null)||(a.t||0)-(b.t||0)).forEach(n=>{
    const li=el('li');
    if(n.t!=null){ const t=el('button','t',fmtTime(n.t)); t.type='button'; t.onclick=()=>seek(n.t); li.append(t); }
    li.append(el('div','txt',n.text));
    const d=el('button','del','×'); d.type='button'; d.setAttribute('aria-label','מחיקת הערה'); d.onclick=()=>{ s.notes=s.notes.filter(x=>x!==n); save(); renderDetail(); }; li.append(d);
    nl.append(li);
  });
}

/* ---------- YouTube player ---------- */
let apiPromise=null;
function ytApi(){
  if(window.YT&&YT.Player) return Promise.resolve();
  if(apiPromise) return apiPromise;
  apiPromise=new Promise((res,rej)=>{
    const prev=window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady=()=>{ if(prev) prev(); res(); };
    const s=document.createElement('script'); s.src='https://www.youtube.com/iframe_api'; s.onerror=()=>rej(new Error('api')); document.head.append(s);
    setTimeout(()=>rej(new Error('timeout')),12000);
  }); return apiPromise;
}
function fallback(msg){ const f=$('fallback'); f.textContent=''; f.append(el('div',null,msg)); const a=el('a','ghost','פתיחה ביוטיוב'); a.href=$('ytLink').href; a.target='_blank'; a.rel='noopener'; f.append(a); f.hidden=false; }
async function loadPlayer(yt){
  clearInterval(timer); $('nowTime').textContent='0:00';
  try{ await ytApi(); }catch(e){ return fallback('נגן יוטיוב לא נטען. בדקו חיבור לאינטרנט.'); }
  if(!current||current.yt!==yt) return;
  if(player&&player.loadVideoById){ player.cueVideoById(yt); }
  else{
    player=new YT.Player('player',{videoId:yt,playerVars:{playsinline:1,rel:0,modestbranding:1,hl:'he'},events:{
      onReady:()=>{ playerReady=true; },
      onError:()=>fallback('הסרטון לא זמין להטמעה. אפשר לצפות בו ביוטיוב.')
    }});
  }
  timer=setInterval(()=>{ try{ if(player&&player.getCurrentTime) $('nowTime').textContent=fmtTime(player.getCurrentTime()); }catch(e){} },500);
}
function seek(t){ try{ player.seekTo(t,true); player.playVideo(); }catch(e){ toast('הנגן עדיין לא מוכן'); } }

/* ---------- events ---------- */
$('search').addEventListener('input',e=>{ ui.q=e.target.value.trim().toLowerCase(); render(); });
$('statusSeg').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; ui.status=b.dataset.s; [...$('statusSeg').children].forEach(x=>x.classList.toggle('on',x===b)); render(); });
$('tagSel').addEventListener('change',e=>{ ui.tag=e.target.value; render(); });
$('sortSel').addEventListener('change',e=>{ ui.sort=e.target.value; render(); });
$('closeBtn').onclick=()=>closeDetail();
function step(d){ const i=V.indexOf(current)+d; if(i>=0&&i<V.length) location.hash=V[i].id; }
$('prevBtn').onclick=()=>step(-1); $('nextBtn').onclick=()=>step(1);
$('watchedBtn').onclick=()=>{ const s=st(current.id); s.watched=!s.watched; save(); renderDetail(); if(s.watched) toast('סומן כנצפה'); };
$('tagForm').addEventListener('submit',e=>{ e.preventDefault(); const t=$('tagInput').value.trim(); if(!t) return; const s=st(current.id); if(!s.tags.includes(t)) s.tags.push(t); $('tagInput').value=''; save(); renderDetail(); });
$('noteForm').addEventListener('submit',e=>{ e.preventDefault(); const text=$('noteText').value.trim(); if(!text) return;
  let t=null; if($('noteStamp').checked){ try{ t=Math.floor(player.getCurrentTime()); }catch(err){ t=null; } }
  st(current.id).notes.push({t,text,at:Date.now()}); $('noteText').value=''; save(); renderDetail(); });
$('noteText').addEventListener('keydown',e=>{ if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)) $('noteForm').requestSubmit(); });
$('menuBtn').onclick=e=>{ e.stopPropagation(); $('menu').hidden=!$('menu').hidden; };
document.addEventListener('click',e=>{ if(!$('menu').contains(e.target)) $('menu').hidden=true; });
$('exportBtn').onclick=()=>{ const a=el('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,1)],{type:'application/json'})); a.download='video-progress-'+new Date().toISOString().slice(0,10)+'.json'; document.body.append(a); a.click(); a.remove(); $('menu').hidden=true; };
$('importBtn').onclick=()=>{ $('importFile').click(); $('menu').hidden=true; };
$('importFile').onchange=async e=>{ const f=e.target.files[0]; if(!f) return; try{ const d=JSON.parse(await f.text()); if(typeof d!=='object'||Array.isArray(d)) throw 0; state=d; save(); render(); toast('הגיבוי שוחזר'); }catch(err){ toast('הקובץ לא תקין'); } e.target.value=''; };
let resetArmed=0;
$('resetBtn').onclick=()=>{ if(Date.now()-resetArmed>4000){ resetArmed=Date.now(); $('resetBtn').textContent='לחיצה נוספת לאישור מחיקה'; return; } state={}; save(); render(); $('resetBtn').textContent='איפוס כל הסימונים'; $('menu').hidden=true; toast('הכל אופס'); };
function route(){ const id=location.hash.slice(1); if(id&&byId[id]) open(id); else if(!$('detail').hidden) closeDetail(true); }
window.addEventListener('hashchange',route);
render(); route(); pull();
})();
