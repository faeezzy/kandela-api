(function(){
'use strict';
var RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
var G = window.gsap, hasG = !!G;
var $ = function(s,r){return (r||document).querySelector(s);};
var $$ = function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};
var clamp = function(v,a,b){return Math.min(b,Math.max(a,v));};
var fmt = function(n){return Math.round(n).toLocaleString('id-ID');};
var f1 = function(n){return (Math.round(n*10)/10).toFixed(1).replace('.',',');};
var rp = function(n){return (n<0?'-':'')+'Rp'+Math.abs(Math.round(n)).toLocaleString('id-ID');};
var N = 84, DEC = 64, CAPITAL = 10000000, LVL = 120;

/* ---------- materi contoh (RAG ringan: pencarian kata kunci) ---------- */
var KB = [
 {id:'m1',title:'Dasar candlestick',page:2,req:1,tags:['candle','candlestick','sumbu','wick','badan','buka','tutup'],text:'Satu candle merangkum harga buka, tertinggi, terendah, dan tutup dalam satu periode. Badan hijau berarti harga tutup di atas harga buka, merah sebaliknya. Sumbu menunjukkan rentang harga yang sempat disentuh.'},
 {id:'m2',title:'Support dan resistance',page:5,req:1,tags:['support','resistance','tren','area','tembus'],text:'Support adalah area harga tempat pembeli cenderung muncul, resistance adalah area tempat penjual cenderung muncul. Area yang sering diuji makin berarti, tetapi tetap bisa tembus.'},
 {id:'m3',title:'RSI dan MACD',page:9,req:2,tags:['rsi','macd','momentum','indikator','jenuh','histogram','ma','ma20'],text:'RSI mengukur kecepatan perubahan harga pada skala 0 sampai 100. Di atas 70 sering disebut jenuh beli dan di bawah 30 jenuh jual, tetapi pada tren kuat kondisi itu bisa bertahan lama. Histogram MACD positif menandakan momentum naik.'},
 {id:'m4',title:'Manajemen risiko',page:4,req:2,tags:['risiko','stop','loss','sl','posisi','modal','rr','reward','ukuran','batas','kalah'],text:'Tentukan batas risiko per transaksi sebelum masuk, misalnya maksimal 2% dari modal. Ukuran posisi dihitung dari jarak stop loss, bukan dari rasa yakin. Rasio risk-reward di bawah 1:1 menuntut win rate sangat tinggi supaya modal bertahan.'},
 {id:'m5',title:'Membaca sentimen berita',page:12,req:3,tags:['sentimen','berita','headline','pasar','bertentangan','sejalan'],text:'Sentimen berita adalah sinyal tambahan, bukan pemicu tunggal. Sentimen sering sudah tercermin di harga. Cari kondisi saat sentimen dan teknikal sejalan, dan waspada ketika keduanya bertentangan.'},
 {id:'m6',title:'Disiplin dan evaluasi',page:15,req:3,tags:['disiplin','proses','evaluasi','hasil','skor','untung','rugi','jurnal'],text:'Nilai keputusan dari prosesnya: apakah sesuai rencana dan batas risiko. Hasil satu transaksi dipengaruhi keberuntungan, proses yang konsisten yang membangun hasil jangka panjang.'}
];
function kbById(id){return KB.filter(function(m){return m.id===id;})[0];}
function retrieve(q,k){
  var w=(q||'').toLowerCase().split(/[^a-z0-9]+/).filter(function(x){return x.length>1;});
  var sc=KB.map(function(m){var s=0;w.forEach(function(t){if(m.tags.indexOf(t)>-1)s+=3;else if(m.title.toLowerCase().indexOf(t)>-1)s+=2;else if(m.text.toLowerCase().indexOf(t)>-1)s+=1;});return {m:m,s:s};}).sort(function(a,b){return b.s-a.s;});
  var top=sc.filter(function(x){return x.s>0;}).slice(0,k||2).map(function(x){return x.m;});
  return top.length?top:[kbById('m6')];
}

/* ---------- skenario dibuat dan dinilai di SERVER (/api/scenario, /api/submit) ----------
   Klien tidak pernah memegang candle masa depan atau seed sebelum keputusan dikirim. */
function rng(seed){var a=seed>>>0;return function(){a=(a+0x6D2B79F5)>>>0;var t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function smaAll(a,n){return a.map(function(_,i){if(i<n-1)return null;var s=0;for(var j=i-n+1;j<=i;j++)s+=a[j];return s/n;});}

/* ---------- penyimpanan: server (login Google via Supabase) atau localStorage (tamu) ---------- */
var CFG={api:false,auth:false};
var sb=null; /* klien supabase-js; sesi/token dikelola supabase-js sendiri */
var store={mode:'tamu',uid:null,name:'',avatar:'',progress:null};
var LS='kandela-progress-v1', LS_ASKED='kandela-import-asked';
function blank(){return {xp:0,streak:0,lastDay:null,attempts:[]};}
function lsLoad(){try{var s=localStorage.getItem(LS);return s?JSON.parse(s):null;}catch(e){return null;}}
function lsSave(p){try{localStorage.setItem(LS,JSON.stringify(p));}catch(e){}}
function lsClear(){try{localStorage.removeItem(LS);localStorage.removeItem(LS_ASKED);}catch(e){}}
function dayStr(){try{return new Date().toLocaleDateString('sv-SE');}catch(e){return new Date().toISOString().slice(0,10);}}
async function authHeader(){
  if(!sb)return {};
  try{var ss=(await sb.auth.getSession()).data.session;return ss?{Authorization:'Bearer '+ss.access_token}:{};}catch(e){return {};}
}
async function api(path,opt){
  opt=opt||{};
  var h=Object.assign({'Content-Type':'application/json'},await authHeader());
  var r=await fetch(path,{method:opt.method||'GET',headers:h,body:opt.body?JSON.stringify(opt.body):undefined});
  var j=null;try{j=await r.json();}catch(e){}
  return {ok:r.ok,status:r.status,data:j||{}};
}
async function loadConfig(){
  try{var r=await fetch('/api/config');if(r.ok){CFG=await r.json();CFG.api=true;}}catch(e){}
  if(CFG.auth&&window.supabase&&window.supabase.createClient){
    try{sb=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});}catch(e){sb=null;}
  }
}
function fromServer(d){
  return {xp:d.xp||0,streak:d.streak||0,lastDay:d.last_day||null,imported:!!d.imported,
    attempts:(d.attempts||[]).map(function(a,i){return {id:i+1,t:a.t,dir:a.dir,sl:a.sl,tp:a.tp,risk:a.risk,total:a.total,disc:a.disc,rrS:a.rrS,tech:a.tech,R:a.R};})};
}
async function syncSession(){
  var ss=null;
  if(sb){try{ss=(await sb.auth.getSession()).data.session;}catch(e){}}
  if(!ss){store.mode='tamu';store.uid=null;store.name='';store.avatar='';store.progress=lsLoad()||blank();return;}
  var u=ss.user, m=u.user_metadata||{};
  store.mode='akun';store.uid=u.id;store.name=m.full_name||m.name||'';store.avatar=m.avatar_url||m.picture||'';
  var r=await api('/api/progress');
  if(r.ok){store.progress=fromServer(r.data);await offerImport();}
  else{store.progress=blank();toast(r.data.detail||'Progres server belum bisa dimuat.');}
}
/* Progres tamu ditawarkan untuk diimpor SEKALI, dengan konfirmasi, lalu localStorage dibersihkan. */
async function offerImport(){
  var g=lsLoad(), asked=false;
  try{asked=localStorage.getItem(LS_ASKED)===store.uid;}catch(e){}
  if(!g||!g.attempts||!g.attempts.length||store.progress.imported||asked)return;
  var yes=window.confirm('Ada progres mode tamu di browser ini ('+g.attempts.length+' latihan, '+g.xp+' XP). Impor XP dan streak-nya ke akunmu?\n\nRiwayat latihan tamu tidak masuk papan skor. Tawaran ini hanya muncul sekali.');
  try{localStorage.setItem(LS_ASKED,store.uid);}catch(e){}
  if(!yes)return;
  var r=await api('/api/progress',{method:'POST',body:{action:'import',xp:g.xp,streak:g.streak}});
  if(r.ok){store.progress=fromServer(r.data);lsClear();toast('Progres tamu berhasil diimpor.');}
  else toast(r.data.detail||'Impor gagal.');
}
function stats(){
  var a=store.progress.attempts, n=a.length;
  var avg=n?Math.round(a.reduce(function(s,x){return s+x.total;},0)/n):0;
  var comp=n?Math.round(a.filter(function(x){return x.risk<=2;}).length/n*100):0;
  var tr=a.filter(function(x){return x.dir!=='tahan';});
  var win=tr.length?Math.round(tr.filter(function(x){return x.R>0;}).length/tr.length*100):0;
  var avgR=tr.length?tr.reduce(function(s,x){return s+x.R;},0)/tr.length:0;
  return {n:n,avg:avg,comp:comp,win:win,avgR:avgR,lvl:1+Math.floor(store.progress.xp/LVL)};
}

/* ---------- UI helpers ---------- */
var toastT=null;
function toast(t){var el=$('#toast');el.textContent=t;el.classList.add('on');clearTimeout(toastT);toastT=setTimeout(function(){el.classList.remove('on');},2800);}
function countTo(el,to,fmtFn){
  var from=el._v||0; el._v=to; fmtFn=fmtFn||function(v){return String(Math.round(v));};
  if(!hasG||RM){el.textContent=fmtFn(to);return;}
  var o={v:from};G.to(o,{v:to,duration:1,ease:'power2.out',onUpdate:function(){el.textContent=fmtFn(o.v);}});
}
function ringSet(p){$('#ringFg').style.strokeDashoffset=String(276.5*(1-clamp(p,0,100)/100));}
function semantic(score){return score>=75?'var(--up)':(score>=50?'#9A6A00':'var(--down)');}

/* ---------- chart ---------- */
var CH={W:640,H:310,pl:8,pr:58,top:12,pb:78,vTop:240,vH:62};
var SC=null, AN=null, EV=null, DEC_IN=null, CS={y0:0,y1:1,upto:DEC}, cEls=[], showMA=true, decided=false, curDir='beli', gridEls=[], lnEls={}, maEl=null, mk=null;
var upC='#1FA97A', dnC='#E5586E';
function xAt(i){var step=(CH.W-CH.pl-CH.pr)/N;return CH.pl+i*step+step/2;}
function pyAt(p){return CH.top+(CS.y1-p)/(CS.y1-CS.y0)*(CH.H-CH.top-CH.pb);}
function buildChart(){
  var c=SC.candles, step=(CH.W-CH.pl-CH.pr)/N, bw=Math.max(3,step*0.58), i;
  var lo=Infinity,hi=-Infinity;
  for(i=0;i<DEC;i++){lo=Math.min(lo,c[i].l);hi=Math.max(hi,c[i].h);}
  var pad=(hi-lo)*0.28; CS.y0=lo-pad; CS.y1=hi+pad; CS.upto=DEC;
  var vmax=0;for(i=0;i<DEC;i++)vmax=Math.max(vmax,c[i].v);vmax*=1.25;
  var h='<svg viewBox="0 0 '+CH.W+' '+CH.H+'" role="img" aria-label="Grafik candlestick simulasi. '+DEC+' candle terlihat, sisanya tersembunyi sampai keputusan dikirim.">';
  h+='<g id="grid">';for(i=0;i<4;i++)h+='<line x1="0" x2="'+(CH.W-CH.pr)+'" stroke="#E4E1F5" stroke-width="1"/><text x="'+(CH.W-CH.pr+6)+'" font-size="11" font-weight="600" fill="#5B5880"></text>';h+='</g>';
  h+='<g id="cds">';
  for(i=0;i<N;i++){h+='<g class="cd"><rect class="vl" fill="#CFC9F3" rx="1" width="'+bw+'"/><line class="wk" stroke-width="1.5"/><rect class="bd" rx="1" width="'+bw+'"/></g>';}
  h+='</g><polyline id="ma" fill="none" stroke="#6D5CE8" stroke-width="2" stroke-linejoin="round"/>';
  h+='<line id="decl" stroke="#4338CA" stroke-width="1" stroke-dasharray="4 4"/><text id="decT" font-size="11" font-weight="700" fill="#4338CA">Keputusan</text>';
  h+='<g id="lns"></g><g id="mk"></g></svg>';
  $('#chart').innerHTML=h;
  var gs=$$('#grid line'), gt=$$('#grid text'); gridEls=gs.map(function(l,k){return {l:l,t:gt[k]};});
  cEls=$$('#cds .cd').map(function(g,k){return {g:g,vl:$('.vl',g),wk:$('.wk',g),bd:$('.bd',g),bw:bw,vmax:vmax};});
  maEl=$('#ma'); mk=$('#mk'); lnEls={};
  draw();
}
function draw(){
  var c=SC.candles, i, H=CH.H-CH.top-CH.pb;
  for(i=0;i<N;i++){
    if(i>=c.length){cEls[i].g.setAttribute('opacity',0);continue;}
    var k=c[i], e=cEls[i], x=xAt(i), up=k.c>=k.o, col=up?upC:dnC, op=clamp(CS.upto-i,0,1);
    e.g.setAttribute('opacity',op);
    e.wk.setAttribute('x1',x);e.wk.setAttribute('x2',x);e.wk.setAttribute('y1',pyAt(k.h));e.wk.setAttribute('y2',pyAt(k.l));e.wk.setAttribute('stroke',col);
    var yt=pyAt(Math.max(k.o,k.c)), yb=pyAt(Math.min(k.o,k.c));
    e.bd.setAttribute('x',x-e.bw/2);e.bd.setAttribute('y',yt);e.bd.setAttribute('height',Math.max(1.6,yb-yt));e.bd.setAttribute('fill',col);
    var vh=Math.min(CH.vH,k.v/e.vmax*CH.vH);
    e.vl.setAttribute('x',x-e.bw/2);e.vl.setAttribute('y',CH.vTop+CH.vH-vh);e.vl.setAttribute('height',vh);
  }
  gridEls.forEach(function(g,k){var p=CS.y0+(CS.y1-CS.y0)*(k+1)/5, y=pyAt(p);g.l.setAttribute('y1',y);g.l.setAttribute('y2',y);g.t.setAttribute('y',y+4);g.t.textContent=fmt(p);});
  var ma=SC.ma||(SC.ma=smaAll(c.map(function(x){return x.c;}),20)), pts=[];
  for(i=19;i<Math.ceil(CS.upto);i++){if(ma[i]!=null)pts.push(xAt(i)+','+pyAt(ma[i]));}
  maEl.setAttribute('points',pts.join(' '));maEl.style.display=showMA?'':'none';
  var dx=xAt(DEC-1)+bwHalf();$('#decl').setAttribute('x1',dx);$('#decl').setAttribute('x2',dx);$('#decl').setAttribute('y1',CH.top);$('#decl').setAttribute('y2',CH.vTop+CH.vH);
  $('#decT').setAttribute('x',dx-66);$('#decT').setAttribute('y',CH.top+10);
  for(var key in lnEls){var L=lnEls[key],yy=pyAt(L.p);L.l.setAttribute('y1',yy);L.l.setAttribute('y2',yy);L.t.setAttribute('y',yy-5);}
}
function bwHalf(){return (CH.W-CH.pl-CH.pr)/N*0.5;}
function addLine(key,price,color,label,dash){
  var g=$('#lns'), l=document.createElementNS('http://www.w3.org/2000/svg','line'), t=document.createElementNS('http://www.w3.org/2000/svg','text');
  l.setAttribute('x1',xAt(DEC-1));l.setAttribute('x2',CH.W-CH.pr);l.setAttribute('stroke',color);l.setAttribute('stroke-width','1.6');if(dash)l.setAttribute('stroke-dasharray','6 4');
  t.setAttribute('x',CH.W-CH.pr-4);t.setAttribute('text-anchor','end');t.setAttribute('font-size','11');t.setAttribute('font-weight','800');t.setAttribute('fill',color);t.textContent=label;
  g.appendChild(l);g.appendChild(t);lnEls[key]={l:l,t:t,p:price};
  if(hasG&&!RM)G.from([l,t],{opacity:0,duration:.5});
}
function addMarker(ev){
  if(ev.status!=='tp'&&ev.status!=='sl')return;
  var k=SC.candles[ev.exit], x=xAt(ev.exit), y=pyAt(ev.status==='tp'?ev.tpP:ev.slP), col=ev.status==='tp'?upC:dnC;
  var ns='http://www.w3.org/2000/svg', g=document.createElementNS(ns,'g'), ci=document.createElementNS(ns,'circle'), tx=document.createElementNS(ns,'text');
  ci.setAttribute('cx',x);ci.setAttribute('cy',y);ci.setAttribute('r','7');ci.setAttribute('fill',col);ci.setAttribute('stroke','#fff');ci.setAttribute('stroke-width','2');
  tx.setAttribute('x',x);tx.setAttribute('y',y-14);tx.setAttribute('text-anchor','middle');tx.setAttribute('font-size','11');tx.setAttribute('font-weight','800');tx.setAttribute('fill',col);tx.textContent=ev.status==='tp'?'Target kena':'SL kena';
  g.appendChild(ci);g.appendChild(tx);mk.appendChild(g);
  if(hasG&&!RM)G.from(g,{scale:0,transformOrigin:x+'px '+y+'px',duration:.5,ease:'back.out(2)'});
}
function chips(){
  var a=AN, h='';
  h+='<span class="tag">RSI '+Math.round(a.rsi)+'</span>';
  h+='<span class="tag '+(a.histPos?'up':'down')+'">MACD '+(a.histPos?'naik':'turun')+'</span>';
  h+='<span class="tag '+(a.above?'up':'down')+'">Harga '+(a.above?'di atas':'di bawah')+' MA20</span>';
  h+='<span class="tag '+(a.rising?'up':'down')+'">MA20 '+(a.rising?'naik':'turun')+'</span>';
  h+='<button class="chip is-click" id="maBtn" type="button" aria-pressed="'+showMA+'" style="margin-left:auto">Garis MA20</button>';
  $('#chips').innerHTML=h;
  $('#maBtn').addEventListener('click',function(){showMA=!showMA;this.setAttribute('aria-pressed',String(showMA));draw();});
}
function sentUI(){
  var s=SC.sentiment;
  $('#gaugeDot').style.left=s+'%';
  $('#sentLbl').textContent='Skor '+s+' · '+(s>=58?'cenderung positif':(s<=42?'cenderung negatif':'netral'));
  $('#sentLbl').style.color=s>=58?'var(--up)':(s<=42?'var(--down)':'var(--muted)');
  $('#hls').innerHTML=SC.headlines.map(function(h){return '<div class="hl"><span>'+h.t+'</span><span class="tag '+(h.v>0?'up':(h.v<0?'down':''))+'">'+(h.v>0?'+':'')+String(h.v.toFixed(1)).replace('.',',')+'</span></div>';}).join('');
}
function calcUI(){
  var sl=+$('#slSL').value, tp=+$('#slTP').value, rk=+$('#slRK').value;
  $('#vSL').textContent=f1(sl)+'%';$('#vTP').textContent=f1(tp)+'%';$('#vRK').textContent=f1(rk)+'%';
  var tahan=curDir==='tahan';
  ['slSL','slTP','slRK'].forEach(function(id){$('#'+id).disabled=tahan||decided;});
  if(tahan){$('#calc').textContent='Kamu memilih menahan. Tidak ada transaksi, jadi tidak ada risiko yang dihitung.';return;}
  var entry=SC.candles[DEC-1].c, ds=curDir==='beli'?1:-1;
  $('#calc').innerHTML='Risk : reward 1 : '+f1(tp/sl)+'<br>Risiko '+rp(CAPITAL*rk/100)+' dari modal virtual '+rp(CAPITAL)+'<br>Entry '+fmt(entry)+' · SL '+fmt(entry*(1-ds*sl/100))+' · Target '+fmt(entry*(1+ds*tp/100));
}
var TOKEN=null, scnBusy=false;
function chartMsg(t){var d=document.createElement('div');d.className='empty';d.textContent=t;$('#chart').innerHTML='';$('#chart').appendChild(d);$('#chips').innerHTML='';}
async function newScenario(){
  if(scnBusy)return;scnBusy=true;
  $('#submit').disabled=true;$('#submit').textContent='Memuat skenario...';
  try{
    var r=await api('/api/scenario');
    if(!r.ok)throw new Error(r.data.detail||('HTTP '+r.status));
    var d=r.data;TOKEN=d.token;
    SC={candles:d.candles,sentiment:d.sentiment,headlines:d.headlines};AN=d.analysis;EV=null;decided=false;
    $('#scTitle').textContent='Skenario #'+(store.progress.attempts.length+1+(store.progress.offset||0));
    buildChart();chips();sentUI();calcUI();
    $('#resultBar').hidden=true;$('#submit').disabled=false;$('#submit').textContent='Kirim keputusan';
    $$('.seg button').forEach(function(b){b.disabled=false;});
  }catch(e){
    TOKEN=null;chartMsg('Skenario belum bisa dimuat dari server ('+e.message+'). Jalankan lewat "npm run dev" atau "vercel dev", lalu tekan Skenario baru.');
    $('#submit').textContent='Server belum tersambung';
  }finally{scnBusy=false;}
}
function reveal(ev,dec){
  return new Promise(function(res){
    var i,lo=Infinity,hi=-Infinity;
    for(i=0;i<N;i++){lo=Math.min(lo,SC.candles[i].l);hi=Math.max(hi,SC.candles[i].h);}
    if(ev.slP!=null){lo=Math.min(lo,ev.slP,ev.tpP);hi=Math.max(hi,ev.slP,ev.tpP);}
    var pad=(hi-lo)*0.08, t0=lo-pad, t1=hi+pad, end=ev.status==='tahan'?N:ev.exit+1;
    if(ev.ds!==0){addLine('entry',ev.entry,'#4338CA','Entry',false);addLine('sl',ev.slP,'#C93A55','SL',true);addLine('tp',ev.tpP,'#0F8F68','Target',true);}
    if(!hasG||RM){CS.y0=t0;CS.y1=t1;CS.upto=end;draw();addMarker(ev);res();return;}
    var tl=G.timeline({onComplete:function(){addMarker(ev);res();}});
    tl.to(CS,{y0:t0,y1:t1,duration:.9,ease:'power2.inOut',onUpdate:draw},0)
      .to(CS,{upto:end,duration:Math.max(1.6,(end-DEC)*0.16),ease:'none',onUpdate:draw},0.4);
  });
}

/* ---------- mentor ---------- */
function addMsg(kind,text,cites){
  var box=$('#msgs'), m=document.createElement('div'), p;
  m.className='msg '+kind;
  if(kind==='ai'){m.innerHTML='<div class="ava"><svg width="26" height="26" aria-hidden="true"><use href="#mini"/></svg></div><div class="bub"><p></p><div class="cites"></div></div>';}
  else{m.innerHTML='<div class="bub"><p></p></div>';}
  p=$('p',m);p.textContent=text;
  if(cites&&kind==='ai'){var cb=$('.cites',m);cites.forEach(function(c){var s=document.createElement('span');s.className='tag';s.textContent='Sumber: '+c.title+', hal. '+c.page;cb.appendChild(s);});}
  box.appendChild(m);box.scrollTop=box.scrollHeight;
  if(hasG&&!RM)G.from(m,{y:14,opacity:0,duration:.4,ease:'power2.out',clearProps:'opacity,transform'});
  return {el:m,text:p,cites:$('.cites',m)};
}
function lastSummary(){
  var a=store.progress.attempts, x=a[a.length-1];
  if(!x)return 'Belum ada latihan.';
  return 'Latihan terakhir: arah '+x.dir+', stop loss '+x.sl+'%, target '+x.tp+'%, risiko modal '+x.risk+'%, skor '+x.total+' (disiplin '+x.disc+', risk-reward '+x.rrS+', teknikal '+x.tech+'), hasil '+x.R+'R.';
}
async function ask(q){
  addMsg('me',q);
  if(CFG.api){
    var b0=addMsg('ai','Sumbu sedang mikir...',null);
    try{
      var rr=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q,context:lastSummary()})});
      var jj={};try{jj=await rr.json();}catch(e){}
      if(rr.status===429){b0.text.textContent=jj.detail||'Terlalu banyak permintaan, coba lagi sebentar.';return;}
      if(!rr.ok)throw new Error(jj.detail||('HTTP '+rr.status));
      b0.text.textContent=jj.answer;
      (jj.sources||[]).forEach(function(c){var t=document.createElement('span');t.className='tag';t.textContent='Sumber: '+c.title+', hal. '+c.page;b0.cites.appendChild(t);});
      return;
    }catch(e){b0.text.textContent=(e.message||'Sumbu lagi tidak bisa menjawab.')+' Sementara kujawab dari materi bawaan halaman.';}
  }
  var hits=retrieve(q,2);
  var b=addMsg('ai','',hits);
  b.text.textContent='Dari materi: '+hits[0].text;
}

/* ---------- progres UI ---------- */
function renderMods(){
  var lvl=stats().lvl, h='';
  KB.forEach(function(m){
    if(lvl>=m.req){h+='<button class="card click mod reveal-m" type="button" data-id="'+m.id+'"><h3>'+m.title+'</h3><p>'+m.text.split('. ')[0]+'.</p><span class="lv">Buka materi · hal. '+m.page+'</span></button>';}
    else{h+='<div class="card static mod locked reveal-m"><h3>'+m.title+'</h3><p>Naik ke level '+m.req+' untuk membuka modul ini.</p><span class="lv">Terkunci</span></div>';}
  });
  $('#mods').innerHTML=h;
  $$('#mods .card.click').forEach(function(b){bindTilt(b);b.addEventListener('click',function(){openModal(b.getAttribute('data-id'));});});
  $$('#mods .card.static').forEach(function(c){c.classList.add('in');});
}
function barsChart(){
  var a=store.progress.attempts.slice(-7), el=$('#barsChart');
  if(!a.length){el.innerHTML='<div class="empty">Belum ada latihan. Kirim keputusan pertamamu di bagian Latih.</div>';return;}
  var W=360,H=170,bw=34,gap=(W-a.length*bw)/(a.length+1),h='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Skor '+a.length+' latihan terakhir" style="width:100%;height:auto;display:block"><line x1="0" x2="'+W+'" y1="140" y2="140" stroke="#E4E1F5"/>';
  a.forEach(function(x,i){var bh=x.total/100*120,bx=gap+i*(bw+gap);h+='<rect x="'+bx+'" y="'+(140-bh)+'" width="'+bw+'" height="'+bh+'" rx="9" fill="'+(i===a.length-1?'#4338CA':'#B6A9F6')+'"/><text x="'+(bx+bw/2)+'" y="'+(140-bh-6)+'" text-anchor="middle" font-size="12" font-weight="700" fill="#1E1B4B">'+x.total+'</text><text x="'+(bx+bw/2)+'" y="158" text-anchor="middle" font-size="11" fill="#5B5880">#'+x.id+'</text>';});
  el.innerHTML=h+'</svg>';
}
function histList(){
  var a=store.progress.attempts.slice(-5).reverse(), el=$('#hist');
  if(!a.length){el.innerHTML='<div class="empty">Riwayat muncul setelah latihan pertamamu.</div>';return;}
  el.innerHTML=a.map(function(x){return '<div class="rowx"><span>#'+x.id+' · '+x.dir.charAt(0).toUpperCase()+x.dir.slice(1)+' · skor '+x.total+'</span><b style="color:'+(x.dir==='tahan'?'var(--muted)':(x.R>0?'var(--up)':'var(--down)'))+'">'+(x.dir==='tahan'?'tahan':(x.R>0?'+':'')+f1(x.R)+'R')+'</b></div>';}).join('');
}
function refreshStats(fromZero){
  var s=stats(), xp=store.progress.xp;
  if(fromZero){['stLvl','stStreak','stAvg','stComp','stWin','stR'].forEach(function(id){$('#'+id)._v=0;});}
  countTo($('#stLvl'),s.lvl);countTo($('#stStreak'),store.progress.streak);countTo($('#stAvg'),s.avg);
  countTo($('#stComp'),s.comp,function(v){return Math.round(v)+'%';});countTo($('#stWin'),s.win,function(v){return Math.round(v)+'%';});
  countTo($('#stR'),s.avgR,function(v){return (v>0?'+':'')+f1(v)+'R';});
  $('#stXp').textContent=xp+' XP · '+(LVL-(xp%LVL))+' XP lagi ke level '+(s.lvl+1);
  $('#stN').textContent=s.n+' latihan';
  $('#xpBar').style.width=((xp%LVL)/LVL*100)+'%';
  barsChart();histList();renderMods();
}
async function boardUI(){
  var el=$('#board');
  var note=function(t){var d=document.createElement('div');d.className='empty';d.textContent=t;return d;};
  if(!CFG.auth){el.innerHTML='';el.appendChild(note('Papan skor aktif setelah login Google dikonfigurasi di server.'));return;}
  var r;try{r=await api('/api/leaderboard');}catch(e){r={ok:false,data:{}};}
  el.innerHTML='';
  if(!r.ok){el.appendChild(note('Papan skor belum bisa dimuat sekarang.'));return;}
  var rows=r.data.rows||[];
  if(!rows.length)el.appendChild(note('Belum ada yang tercatat. Masuk dengan Google dan selesaikan minimal 3 latihan untuk muncul di sini.'));
  rows.forEach(function(x,i){
    var row=document.createElement('div');row.className='rowx';
    var a=document.createElement('span');a.textContent=(i+1)+'. '+(x.display_name||'Pemain')+' · level '+(x.level||1);
    var b=document.createElement('b');b.textContent=String(x.avg_score||0);
    row.appendChild(a);row.appendChild(b);el.appendChild(row);
  });
  if(store.mode==='tamu'&&rows.length)el.appendChild(note('Mode tamu tidak masuk papan skor. Masuk dengan Google untuk ikut.'));
}
function whoUI(){
  var on=store.mode==='akun';
  $('#who').classList.toggle('on',on);
  $('#whoT').textContent=on?(store.name||'Sudah masuk'):'Mode tamu';
  var img=$('#whoImg');
  if(on&&store.avatar){img.src=store.avatar;img.hidden=false;}else{img.hidden=true;img.removeAttribute('src');}
  $('#statusT').textContent=on?('Masuk sebagai '+(store.name||'pengguna Google')+'. Progresmu tersimpan di server dan ikut papan skor.')
    :(CFG.auth?'Mode tamu: progresmu tersimpan di browser ini saja dan tidak masuk papan skor.':'Mode tamu: progresmu tersimpan di browser ini saja.');
  $('#loginBtn').hidden=on||!CFG.auth;
  $('#logoutBtn').hidden=!on;
  $('#acctCard').hidden=!on;
}
function mentorUI(dec,ev,ex){
  var ids=[['rbD','barD',ev.disc],['rbRR','barRR',ev.rrS],['rbT','barT',ev.tech]];
  ids.forEach(function(x){$('#'+x[0]).textContent=(dec.dir==='tahan'&&x[0]==='rbRR')?'tidak berlaku':x[2];$('#'+x[1]).style.width=(dec.dir==='tahan'&&x[0]==='rbRR'?0:x[2])+'%';});
  ringSet(ev.total);countTo($('#ringT'),ev.total);$('#ringT').style.color=semantic(ev.total);
  var tags='<span class="tag '+(dec.risk<=2||dec.dir==='tahan'?'up':'down')+'">'+(dec.dir==='tahan'?'Tanpa transaksi':(dec.risk<=2?'Dalam batas risiko':'Melewati batas risiko'))+'</span>';
  if(dec.dir!=='tahan')tags+='<span class="tag '+(ev.R>0?'up':'down')+'">'+(ev.status==='tp'?'Target kena':(ev.status==='sl'?'Stop loss kena':'Ditutup di akhir'))+' · '+(ev.R>0?'+':'')+f1(ev.R)+'R</span>';
  $('#rubTags').innerHTML=tags;
  addMsg('ai',ex.text,ex.cites);
}
function mood(name){
  if(!hasG||RM)return;
  var pup=$$('#sumbu .pupil'),lids=$$('#sumbu .lid');
  if(name==='happy'){G.to(lids,{scaleY:.5,duration:.2});G.to('#sbMouth',{scale:1.1,transformOrigin:'50% 50%',duration:.3,ease:'back.out(2)'});G.to('#sbOrb',{scale:1.6,transformOrigin:'50% 50%',duration:.25,yoyo:true,repeat:3});}
  else if(name==='shock'){G.to(pup,{scale:.55,transformOrigin:'50% 50%',duration:.15});G.to(lids,{scaleY:0,duration:.1});G.to('#sbMouth',{scaleY:1.6,transformOrigin:'50% 30%',duration:.2,ease:'back.out(3)'});G.to('#sbAll',{x:6,duration:.05,yoyo:true,repeat:5});}
  G.to([pup,lids,'#sbMouth'],{delay:1.6,duration:.5,overwrite:false,onStart:function(){G.to(pup,{scale:1,duration:.4});G.to(lids,{scaleY:0,duration:.4});G.to('#sbMouth',{scale:1,scaleY:1,duration:.4});}});
}
var peekT=null;
function peek(msg){
  var b=$('#peekBub');b.textContent=msg;b.hidden=false;
  if(hasG&&!RM){G.fromTo(b,{y:10,opacity:0},{y:0,opacity:1,duration:.35});G.fromTo('.peek-btn',{y:0},{y:-12,duration:.18,yoyo:true,repeat:3,ease:'power1.out'});}
  clearTimeout(peekT);peekT=setTimeout(function(){b.hidden=true;},4200);
}
function say(t){var s=$('#speech');if(!hasG||RM){s.textContent=t;return;}G.to(s,{opacity:0,y:6,duration:.2,onComplete:function(){s.textContent=t;G.to(s,{opacity:1,y:0,duration:.3});}});}

async function onSubmit(){
  if(decided||!TOKEN)return; decided=true;
  var dec={dir:curDir,sl:+$('#slSL').value,tp:+$('#slTP').value,risk:+$('#slRK').value};
  DEC_IN=dec;
  $('#submit').disabled=true;$('#submit').textContent='Menilai keputusan...';
  $$('.seg button').forEach(function(b){b.disabled=true;});calcUI();
  var r;
  try{r=await api('/api/submit',{method:'POST',body:{token:TOKEN,dir:dec.dir,sl:dec.sl,tp:dec.tp,risk:dec.risk}});}
  catch(e){r={ok:false,status:0,data:{detail:'Tidak bisa menghubungi server.'}};}
  if(!r.ok){
    toast(r.data.detail||'Keputusan belum bisa dinilai.');
    if(r.status===400||r.status===409||r.status===410){TOKEN=null;setTimeout(newScenario,900);return;}
    decided=false;$('#submit').disabled=false;$('#submit').textContent='Kirim keputusan';
    $$('.seg button').forEach(function(b){b.disabled=false;});calcUI();return;
  }
  TOKEN=null;
  var d=r.data;EV=d;
  SC.candles=SC.candles.concat(d.futureCandles);SC.ma=null;
  $('#submit').textContent='Menjalankan harga...';
  await reveal(EV,dec);
  var P=store.progress, prevLvl=stats().lvl, xpGain=d.xpGain;
  if(store.mode==='akun'&&d.progress){P.xp=d.progress.xp;P.streak=d.progress.streak;P.lastDay=d.progress.last_day;}
  else{
    var today=dayStr();
    if(P.lastDay!==today){var y=new Date();y.setDate(y.getDate()-1);var ys;try{ys=y.toLocaleDateString('sv-SE');}catch(e){ys='';}P.streak=(P.lastDay===ys)?P.streak+1:1;P.lastDay=today;}
    P.xp+=xpGain;
  }
  P.attempts.push({id:P.attempts.length+1+(P.offset||0),t:Date.now(),dir:dec.dir,sl:dec.sl,tp:dec.tp,risk:dec.risk,total:EV.total,disc:EV.disc,rrS:EV.rrS,tech:EV.tech,R:EV.R});
  if(P.attempts.length>40){P.attempts.shift();P.offset=(P.offset||0)+1;}
  var rb=$('#resultBar');rb.hidden=false;
  countTo($('#rbScore'),EV.total);$('#rbScore').style.color=semantic(EV.total);
  $('#rbR').textContent=dec.dir==='tahan'?'-':((EV.R>0?'+':'')+f1(EV.R)+'R');$('#rbR').style.color=EV.R>0?'var(--up)':(EV.R<0?'var(--down)':'var(--ink)');
  $('#rbRp').textContent=dec.dir==='tahan'?'Tidak ada transaksi':(rp(CAPITAL*dec.risk/100*EV.R)+' pada modal virtual');
  if(hasG&&!RM)G.from(rb,{y:30,opacity:0,duration:.6,ease:'power3.out',clearProps:'opacity,transform'});
  var ex=d.explanation||{text:'',cites:[]};
  mentorUI(dec,EV,{text:ex.text,cites:(ex.cites||[]).map(kbById).filter(Boolean)});
  refreshStats(false);
  var lvl=stats().lvl;
  toast('+'+xpGain+' XP'+(lvl>prevLvl?' · Naik ke level '+lvl+'! Modul baru terbuka':'')+(store.mode==='tamu'?' (mode tamu)':''));
  if(EV.total>=75){mood('happy');say('Prosesmu rapi. Sumbuku menyala terang.');peek('Rapi! Skor '+EV.total+'. Lihat penjelasanku.');}
  else if(EV.total<50){mood('shock');say('Hih! Risikomu bikin lilinku meleleh.');peek('Aduh. Skor '+EV.total+'. Yuk bedah bareng.');}
  else{say('Lumayan. Masih ada yang bisa dirapikan.');peek('Skor '+EV.total+'. Ada yang bisa diperbaiki.');}
  $('#submit').textContent='Sudah dikirim';
  if(store.mode==='tamu')lsSave(P);
  boardUI();
}

/* ---------- modal ---------- */
var lastFocus=null;
function openModal(id){
  var m=kbById(id);if(!m)return;lastFocus=document.activeElement;
  $('#mPage').textContent='Hal. '+m.page;$('#mTitle').textContent=m.title;$('#mText').textContent=m.text;$('#modal').hidden=false;
  if(hasG&&!RM)G.from('#mbox',{scale:.92,y:20,opacity:0,duration:.35,ease:'back.out(1.6)'});
  $('#mClose').focus();
}
function closeModal(){$('#modal').hidden=true;if(lastFocus)lastFocus.focus();}

/* ---------- gerak ---------- */
var lenis=null;
function goto(sel){
  var el=$(sel);if(!el)return;
  if(lenis)lenis.scrollTo(el,{offset:-84,duration:1.2});else el.scrollIntoView({behavior:RM?'auto':'smooth',block:'start'});
}
function bindTilt(el){
  if(!hasG||RM)return;
  el.addEventListener('pointermove',function(e){if(e.pointerType!=='mouse')return;var r=el.getBoundingClientRect(),px=(e.clientX-r.left)/r.width-.5,py=(e.clientY-r.top)/r.height-.5;G.to(el,{rotationY:px*8,rotationX:-py*8,y:-3,transformPerspective:800,duration:.3,ease:'power2.out',overwrite:'auto'});});
  el.addEventListener('pointerleave',function(){G.to(el,{rotationX:0,rotationY:0,y:0,duration:.45,ease:'power3.out',overwrite:'auto'});});
  el.addEventListener('pointerdown',function(){G.to(el,{y:3,duration:.08,overwrite:'auto'});});
  el.addEventListener('pointerup',function(){G.to(el,{y:-3,duration:.15,overwrite:'auto'});});
}
function splitWords(el){
  var words=el.textContent.trim().split(/\s+/);
  el.setAttribute('aria-label',el.textContent.trim());
  el.innerHTML=words.map(function(w){return '<span class="wm" aria-hidden="true"><span class="w">'+w+'</span></span>';}).join(' ');
}
function buildHeroDecor(){
  var far=$('#layerFar'),near=$('#layerNear'),rnd=rng(77),i;
  function candles(count,op,sc){
    var h='<svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" style="opacity:'+op+'">';
    for(i=0;i<count;i++){var x=40+i*(1120/count)+rnd()*20,y=120+rnd()*420,bh=30+rnd()*90*sc,wk=14+rnd()*40,up=rnd()>0.45,col=up?'#7BE0B8':'#FF8FA3';
      h+='<line x1="'+x+'" x2="'+x+'" y1="'+(y-wk)+'" y2="'+(y+bh+wk)+'" stroke="'+col+'" stroke-width="2.4"/><rect x="'+(x-9*sc)+'" y="'+y+'" width="'+(18*sc)+'" height="'+bh+'" rx="3" fill="'+col+'"/>';}
    return h+'</svg>';
  }
  far.innerHTML=candles(22,.14,.7);near.innerHTML=candles(12,.22,1.1);
  var stars='';for(i=0;i<26;i++)stars+='<span class="star" style="left:'+(rnd()*100)+'%;top:'+(rnd()*70)+'%;width:'+(2+rnd()*2)+'px;height:'+(2+rnd()*2)+'px"></span>';
  far.insertAdjacentHTML('beforeend',stars);
}
function initMotion(){
  if(!hasG||RM)return;
  G.registerPlugin(ScrollTrigger);
  if(window.Lenis){try{lenis=new window.Lenis({lerp:0.1,smoothWheel:true});lenis.on('scroll',ScrollTrigger.update);G.ticker.add(function(t){lenis.raf(t*1000);});G.ticker.lagSmoothing(0);}catch(e){lenis=null;}}
  G.to('#pbar',{scaleX:1,ease:'none',scrollTrigger:{trigger:document.body,start:'top top',end:'bottom bottom',scrub:0.3}});

  /* sekuens pembuka */
  var tl=G.timeline({defaults:{ease:'power3.out',duration:.7}});
  tl.from('.nav',{y:-70,opacity:0,duration:.6})
    .from('.tagline',{y:16,opacity:0},'-=.3')
    .from('#h1 .w',{yPercent:115,opacity:0,stagger:.07,duration:.8},'-=.4')
    .from('.lead',{y:20,opacity:0},'-=.5')
    .from('.cta > *',{y:22,opacity:0,stagger:.08},'-=.5')
    .from('.hero-stats li',{y:20,opacity:0,stagger:.08},'-=.5')
    .from('#mascotBtn',{scale:.7,rotation:-6,transformOrigin:'50% 100%',opacity:0,duration:1.1,ease:'back.out(1.6)'},.35)
    .from('#speech',{opacity:0,y:10},'-=.3');

  /* ambient maskot */
  G.set($$('#sumbu .lid'),{scaleY:0,transformOrigin:'50% 0%'});
  G.to('#sbHalo',{scale:1.3,opacity:.65,transformOrigin:'50% 50%',duration:1.4,yoyo:true,repeat:-1,ease:'sine.inOut'});
  G.to('#sbAll',{y:-10,duration:2.3,yoyo:true,repeat:-1,ease:'sine.inOut'});
  G.to('#sbLure',{rotation:5,svgOrigin:'150 76',duration:1.9,yoyo:true,repeat:-1,ease:'sine.inOut'});
  (function blink(){G.delayedCall(2+Math.random()*3,function(){G.to($$('#sumbu .lid'),{scaleY:1,duration:.08,yoyo:true,repeat:1,onComplete:blink});});})();
  var pl=$$('#sumbu .pupil'),qx=pl.map(function(p){return G.quickTo(p,'x',{duration:.3,ease:'power2.out'});}),qy=pl.map(function(p){return G.quickTo(p,'y',{duration:.3,ease:'power2.out'});}),rafP=false;
  window.addEventListener('pointermove',function(e){
    if(rafP)return;rafP=true;requestAnimationFrame(function(){rafP=false;
      var r=$('#sumbu').getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height*.45,dx=e.clientX-cx,dy=e.clientY-cy,d=Math.hypot(dx,dy)||1,m=Math.min(1,d/260);
      pl.forEach(function(p,i){var lim=i===0?7:9;qx[i](dx/d*lim*m);qy[i](dy/d*lim*m);});
    });
  });

  /* parallax hero */
  $$('.layer').forEach(function(l){G.to(l,{yPercent:-parseFloat(l.dataset.speed),ease:'none',scrollTrigger:{trigger:'.hero',start:'top top',end:'bottom top',scrub:true}});});
  G.to('#mascotCol',{y:70,ease:'none',scrollTrigger:{trigger:'.hero',start:'top top',end:'bottom top',scrub:true}});
  G.to('#heroCopy',{y:-50,opacity:.35,ease:'none',scrollTrigger:{trigger:'.hero',start:'30% top',end:'bottom top',scrub:true}});

  /* judul bagian */
  $$('.sec-head h2').forEach(function(h){splitWords(h);G.from($$('.w',h),{yPercent:115,stagger:.05,duration:.7,ease:'power3.out',scrollTrigger:{trigger:h,start:'top 86%',once:true}});});
  $$('.sec-head p').forEach(function(p){G.from(p,{y:20,opacity:0,duration:.7,scrollTrigger:{trigger:p,start:'top 90%',once:true}});});

  /* kartu: sembunyikan dulu, muncul bertahap saat masuk layar */
  G.set('.reveal',{opacity:0,y:44});
  G.set('.step-card[data-from]',{x:50});
  ScrollTrigger.batch('.reveal',{start:'top 90%',once:true,onEnter:function(b){
    G.to(b,{opacity:1,y:0,x:0,duration:.8,ease:'power3.out',stagger:.09,overwrite:'auto',onComplete:function(){G.set(b,{clearProps:'opacity,transform'});}});
    b.forEach(function(el,i){setTimeout(function(){el.classList.add('in');},200+i*90);});
  }});
  /* garis langkah mengikuti scroll */
  G.to('#stepsFill',{scaleY:1,ease:'none',scrollTrigger:{trigger:'#steps',start:'top 70%',end:'bottom 70%',scrub:.6}});
  /* modul */
  ScrollTrigger.create({trigger:'#mods',start:'top 88%',once:true,onEnter:function(){G.from('#mods .mod',{y:40,opacity:0,stagger:.08,duration:.7,ease:'power3.out',clearProps:'opacity,transform'});}});
  /* angka statistik */
  ScrollTrigger.create({trigger:'#statGrid',start:'top 85%',once:true,onEnter:function(){refreshStats(true);}});
  /* chart */
  ScrollTrigger.create({trigger:'#chartCard',start:'top 80%',once:true,onEnter:function(){
    var gs=cEls.slice(0,DEC).map(function(e){return e.g;});
    G.from(gs,{scaleY:0,transformOrigin:'50% 100%',duration:.5,stagger:{each:.012},ease:'power3.out',clearProps:'transform'});
    G.from('#ma',{opacity:0,duration:.8,delay:.6});
  }});
  /* maskot kecil muncul setelah hero */
  ScrollTrigger.create({trigger:'#cara',start:'top 60%',onEnter:function(){$('#peek').classList.add('on');},onLeaveBack:function(){$('#peek').classList.remove('on');}});
  /* parallax dekorasi: gelap ke terang di bawah hero */
  G.to('.hero',{backgroundPositionY:'40%',ease:'none',scrollTrigger:{trigger:'.hero',start:'top top',end:'bottom top',scrub:true}});

  $$('.card.click').forEach(bindTilt);
  /* jaring pengaman: kartu yang sudah di layar tapi masih tersembunyi */
  setTimeout(function(){$$('.reveal').forEach(function(el){var r=el.getBoundingClientRect();if(r.top<window.innerHeight*1.1&&parseFloat(getComputedStyle(el).opacity)<0.05){G.to(el,{opacity:1,y:0,x:0,duration:.5,clearProps:'opacity,transform'});el.classList.add('in');}});},4500);
}

/* ---------- init ---------- */
async function start(){
  buildHeroDecor();
  var h1=$('#h1');splitWords(h1);
  store.progress=lsLoad()||blank();
  refreshStats(false);whoUI();
  addMsg('ai','Halo, aku Sumbu. Kirim satu keputusan di bagian Latih, nanti kubedah prosesmu dan kusebut materi yang dipakai.',null);
  initMotion();
  await loadConfig();
  if(sb)await syncSession();
  whoUI();refreshStats(false);boardUI();
  await newScenario();
  /* Vercel Web Analytics: skrip ~1 KB, tanpa cookie. Hanya di domain deploy. */
  if(!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)){var va=document.createElement('script');va.defer=true;va.src='/_vercel/insights/script.js';document.body.appendChild(va);}
}

/* ---------- event ---------- */
document.addEventListener('click',function(e){
  var a=e.target.closest('a[href^="#"]');if(!a)return;var hh=a.getAttribute('href');if(hh.length<2)return;e.preventDefault();goto(hh);
});
$('#loginBtn').addEventListener('click',async function(){
  if(!sb){toast('Login Google belum dikonfigurasi di server.');return;}
  var r=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}});
  if(r.error)toast('Gagal membuka login Google.');
});
$('#logoutBtn').addEventListener('click',async function(){
  if(sb){try{await sb.auth.signOut();}catch(e){}}
  await syncSession();whoUI();refreshStats(false);boardUI();toast('Kamu sudah keluar. Kembali ke mode tamu.');
});
function resetDel(){$('#delBtn').hidden=false;$('#delConfirm').hidden=true;$('#delCancel').hidden=true;$('#delConfirm').disabled=false;}
$('#delBtn').addEventListener('click',function(){
  $('#delBtn').hidden=true;$('#delConfirm').hidden=false;$('#delCancel').hidden=false;$('#delCancel').focus();
  toast('Langkah 2 dari 2: tekan "Ya, hapus permanen" kalau kamu yakin.');
});
$('#delCancel').addEventListener('click',function(){resetDel();$('#delBtn').focus();});
$('#delConfirm').addEventListener('click',async function(){
  this.disabled=true;
  var r=await api('/api/account',{method:'DELETE'});
  if(!r.ok){toast(r.data.detail||'Akun belum bisa dihapus.');this.disabled=false;return;}
  if(sb){try{await sb.auth.signOut({scope:'local'});}catch(e){}}
  lsClear();resetDel();await syncSession();whoUI();refreshStats(false);boardUI();
  toast('Akun dan seluruh datamu sudah dihapus.');
});
$('#newScn').addEventListener('click',newScenario);
$('#nextScn').addEventListener('click',function(){newScenario();goto('#latih');});
$$('.seg button').forEach(function(b){b.addEventListener('click',function(){
  if(decided)return;curDir=b.getAttribute('data-dir');
  $$('.seg button').forEach(function(x){x.setAttribute('aria-checked',String(x===b));});calcUI();
});});
['slSL','slTP','slRK'].forEach(function(id){$('#'+id).addEventListener('input',calcUI);});
$('#submit').addEventListener('click',onSubmit);
$('#chatForm').addEventListener('submit',function(e){e.preventDefault();var q=$('#q').value.trim();if(!q)return;$('#q').value='';ask(q);});
$$('#sugg .chip').forEach(function(b){b.addEventListener('click',function(){ask(b.textContent);});});
$('#mascotBtn').addEventListener('click',function(){
  var lines=['Hih! Jangan ngagetin.','Tanganmu hangat. Sumbuku suka.','Aku cuma mau kamu aman, kok.','Colek lagi, dan aku ikut ke mana-mana.'];
  say(lines[Math.floor(Math.random()*lines.length)]);mood('shock');
});
$('#mClose').addEventListener('click',closeModal);
$('#modal').addEventListener('click',function(e){if(e.target===this)closeModal();});
$('#mGo').addEventListener('click',function(){closeModal();goto('#latih');});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!$('#modal').hidden)closeModal();});
start();
})();
