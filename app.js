import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,signInWithPopup,GoogleAuthProvider,signOut,updateProfile} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {initializeFirestore,doc,setDoc,updateDoc,getDoc,arrayUnion,collection,onSnapshot,query,where,orderBy,limitToLast,addDoc,deleteDoc} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {firebaseConfig} from "./firebase-config.js";

const $=s=>document.querySelector(s);
const E=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const fmt=n=>n<1024?n+" B":n<1048576?(n/1024).toFixed(1)+" KB":(n/1048576).toFixed(1)+" MB";
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36);
const fb=initializeApp(firebaseConfig),auth=getAuth(fb),db=initializeFirestore(fb,{experimentalAutoDetectLongPolling:true});
let me=null,users={},files=[],folders=["Belum diunduh","Umum"],view="home",selId=null,curF="Semua",sends={},pcs={},asked={},mq=[],busy=false,tt,unsubs=[],hb,mode="in";
const CH=16384,ICE={iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:["turn:openrelay.metered.ca:80","turn:openrelay.metered.ca:443","turn:openrelay.metered.ca:443?transport=tcp"],username:"openrelayproject",credential:"openrelayproject"}]};
const toast=t=>{const e=$("#toast");e.textContent=t;e.classList.add("show");clearTimeout(tt);tt=setTimeout(()=>e.classList.remove("show"),3000)};
const fail=e=>toast("Database: "+((e&&e.code)||"error")+(e&&e.code==="permission-denied"?" - Publish Rules di Firestore":""));
const notify=t=>{try{navigator.vibrate&&navigator.vibrate(200);if(window.Notification&&Notification.permission==="granted"&&document.hidden)new Notification(t)}catch(e){}};
const nm=id=>(users[id]&&users[id].name)||"Pengguna";
const col=id=>"hsl("+([...id].reduce((a,c)=>a+c.charCodeAt(0),0)*47%360)+",85%,72%)";
const avatar=id=>{const a=E("div","av",nm(id).charAt(0).toUpperCase());a.style.background=col(id);return a};
const seen={};const isOn=id=>Date.now()-(seen[id]?seen[id].t:0)<50000;

/* penyimpanan di HP (IndexedDB) */
const idb=new Promise((ok,no)=>{const r=indexedDB.open("tukar",1);r.onupgradeneeded=()=>r.result.createObjectStore("f",{keyPath:"id"});r.onsuccess=()=>ok(r.result);r.onerror=no});
const tx=async(m,fn)=>{const d=await idb;return new Promise((ok,no)=>{const t=d.transaction("f",m),q=fn(t.objectStore("f"));t.oncomplete=()=>ok(q&&q.result);t.onerror=no})};
const put=o=>tx("readwrite",s=>s.put(o)).catch(()=>toast("Penyimpanan HP penuh."));
try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}

/* login */
const setMode=m=>{mode=m;$("#ti").setAttribute("aria-pressed",m==="in");$("#tu").setAttribute("aria-pressed",m==="up");$("#go").textContent=m==="in"?"Masuk":"Daftar";$("#ae").textContent=""};
$("#ti").onclick=()=>setMode("in");$("#tu").onclick=()=>setMode("up");
const em=n=>n.trim().toLowerCase().replace(/[^a-z0-9._-]/g,"")+"@tukar.app";
function err(e){const c=e.code||"";$("#ae").textContent=/invalid|wrong|not-found/.test(c)?"Nama atau password salah.":c.includes("email-already")?"Nama sudah dipakai.":c.includes("weak")?"Password minimal 6 karakter.":c.includes("popup")?"Login Google dibatalkan.":c.includes("unauthorized")?"Domain belum didaftarkan di Firebase.":"Gagal masuk. Coba lagi."}
$("#go").onclick=async()=>{
  const n=$("#un").value.trim(),p=$("#pw").value;$("#ae").textContent="";
  if(n.length<3)return $("#ae").textContent="Nama minimal 3 huruf.";
  try{
    if(mode==="up"){const c=await createUserWithEmailAndPassword(auth,em(n),p);await updateProfile(c.user,{displayName:n});await setDoc(doc(db,"users",c.user.uid),{name:n,lastSeen:Date.now()},{merge:true})}
    else await signInWithEmailAndPassword(auth,em(n),p);
  }catch(e){err(e)}
};
$("#gg").onclick=()=>signInWithPopup(auth,new GoogleAuthProvider()).catch(err);
$("#lo").onclick=()=>signOut(auth);

let pi;
onAuthStateChanged(auth,u=>{
  unsubs.forEach(f=>f());unsubs=[];rUn.forEach(f=>f());rUn=[];clearInterval(hb);clearInterval(pi);
  $("#boot").hidden=true;
  if(!u){me=null;$("#app").hidden=true;$("#auth").hidden=false;return}
  me={id:u.uid};$("#auth").hidden=true;$("#app").hidden=false;view="home";renderAll();
  const ref=doc(db,"users",u.uid),base={lastSeen:Date.now()};if(u.displayName)base.name=u.displayName;
  setDoc(ref,base,{merge:true}).catch(fail);
  getDoc(ref).then(d=>{const x=d.data();if(x&&x.folders){folders=x.folders;if(view==="profile")render()}}).catch(()=>{});
  tx("readonly",s=>s.getAll()).then(r=>{files=(r||[]).filter(f=>f.owner===me.id);if(view==="profile")render()}).catch(()=>{});
  hb=setInterval(()=>updateDoc(ref,{lastSeen:Date.now()}).catch(()=>{}),20000);
  unsubs.push(onSnapshot(collection(db,"users"),s=>{s.forEach(d=>{const x=d.data(),ls=x.lastSeen||0,q=seen[d.id];users[d.id]=x;if(!q)seen[d.id]={v:ls,t:Date.now()-ls<120000?Date.now():0};else if(q.v!==ls){q.v=ls;q.t=Date.now()}});renderAll()},fail));
  unsubs.push(onSnapshot(query(collection(db,"signals"),where("to","==",me.id)),s=>s.docChanges().forEach(c=>{if(c.type==="added"){const x=c.doc.data();deleteDoc(c.doc.ref).catch(()=>{});if(Date.now()-x.ts>120000)return;try{onSig(x.from,JSON.parse(x.d))}catch(e){}}}),fail));
  pi=setInterval(renderPeople,15000);listenRooms();
  const lq=new URLSearchParams(location.search).get("room");if(lq)openRoom(lq);
  try{window.Notification&&Notification.permission==="default"&&Notification.requestPermission()}catch(e){}
});

/* modal */
function modal(t,body,btns){mq.push({t,body,btns});if(!busy)nextModal()}
function nextModal(){
  const m=mq.shift();if(!m){busy=false;$("#md").classList.remove("open");return}
  busy=true;$("#mt").textContent=m.t;const b=$("#mb");b.replaceChildren();
  (Array.isArray(m.body)?m.body:[m.body]).forEach(x=>b.appendChild(E("div","n",x)));
  const x=$("#mx");x.replaceChildren();
  m.btns.forEach(o=>{const k=E("button",o.c||"",o.t);k.onclick=async()=>{$("#md").classList.remove("open");try{await (o.f&&o.f())}catch(e){}nextModal()};x.appendChild(k)});
  $("#md").classList.add("open");
}

/* menu + orang */
const openDr=()=>{$("#side").classList.add("open");$("#ov").classList.add("open")},closeDr=()=>{$("#side").classList.remove("open");$("#ov").classList.remove("open")};
$("#mn").onclick=openDr;$("#ov").onclick=closeDr;$("#np").onclick=()=>{view="newroom";closeDr();render()};$("#mp").onclick=()=>{view="profile";closeDr();render()};
function renderAll(){renderMe();renderPeople();renderRooms();render()}
function renderMe(){const b=$("#meb");b.replaceChildren(avatar(me.id));const g=E("div","grow");g.appendChild(E("div","n",nm(me.id)));g.appendChild(E("div","sm","Online"));b.appendChild(g)}
function renderPeople(){
  if(!me)return;
  const ps=Object.keys(users).filter(i=>i!==me.id).map(i=>({id:i,online:isOn(i)})).sort((a,b)=>b.online-a.online);
  const ul=$("#pl");ul.replaceChildren();
  if(!ps.length)ul.appendChild(E("li","empty","Belum ada orang lain."));
  ps.forEach(p=>{const li=E("li","per");li.appendChild(avatar(p.id));
    const g=E("div","grow");g.appendChild(E("div","n",nm(p.id)));g.appendChild(E("div","sm",(p.online?"Online":"Offline")+" - "+((users[p.id].pub||[]).length)+" file publik"));
    li.appendChild(g);li.appendChild(E("span","dot"+(p.online?" on":"")));
    li.onclick=()=>{selId=p.id;view="person";closeDr();render()};ul.appendChild(li)});
}

/* tampilan utama */
function render(){
  const m=$("#main");m.replaceChildren();
  if(view==="home"){const h=E("h1");h.innerHTML="<span>Mise</span><br>Verse";m.appendChild(h);
    m.appendChild(E("p","","Pilih orang yang sedang online, lalu kirim file. Penerima harus setuju dulu sebelum file masuk."));
    const b=E("button","p","Lihat orang");b.onclick=openDr;m.appendChild(b)}
  else if(view==="person")vPerson(m);else if(view==="room")vRoom(m);else if(view==="newroom")vNew(m);else vProfile(m);
}
function vPerson(m){
  const id=selId,on=isOn(id),c=E("div","card"),r=E("div","row");r.appendChild(avatar(id));
  const g=E("div","grow");g.appendChild(E("div","n",nm(id)));g.appendChild(E("div","sm",on?"Online":"Offline"));r.appendChild(g);c.appendChild(r);
  const s=E("button","b","Kirim file");s.style.marginTop="14px";s.disabled=!on;
  s.onclick=()=>pick(fs=>offer(id,fs.map(f=>({name:f.name,size:f.size,type:f.type,blob:f}))));c.appendChild(s);
  if(!on)c.appendChild(E("p","sm","Sedang offline. Kirim file saat dia online."));m.appendChild(c);
  const c2=E("div","card");c2.appendChild(E("h2","","File publik"));const ul=E("ul"),l=(users[id]&&users[id].pub)||[];
  if(!l.length)ul.appendChild(E("li","empty","Belum ada file publik."));
  l.forEach(f=>{const li=E("li","row"),g=E("div","grow");g.appendChild(E("div","n",f.name));g.appendChild(E("div","sm",fmt(f.size)));li.appendChild(g);
    const k=E("button","g s","Minta");k.disabled=!on;k.onclick=()=>{asked[f.id]=true;sig(id,{k:"ask",fid:f.id});toast("Permintaan dikirim")};li.appendChild(k);ul.appendChild(li)});
  c2.appendChild(ul);m.appendChild(c2);
}
function vProfile(m){
  const c=E("div","card"),r=E("div","row");r.appendChild(avatar(me.id));
  const g=E("div","grow");g.appendChild(E("div","n",nm(me.id)));g.appendChild(E("div","sm",files.length+" file di profil"));r.appendChild(g);c.appendChild(r);
  const a=E("button","b","Tambah file ke profil");a.style.marginTop="14px";
  a.onclick=()=>pick(async fs=>{for(const f of fs)await addFile({id:uid(),owner:me.id,name:f.name,size:f.size,type:f.type,blob:f,folder:"Umum",vis:"priv",dl:false});render()});
  c.appendChild(a);m.appendChild(c);
  const c2=E("div","card");c2.appendChild(E("h2","","Folder"));const ch=E("div","chips");
  ["Semua",...folders].forEach(f=>{const k=E("button","",f);k.setAttribute("aria-pressed",f===curF);k.onclick=()=>{curF=f;render()};ch.appendChild(k)});c2.appendChild(ch);
  const inp=E("input");inp.type="text";inp.placeholder="Nama folder baru";inp.maxLength=30;
  const ad=E("button","s","Tambah folder");ad.onclick=()=>{const v=inp.value.trim();if(v&&!folders.includes(v)){folders.push(v);updateDoc(doc(db,"users",me.id),{folders}).catch(()=>{});render()}};
  c2.append(inp,ad);
  const ul=E("ul"),list=files.filter(f=>curF==="Semua"||f.folder===curF);
  if(!list.length)ul.appendChild(E("li","empty","Folder ini kosong."));
  list.forEach(f=>{const li=E("li");li.appendChild(E("div","n",f.name));
    li.appendChild(E("div","sm",fmt(f.size)+(f.from?" - dari "+f.from:"")+(f.dl?" - sudah diunduh":"")));
    const bt=E("div","row");bt.style.marginTop="8px";
    const v=E("button",(f.vis==="pub"?"g":"w")+" s",f.vis==="pub"?"Publik":"Privat");v.onclick=async()=>{f.vis=f.vis==="pub"?"priv":"pub";await put(f);syncPub();render()};
    const sel=E("select");sel.style.width="auto";folders.forEach(o=>{const op=E("option","",o);op.value=o;if(o===f.folder)op.selected=true;sel.appendChild(op)});
    sel.onchange=async()=>{f.folder=sel.value;await put(f);render()};
    const d=E("button","b s","Unduh");d.onclick=()=>saveOut(f);
    const x=E("button","p s","Hapus");x.onclick=async()=>{await tx("readwrite",s=>s.delete(f.id)).catch(()=>{});files=files.filter(z=>z!==f);syncPub();render()};
    bt.append(v,sel,d,x);li.appendChild(bt);ul.appendChild(li)});
  c2.appendChild(ul);m.appendChild(c2);
}
function pick(cb){const i=$("#pk");i.onchange=()=>{const f=[...i.files];i.value="";if(f.length)cb(f)};i.click()}
async function addFile(o){files.push(o);await put(o);syncPub()}
const syncPub=()=>updateDoc(doc(db,"users",me.id),{pub:files.filter(f=>f.vis==="pub").map(f=>({id:f.id,name:f.name,size:f.size}))}).catch(()=>{});
async function saveOut(f){const a=document.createElement("a");a.href=URL.createObjectURL(f.blob);a.download=f.name;document.body.appendChild(a);a.click();a.remove();f.dl=true;await put(f);render()}

/* sinyal WebRTC lewat Firestore + transfer */
const sig=(to,o)=>addDoc(collection(db,"signals"),{from:me.id,to,d:JSON.stringify(o),ts:Date.now()}).catch(()=>toast("Gagal mengirim sinyal."));
function newPC(tid,peer){const pc=new RTCPeerConnection(ICE),P={pc,peer,q:[],rd:false};pcs[tid]=P;pc.onconnectionstatechange=()=>{if(pc.connectionState==="failed")toast("Koneksi antar HP gagal. Coba lagi atau pakai Wi-Fi yang sama.")};pc.onicecandidate=e=>{if(e.candidate)sig(peer,{k:"ice",tid,c:e.candidate.toJSON()})};return P}
async function flush(P){P.rd=true;for(const c of P.q)try{await P.pc.addIceCandidate(c)}catch(e){}P.q=[]}
function offer(peer,list,ask){const tid=uid();sends[tid]={peer,list};sig(peer,{k:"req",tid,ask,files:list.map(f=>({name:f.name,size:f.size}))});toast("Menunggu "+nm(peer)+" menyetujui...")}
async function startSend(tid){
  const S=sends[tid],P=newPC(tid,S.peer),dc=P.pc.createDataChannel("f");dc.binaryType="arraybuffer";dc.bufferedAmountLowThreshold=1<<20;
  dc.onopen=()=>pump(dc,S.list);
  await P.pc.setLocalDescription(await P.pc.createOffer());sig(S.peer,{k:"offer",tid,sdp:P.pc.localDescription.toJSON()});
}
const low=dc=>new Promise(r=>{dc.onbufferedamountlow=()=>{dc.onbufferedamountlow=null;r()}});
async function pump(dc,list){
  try{for(const it of list){
    dc.send(JSON.stringify({t:"meta",name:it.name,size:it.size,type:it.type}));
    for(let o=0;o<it.size;o+=CH){const buf=await it.blob.slice(o,o+CH).arrayBuffer();
      while(dc.bufferedAmount>4194304){if(dc.readyState!=="open")throw 0;await low(dc)}
      dc.send(buf);if(o%(CH*64)===0)toast("Mengirim "+it.name+" "+Math.min(100,Math.round(o/it.size*100))+"%")}
    dc.send(JSON.stringify({t:"end"}))}
    while(dc.bufferedAmount>0)await new Promise(r=>setTimeout(r,100));
    toast("Semua file terkirim.");setTimeout(()=>dc.close(),800);
  }catch(e){toast("Pengiriman terhenti. Cek koneksi.")}
}
function accept(peer,d){
  const P=newPC(d.tid,peer);let cur=null;
  P.pc.ondatachannel=e=>{const ch=e.channel;ch.binaryType="arraybuffer";
    ch.onmessage=async ev=>{
      if(typeof ev.data==="string"){const m=JSON.parse(ev.data);
        if(m.t==="meta"){cur={m,ch:[]};toast("Menerima "+m.name+"...")}
        else if(m.t==="end"&&cur){const c=cur;cur=null;
          const o={id:uid(),owner:me.id,name:c.m.name,size:c.m.size,type:c.m.type,blob:new Blob(c.ch,{type:c.m.type||"application/octet-stream"}),folder:"Belum diunduh",vis:"priv",dl:false,from:nm(peer)};
          await addFile(o);if(view==="profile")render();notify("File diterima: "+o.name);
          modal("File diterima",[o.name,fmt(o.size)+" dari "+nm(peer),"Sudah tersimpan di profilmu, folder Belum diunduh."],[{t:"Unduh",c:"g",f:()=>saveOut(o)},{t:"Lihat di profil",c:"b",f:()=>{curF="Belum diunduh";view="profile";render()}},{t:"Nanti saja",c:"w"}])}
      }else if(cur)cur.ch.push(ev.data)}};
  sig(peer,{k:"ok",tid:d.tid});
}
function onSig(from,d){
  if(d.k==="req"){
    if(d.ask&&asked[d.ask]){delete asked[d.ask];return accept(from,d)}
    notify(nm(from)+" ingin mengirim file");
    modal(nm(from)+" ingin mengirim file",d.files.map(f=>f.name+" ("+fmt(f.size)+")"),[{t:"Terima",c:"g",f:()=>accept(from,d)},{t:"Tolak",c:"p",f:()=>sig(from,{k:"no",tid:d.tid})}]);
  }else if(d.k==="ask"){
    const f=files.find(x=>x.id===d.fid&&x.vis==="pub");if(!f)return sig(from,{k:"no",tid:""});
    notify(nm(from)+" meminta file");
    modal(nm(from)+" meminta file publikmu",[f.name],[{t:"Kirim",c:"g",f:()=>offer(from,[f],d.fid)},{t:"Tolak",c:"p",f:()=>sig(from,{k:"no",tid:""})}]);
  }else if(d.k==="ok"&&sends[d.tid]){toast(nm(from)+" setuju. Mengirim...");notify(nm(from)+" menyetujui file");startSend(d.tid)}
  else if(d.k==="no"){toast("Permintaan ditolak.");delete sends[d.tid]}
  else if(d.k==="offer"&&pcs[d.tid]){const P=pcs[d.tid];P.pc.setRemoteDescription(d.sdp).then(async()=>{await flush(P);await P.pc.setLocalDescription(await P.pc.createAnswer());sig(P.peer,{k:"answer",tid:d.tid,sdp:P.pc.localDescription.toJSON()})})}
  else if(d.k==="answer"&&pcs[d.tid]){const P=pcs[d.tid];P.pc.setRemoteDescription(d.sdp).then(()=>flush(P))}
  else if(d.k==="ice"&&pcs[d.tid]){const P=pcs[d.tid];if(P.rd)P.pc.addIceCandidate(d.c).catch(()=>{});else P.q.push(d.c)}
}

/* ===== ROOM ===== */
let rooms={},curRoom=null,offers={},msgs=[],roomFiles={},served={},rUn=[],mInit=false;
const roomSub=r=>(r.mode==="public"?"Room publik":"Party, hanya lewat link")+" - "+(r.members||[]).length+" anggota";
function listenRooms(){
  const up=s=>{s.forEach(d=>rooms[d.id]=d.data());renderRooms()};
  unsubs.push(onSnapshot(query(collection(db,"rooms"),where("mode","==","public")),up,fail));
  unsubs.push(onSnapshot(query(collection(db,"rooms"),where("members","array-contains",me.id)),up,fail));
}
function renderRooms(){
  const ul=$("#rl");if(!ul||!me)return;ul.replaceChildren();
  const l=Object.entries(rooms).filter(([i,r])=>r.mode==="public"||(r.members||[]).includes(me.id));
  if(!l.length)ul.appendChild(E("li","empty","Belum ada room. Tekan + di atas."));
  l.forEach(([id,r])=>{const li=E("li","per"),g=E("div","grow");g.appendChild(E("div","n",r.name));g.appendChild(E("div","sm",roomSub(r)));li.appendChild(g);
    li.onclick=()=>{closeDr();openRoom(id)};ul.appendChild(li)});
}
async function openRoom(id){
  try{
    const ref=doc(db,"rooms",id),snap=await getDoc(ref);
    if(!snap.exists())return toast("Room tidak ditemukan.");
    if(!(snap.data().members||[]).includes(me.id))await updateDoc(ref,{members:arrayUnion(me.id)});
    rUn.forEach(f=>f());rUn=[];curRoom=id;offers={};msgs=[];mInit=false;view="room";rooms[id]=snap.data();
    rUn.push(onSnapshot(ref,d=>{if(d.exists()){rooms[id]=d.data();renderRooms();const e=$("#rsub");if(e&&view==="room")e.textContent=roomSub(d.data())}},fail));
    rUn.push(onSnapshot(collection(db,"rooms",id,"offers"),s=>{offers={};s.forEach(d=>offers[d.id]=d.data());serve();if(view==="room")fillOffers()},fail));
    rUn.push(onSnapshot(query(collection(db,"rooms",id,"msgs"),orderBy("ts"),limitToLast(60)),s=>{msgs=s.docs.map(d=>d.data());const l=msgs[msgs.length-1];if(mInit&&l&&l.from!==me.id&&(document.hidden||view!=="room"))notify(nm(l.from)+": "+l.text);mInit=true;if(view==="room")fillChat()},fail));
    render();
  }catch(e){fail(e)}
}
function serve(){
  Object.entries(offers).forEach(([oid,o])=>{if(o.from!==me.id)return;const f=roomFiles[oid];
    Object.keys(o.req||{}).forEach(u=>{const k=oid+u+o.req[u];if(f&&!served[k]){served[k]=1;toast(nm(u)+" setuju. Mengirim "+f.name+"...");notify(nm(u)+" meminta "+f.name);offer(u,[{name:f.name,size:f.size,type:f.type,blob:f}],oid)}})});
}
function vNew(m){
  const c=E("div","card");c.appendChild(E("h2","","Buat room"));
  const inp=E("input");inp.type="text";inp.placeholder="Nama room";inp.maxLength=30;
  let md="party";const ch=E("div","chips");
  const mk=(k,t)=>{const b=E("button","",t);b.setAttribute("aria-pressed",k===md);b.onclick=()=>{md=k;[...ch.children].forEach((x,i)=>x.setAttribute("aria-pressed",(i===0)===(k==="party")))};ch.appendChild(b)};
  mk("party","Party (hanya lewat link)");mk("public","Room publik");
  const go=E("button","g","Buat room");
  go.onclick=async()=>{const id=uid()+uid();try{await setDoc(doc(db,"rooms",id),{name:inp.value.trim()||"Room baru",owner:me.id,mode:md,members:[me.id],created:Date.now()});openRoom(id)}catch(e){fail(e)}};
  c.append(inp,ch,go);m.appendChild(c);
}
function vRoom(m){
  const r=rooms[curRoom]||{},c=E("div","card"),link=location.origin+location.pathname+"?room="+curRoom;
  c.appendChild(E("h2","",r.name||"Room"));const sb=E("div","sm",roomSub(r));sb.id="rsub";c.appendChild(sb);
  const row=E("div","row");row.style.marginTop="12px";
  const cp=E("button","b s","Salin link invite");cp.onclick=async()=>{try{await navigator.clipboard.writeText(link);toast("Link disalin.")}catch(e){prompt("Salin link ini:",link)}};
  const sh=E("button","w s","Bagikan");sh.onclick=()=>navigator.share?navigator.share({title:"MiseVerse",text:"Gabung room "+r.name,url:link}).catch(()=>{}):cp.onclick();
  const ad=E("button","g s","Tambah file");ad.onclick=()=>pick(async fs=>{for(const f of fs)await addOffer(f)});
  row.append(cp,sh,ad);c.appendChild(row);m.appendChild(c);
  const ul=E("ul");ul.id="ofl";m.appendChild(ul);fillOffers();
  const cc=E("div","card");cc.appendChild(E("h2","","Chat"));const cl=E("div","chat");cl.id="cl";cc.appendChild(cl);
  const r2=E("div","row"),ci=E("input");ci.type="text";ci.placeholder="Tulis pesan";ci.maxLength=500;ci.style.flex="1";ci.style.margin="0";ci.style.minWidth="0";
  const send=()=>{const v=ci.value.trim();if(!v)return;ci.value="";addDoc(collection(db,"rooms",curRoom,"msgs"),{from:me.id,text:v,ts:Date.now()}).catch(fail)};
  const sb2=E("button","b","Kirim");sb2.onclick=send;ci.onkeydown=e=>{if(e.key==="Enter")send()};
  r2.append(ci,sb2);cc.appendChild(r2);m.appendChild(cc);fillChat();
}
function fillChat(){
  const l=$("#cl");if(!l)return;l.replaceChildren();
  if(!msgs.length)l.appendChild(E("div","sm","Belum ada pesan."));
  msgs.forEach(x=>{const d=E("div","msg"+(x.from===me.id?" me":""));if(x.from!==me.id)d.appendChild(E("b","",nm(x.from)));d.appendChild(E("span","",x.text));l.appendChild(d)});
  l.scrollTop=l.scrollHeight;
}
function fillOffers(){
  const ul=$("#ofl");if(!ul)return;ul.replaceChildren();const ids=Object.keys(offers);
  if(!ids.length)ul.appendChild(E("li","empty","Belum ada file. Tekan Tambah file untuk menawarkan file."));
  ids.forEach(oid=>ul.appendChild(offerCard(oid,offers[oid])));
}
const offRef=oid=>doc(db,"rooms",curRoom,"offers",oid);
function thumb(f){return new Promise((ok,no)=>{const i=new Image();i.onload=()=>{const s=Math.min(1,160/Math.max(i.width,i.height)),c=document.createElement("canvas");c.width=i.width*s;c.height=i.height*s;c.getContext("2d").drawImage(i,0,0,c.width,c.height);ok(c.toDataURL("image/jpeg",.5))};i.onerror=no;i.src=URL.createObjectURL(f)})}
async function addOffer(f){
  const o={from:me.id,name:f.name,size:f.size,type:f.type||"",req:{},ts:Date.now()};
  try{if(o.type.startsWith("image/"))o.thumb=await thumb(f);else if(o.type.startsWith("text/")||/\.(txt|md|csv|json|js|html|css)$/i.test(f.name))o.snip=await f.slice(0,400).text()}catch(e){}
  try{const r=await addDoc(collection(db,"rooms",curRoom,"offers"),o);roomFiles[r.id]=f;toast("File ditawarkan di room.")}catch(e){fail(e)}
}
function offerCard(oid,o){
  const li=E("li"),mine=o.from===me.id;
  li.appendChild(E("div","n",o.name));li.appendChild(E("div","sm",fmt(o.size)+" - dari "+(mine?"kamu":nm(o.from))));
  if(o.thumb){const i=E("img","thumb nocopy");i.src=o.thumb;i.alt="Pratinjau";i.draggable=false;i.oncontextmenu=e=>e.preventDefault();li.appendChild(i)}
  if(o.snip){const p=E("div","snip nocopy",o.snip);["copy","cut","contextmenu","selectstart","dragstart"].forEach(ev=>p.addEventListener(ev,e=>e.preventDefault()));li.appendChild(p)}
  const bt=E("div","row");bt.style.marginTop="8px";
  if(mine){
    const n=Object.keys(o.req||{}).length;bt.appendChild(E("span","sm",n?n+" orang sudah setuju":"Menunggu orang yang setuju"));
    const x=E("button","p s","Hapus");x.onclick=()=>deleteDoc(offRef(oid)).catch(fail);bt.appendChild(x);
  }else{
    const on=isOn(o.from),had=o.req&&o.req[me.id];
    const g=E("button","g",had?"Setuju (minta lagi)":"Setuju");g.disabled=!on;
    g.onclick=()=>{asked[oid]=true;updateDoc(offRef(oid),{["req."+me.id]:Date.now()}).catch(fail);toast("Menunggu pengirim mengirim file...")};
    bt.appendChild(g);if(!on)bt.appendChild(E("span","sm","Pengirim sedang offline"));
  }
  li.appendChild(bt);return li;
}
