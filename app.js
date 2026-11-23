import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,signInWithPopup,GoogleAuthProvider,signOut,updateProfile} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {initializeFirestore,doc,setDoc,updateDoc,getDoc,arrayUnion,collection,onSnapshot,query,where,orderBy,limitToLast,addDoc,deleteDoc,runTransaction} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {firebaseConfig} from "./firebase-config.js";

const $=s=>document.querySelector(s);
const E=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const fmt=n=>n<1024?n+" B":n<1048576?(n/1024).toFixed(1)+" KB":(n/1048576).toFixed(1)+" MB";
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36);
const fb=initializeApp(firebaseConfig),auth=getAuth(fb),db=initializeFirestore(fb,{experimentalAutoDetectLongPolling:true});
let me=null,users={},files=[],folders=["Belum diunduh","Umum"],view="home",selId=null,curF="Semua",sends={},pcs={},asked={},mq=[],busy=false,tt,unsubs=[],hb,mode="in";
const CH=16384,ICE={iceServers:firebaseConfig.iceServers||[{urls:"stun:stun.l.google.com:19302"}]};
const toast=t=>{const e=$("#toast");e.textContent=t;e.classList.add("show");clearTimeout(tt);tt=setTimeout(()=>e.classList.remove("show"),3000)};
const fail=e=>toast("Database: "+((e&&e.code)||"error")+(e&&e.code==="permission-denied"?" - Publish Rules di Firestore":""));
const notify=t=>{try{navigator.vibrate&&navigator.vibrate(200);if(window.Notification&&Notification.permission==="granted"&&document.hidden)new Notification(t)}catch(e){}};
const nm=id=>(users[id]&&users[id].name)||"Pengguna";
const col=id=>"hsl("+([...id].reduce((a,c)=>a+c.charCodeAt(0),0)*47%360)+",85%,72%)";
const avatar=id=>{const u=users[id]||{},a=E("div","av",u.photo?"":nm(id).charAt(0).toUpperCase());a.style.background=u.photo?'url("'+u.photo+'") center/cover':col(id);return a};
const sq=f=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>{const s=Math.min(i.width,i.height),c=document.createElement("canvas");c.width=c.height=128;c.getContext("2d").drawImage(i,(i.width-s)/2,(i.height-s)/2,s,s,0,0,128,128);ok(c.toDataURL("image/jpeg",.7))};i.onerror=no;i.src=URL.createObjectURL(f)});
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
  unsubs.forEach(f=>f());unsubs=[];rUn.forEach(f=>f());rUn=[];clearInterval(hb);clearInterval(pi);clearInterval(aTimer);
  $("#boot").hidden=true;
  if(!u){me=null;$("#app").hidden=true;$("#auth").hidden=false;return}
  me={id:u.uid};$("#auth").hidden=true;$("#app").hidden=false;view="home";renderAll();
  const ref=doc(db,"users",u.uid);
  getDoc(ref).then(d=>{const x=d.data()||{};if(x.folders){folders=x.folders;if(view==="profile")render()}const b={lastSeen:Date.now()};if(!x.name&&u.displayName)b.name=u.displayName;return setDoc(ref,b,{merge:true})}).catch(fail);
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
function renderAll(){renderMe();renderPeople();renderRooms();const ae=document.activeElement;if(view==="room"){fillTrade();fillChat();fillAuc()}else if(!["newroom","newauction","editprofile"].includes(view)&&!(ae&&$("#main").contains(ae)&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)))render()}
function renderMe(){const b=$("#meb");b.replaceChildren(avatar(me.id));const g=E("div","grow");g.appendChild(E("div","n",nm(me.id)));g.appendChild(E("div","sm","Online - "+myPts()+" poin"));b.appendChild(g)}
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
    const b=E("button","p","Lihat orang");b.onclick=openDr;m.appendChild(b);
    const rc=E("div","card");rc.style.marginTop="24px";rc.appendChild(E("h2","","Room"));const hl=E("ul");hl.id="hl";rc.appendChild(hl);
    rc.appendChild(E("div","sm","Room Publik bisa dimasuki siapa saja. Room Link hanya bisa dimasuki lewat link invite dari ketua."));m.appendChild(rc);renderRooms()}
  else if(view==="person")vPerson(m);else if(view==="room")vRoom(m);else if(view==="newroom")vNew(m);else if(view==="editprofile")vEdit(m);else if(view==="newauction")vNewAuc(m);else vProfile(m);
}
function vPerson(m){
  const id=selId,on=isOn(id),c=E("div","card"),r=E("div","row");r.appendChild(avatar(id));
  const g=E("div","grow");g.appendChild(E("div","n",nm(id)));g.appendChild(E("div","sm",on?"Online":"Offline"));if(users[id]&&users[id].bio)g.appendChild(E("div","",users[id].bio));r.appendChild(g);c.appendChild(r);
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
  const g=E("div","grow");g.appendChild(E("div","n",nm(me.id)));g.appendChild(E("div","sm",files.length+" file di profil"));if(users[me.id]&&users[me.id].bio)g.appendChild(E("div","",users[me.id].bio));r.appendChild(g);c.appendChild(r);
  const a=E("button","b","Tambah file ke profil");a.style.marginTop="14px";
  a.onclick=()=>pick(async fs=>{for(const f of fs)await addFile({id:uid(),owner:me.id,name:f.name,size:f.size,type:f.type,blob:f,folder:"Umum",vis:"priv",dl:false});render()});
  const ed=E("button","w","Edit profil");ed.onclick=()=>{view="editprofile";render()};
  const br=E("div","row");br.style.marginTop="14px";a.style.marginTop="0";br.append(a,ed);c.appendChild(br);m.appendChild(c);
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
function vEdit(m){
  const u=users[me.id]||{};let photo=u.photo||"";
  const c=E("div","card");c.appendChild(E("h2","","Edit profil"));
  const pv=E("div","row"),av=E("div","av big");
  const paint=()=>{av.textContent=photo?"":nm(me.id).charAt(0).toUpperCase();av.style.background=photo?'url("'+photo+'") center/cover':col(me.id)};paint();
  const ph=E("button","b s","Ganti foto");ph.onclick=()=>{const i=document.createElement("input");i.type="file";i.accept="image/*";i.onchange=async()=>{if(i.files[0])try{photo=await sq(i.files[0]);paint()}catch(e){toast("Foto tidak bisa dibaca.")}};i.click()};
  const rm=E("button","w s","Hapus foto");rm.onclick=()=>{photo="";paint()};
  pv.append(av,ph,rm);c.appendChild(pv);
  c.appendChild(E("label","","Display name"));const ni=E("input");ni.type="text";ni.maxLength=24;ni.value=u.name||"";c.appendChild(ni);
  c.appendChild(E("label","","Bio"));const bi=E("textarea");bi.maxLength=160;bi.rows=4;bi.value=u.bio||"";bi.placeholder="Ceritakan sedikit tentang kamu";c.appendChild(bi);
  const row=E("div","row");
  const sv=E("button","g","Simpan");sv.onclick=()=>{const n=ni.value.trim();if(n.length<2)return toast("Display name minimal 2 huruf.");updateDoc(doc(db,"users",me.id),{name:n,bio:bi.value.trim(),photo}).then(()=>{toast("Profil disimpan.");view="profile";render()}).catch(fail)};
  const cn=E("button","w","Batal");cn.onclick=()=>{view="profile";render()};
  row.append(sv,cn);c.appendChild(row);m.appendChild(c);
}
function pick(cb){const i=$("#pk");i.onchange=()=>{const f=[...i.files];i.value="";if(f.length)cb(f)};i.click()}
async function addFile(o){files.push(o);await put(o);syncPub()}
const syncPub=()=>updateDoc(doc(db,"users",me.id),{pub:files.filter(f=>f.vis==="pub").map(f=>({id:f.id,name:f.name,size:f.size}))}).catch(()=>{});
async function saveOut(f){const a=document.createElement("a");a.href=URL.createObjectURL(f.blob);a.download=f.name;document.body.appendChild(a);a.click();a.remove();f.dl=true;await put(f);render()}

/* sinyal WebRTC lewat Firestore + transfer */
const sig=(to,o)=>addDoc(collection(db,"signals"),{from:me.id,to,d:JSON.stringify(o),ts:Date.now()}).catch(()=>toast("Gagal mengirim sinyal."));
function newPC(tid,peer){const pc=new RTCPeerConnection(ICE),P={pc,peer,q:[],rd:false};pcs[tid]=P;pc.onconnectionstatechange=()=>{if(pc.connectionState==="failed")toast("Koneksi antar HP gagal. Coba lagi atau pakai Wi-Fi yang sama.")};pc.onicecandidate=e=>{if(e.candidate)sig(peer,{k:"ice",tid,c:e.candidate.toJSON()})};return P}
async function flush(P){P.rd=true;for(const c of P.q)try{await P.pc.addIceCandidate(c)}catch(e){}P.q=[]}
function offer(peer,list,ask,done){const tid=uid();sends[tid]={peer,list,done};sig(peer,{k:"req",tid,ask,files:list.map(f=>({name:f.name,size:f.size}))});toast("Menunggu "+nm(peer)+" menyetujui...")}
async function startSend(tid){
  const S=sends[tid],P=newPC(tid,S.peer),dc=P.pc.createDataChannel("f");dc.binaryType="arraybuffer";dc.bufferedAmountLowThreshold=1<<20;
  dc.onopen=()=>pump(dc,S.list,S.done);
  await P.pc.setLocalDescription(await P.pc.createOffer());sig(S.peer,{k:"offer",tid,sdp:P.pc.localDescription.toJSON()});
}
const low=dc=>new Promise(r=>{dc.onbufferedamountlow=()=>{dc.onbufferedamountlow=null;r()}});
async function pump(dc,list,done){
  try{for(const it of list){
    dc.send(JSON.stringify({t:"meta",name:it.name,size:it.size,type:it.type}));
    for(let o=0;o<it.size;o+=CH){const buf=await it.blob.slice(o,o+CH).arrayBuffer();
      while(dc.bufferedAmount>4194304){if(dc.readyState!=="open")throw 0;await low(dc)}
      dc.send(buf);if(o%(CH*64)===0)toast("Mengirim "+it.name+" "+Math.min(100,Math.round(o/it.size*100))+"%")}
    dc.send(JSON.stringify({t:"end"}))}
    while(dc.bufferedAmount>0)await new Promise(r=>setTimeout(r,100));
    toast("Semua file terkirim.");done&&done();setTimeout(()=>dc.close(),800);
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
  }else if(d.k==="aucask"){giveAuc(from,d)}else if(d.k==="ok"&&sends[d.tid]){toast(nm(from)+" setuju. Mengirim...");notify(nm(from)+" menyetujui file");startSend(d.tid)}
  else if(d.k==="no"){toast("Permintaan ditolak.");delete sends[d.tid]}
  else if(d.k==="offer"&&pcs[d.tid]){const P=pcs[d.tid];P.pc.setRemoteDescription(d.sdp).then(async()=>{await flush(P);await P.pc.setLocalDescription(await P.pc.createAnswer());sig(P.peer,{k:"answer",tid:d.tid,sdp:P.pc.localDescription.toJSON()})})}
  else if(d.k==="answer"&&pcs[d.tid]){const P=pcs[d.tid];P.pc.setRemoteDescription(d.sdp).then(()=>flush(P))}
  else if(d.k==="ice"&&pcs[d.tid]){const P=pcs[d.tid];if(P.rd)P.pc.addIceCandidate(d.c).catch(()=>{});else P.q.push(d.c)}
}

/* ===== ROOM ===== */
let rooms={},curRoom=null,trade={},msgs=[],myFile=null,rUn=[],mInit=false,cdLeft=0,cdTimer=null,started={};
const roomSub=r=>(r.mode==="public"?"Room publik":"Party, hanya lewat link")+" - "+(r.members||[]).length+" anggota";
function listenRooms(){
  const up=s=>{s.docChanges().forEach(c=>{if(c.type==="removed")delete rooms[c.doc.id];else rooms[c.doc.id]=c.doc.data()});renderRooms()};
  unsubs.push(onSnapshot(query(collection(db,"rooms"),where("mode","==","public")),up,fail));
  unsubs.push(onSnapshot(query(collection(db,"rooms"),where("members","array-contains",me.id)),up,fail));
}
function renderRooms(){
  if(!me)return;
  const l=Object.entries(rooms).filter(([i,r])=>r.mode==="public"||(r.members||[]).includes(me.id));
  ["#rl","#hl"].forEach(q=>{const ul=$(q);if(!ul)return;ul.replaceChildren();
    if(!l.length)ul.appendChild(E("li","empty","Belum ada room. Tekan + di atas untuk membuat."));
    l.forEach(([id,r])=>{const li=E("li","per room"),g=E("div","grow");g.appendChild(E("div","n",r.name));g.appendChild(E("div","sm",(r.members||[]).length+" anggota"));li.appendChild(g);
      li.appendChild(E("span","tag "+(r.mode==="public"?"pub":"lnk"),r.mode==="public"?"Publik":"Link"));
      li.onclick=()=>{closeDr();openRoom(id)};ul.appendChild(li)})});
}
async function openRoom(id){
  try{
    const ref=doc(db,"rooms",id),snap=await getDoc(ref);
    if(!snap.exists())return toast("Room tidak ditemukan.");
    if(!(snap.data().members||[]).includes(me.id))await updateDoc(ref,{members:arrayUnion(me.id)});
    rUn.forEach(f=>f());rUn=[];clearInterval(cdTimer);cdTimer=null;cdLeft=0;curRoom=id;trade={};myFile=null;msgs=[];mInit=false;aucs={};clearInterval(aTimer);aTimer=setInterval(aTick,1000);view="room";rooms[id]=snap.data();
    rUn.push(onSnapshot(ref,d=>{if(d.exists()){rooms[id]=d.data();renderRooms();const e=$("#rsub");if(e&&view==="room"){e.textContent=roomSub(d.data());fillTrade()}}else{delete rooms[id];renderRooms();if(curRoom===id){curRoom=null;rUn.forEach(f=>f());rUn=[];view="home";render();toast("Room sudah diakhiri oleh ketua.")}}},fail));
    rUn.push(onSnapshot(collection(db,"rooms",id,"trade"),s=>{trade={};s.forEach(d=>trade[d.id]=d.data());tradeCheck();if(view==="room")fillTrade()},fail));
    rUn.push(onSnapshot(collection(db,"rooms",id,"auctions"),s=>{aucs={};s.forEach(d=>aucs[d.id]=d.data());settleAll(id);if(view==="room")fillAuc()},fail));
    rUn.push(onSnapshot(query(collection(db,"rooms",id,"msgs"),orderBy("ts"),limitToLast(60)),s=>{msgs=s.docs.map(d=>d.data());const l=msgs[msgs.length-1];if(mInit&&l&&l.from!==me.id&&(document.hidden||view!=="room"))notify(nm(l.from)+": "+l.text);mInit=true;if(view==="room")fillChat()},fail));
    render();
  }catch(e){fail(e)}
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
  c.appendChild(E("h2","",r.name||"Room"));const sb=E("div","sm",roomSub(r));sb.id="rsub";c.appendChild(sb);c.appendChild(E("div","sm","Ketua: "+nm(r.owner)));
  const row=E("div","row");row.style.marginTop="12px";
  const cp=E("button","b s","Salin link invite");cp.onclick=async()=>{try{await navigator.clipboard.writeText(link);toast("Link disalin.")}catch(e){prompt("Salin link ini:",link)}};
  const sh=E("button","w s","Bagikan");sh.onclick=()=>navigator.share?navigator.share({title:"MiseVerse",text:"Gabung room "+r.name,url:link}).catch(()=>{}):cp.onclick();
  row.append(cp,sh);
  if(r.owner===me.id){const en=E("button","p s","Akhiri room");en.onclick=()=>modal("Akhiri room?",["Semua anggota akan dikeluarkan dan room ini tidak bisa dibuka lagi."],[{t:"Akhiri room",c:"p",f:()=>deleteDoc(doc(db,"rooms",curRoom)).catch(fail)},{t:"Batal",c:"w"}]);row.appendChild(en)}
  c.appendChild(row);m.appendChild(c);
  const tr=E("div");tr.id="tr";m.appendChild(tr);fillTrade();
  const au=E("div");au.id="au";m.appendChild(au);Object.keys(aEl).forEach(k=>delete aEl[k]);fillAuc();
  const cc=E("div","card");cc.appendChild(E("h2","","Chat"));const cl=E("div","chat");cl.id="cl";cc.appendChild(cl);
  const r2=E("div","row"),ci=E("input");ci.type="text";ci.placeholder="Tulis pesan";ci.maxLength=500;ci.style.flex="1";ci.style.margin="0";ci.style.minWidth="0";ci.enterKeyHint="send";
  const send=()=>{const v=ci.value.trim();if(!v)return;ci.value="";addDoc(collection(db,"rooms",curRoom,"msgs"),{from:me.id,text:v,ts:Date.now()}).catch(fail);ci.focus()};
  const sb2=E("button","b","Kirim");sb2.onmousedown=e=>e.preventDefault();sb2.onclick=send;ci.onkeydown=e=>{if(e.key==="Enter")send()};
  r2.append(ci,sb2);cc.appendChild(r2);m.appendChild(cc);fillChat();
}
function fillChat(){
  const l=$("#cl");if(!l)return;l.replaceChildren();
  if(!msgs.length)l.appendChild(E("div","sm","Belum ada pesan."));
  msgs.forEach(x=>{const d=E("div","msg"+(x.from===me.id?" me":""));if(x.from!==me.id)d.appendChild(E("b","",nm(x.from)));d.appendChild(E("span","",x.text));l.appendChild(d)});
  l.scrollTop=l.scrollHeight;
}

/* ===== TRADE: 1 orang 1 file ===== */
const slots=()=>((rooms[curRoom]||{}).members||[]).slice(0,2);
const tRef=u=>doc(db,"rooms",curRoom,"trade",u);
function thumb(f){return new Promise((ok,no)=>{const i=new Image();i.onload=()=>{const s=Math.min(1,160/Math.max(i.width,i.height)),c=document.createElement("canvas");c.width=i.width*s;c.height=i.height*s;c.getContext("2d").drawImage(i,0,0,c.width,c.height);ok(c.toDataURL("image/jpeg",.5))};i.onerror=no;i.src=URL.createObjectURL(f)})}
async function setMyFile(f){
  const o={name:f.name,size:f.size,type:f.type||"",ready:0,ts:Date.now()};
  try{if(o.type.startsWith("image/"))o.thumb=await thumb(f);else if(o.type.startsWith("text/")||/\.(txt|md|csv|json|js|html|css)$/i.test(f.name))o.snip=await f.slice(0,400).text()}catch(e){}
  myFile=f;setDoc(tRef(me.id),o).catch(fail);
}
function tradeCheck(){
  const s=slots(),a=trade[s[0]],b=trade[s[1]];
  const both=s.length===2&&a&&b&&a.ready&&b.ready;
  if(!both){if(cdTimer){clearInterval(cdTimer);cdTimer=null}cdLeft=0;return}
  const peer=s.find(x=>x!==me.id);if(!s.includes(me.id)||!peer)return;
  const key=curRoom+":"+a.ready+":"+b.ready;if(started[key])return;started[key]=1;
  asked["T"+curRoom+":"+peer]=true;cdLeft=3;fillTrade();
  cdTimer=setInterval(()=>{
    const A=trade[s[0]],B=trade[s[1]];
    if(!(A&&B&&A.ready&&B.ready)){clearInterval(cdTimer);cdTimer=null;cdLeft=0;fillTrade();return}
    cdLeft--;fillTrade();
    if(cdLeft<=0){clearInterval(cdTimer);cdTimer=null;
      if(!myFile)return toast("File kamu hilang. Pilih ulang file.");
      const f=myFile;offer(peer,[{name:f.name,size:f.size,type:f.type,blob:f}],"T"+curRoom+":"+me.id,()=>{deleteDoc(tRef(me.id)).catch(()=>{});myFile=null})}
  },1000);
}
function tbox(label,d,mine,wait){
  const b=E("div","tbox");b.appendChild(E("div","sm",label));
  if(!d){
    if(mine){const k=E("button","b","Pilih file");k.onclick=()=>pick(fs=>setMyFile(fs[0]));b.appendChild(k)}
    else b.appendChild(E("div","sm",wait?"Menunggu teman bergabung":"Belum memilih file"));
    return b;
  }
  b.appendChild(E("div","n",d.name));b.appendChild(E("div","sm",fmt(d.size)));
  if(d.thumb){const i=E("img","thumb nocopy");i.src=d.thumb;i.alt="Pratinjau";i.draggable=false;i.oncontextmenu=e=>e.preventDefault();b.appendChild(i)}
  if(d.snip){const p=E("div","snip nocopy",d.snip);["copy","cut","contextmenu","selectstart","dragstart"].forEach(ev=>p.addEventListener(ev,e=>e.preventDefault()));b.appendChild(p)}
  if(mine&&(!d.ready||!myFile)){
    const r=E("div","row");r.style.justifyContent="center";
    const k=E("button","w s",myFile?"Ganti file":"Pilih ulang file");k.onclick=()=>pick(fs=>setMyFile(fs[0]));
    const x=E("button","p s","Hapus");x.onclick=()=>{myFile=null;deleteDoc(tRef(me.id)).catch(fail)};
    r.append(k,x);b.appendChild(r);
  }
  if(d.ready)b.appendChild(E("div","ready","READY"));
  return b;
}
function fillTrade(){
  const box=$("#tr");if(!box||!me)return;box.replaceChildren();
  const s=slots(),partner=s.find(x=>x!==me.id);
  if(!s.includes(me.id)){box.appendChild(E("div","empty","Slot trade sudah penuh (2 orang). Kamu bisa ikut chat."));return}
  const mine=trade[me.id],theirs=partner&&trade[partner];
  box.appendChild(tbox("File kamu",mine,true));
  box.appendChild(tbox(partner?"File "+nm(partner):"File teman",theirs,false,!partner));
  let st="Tekan Accept kalau sudah siap";
  if(!partner)st="Menunggu teman bergabung";else if(!mine)st="Pilih file kamu dulu";else if(!theirs)st="Menunggu teman memilih file";
  else if(mine.ready&&theirs.ready)st=cdLeft>0?"Ready! Download dimulai dalam "+cdLeft+" detik":"Mengirim file...";
  else if(mine.ready)st="Kamu sudah Ready. Menunggu teman";else if(theirs.ready)st=nm(partner)+" sudah Ready";
  box.appendChild(E("div","tstat",st));
  const ac=E("button","g full","Accept");ac.disabled=!(mine&&theirs&&!mine.ready);
  ac.onclick=()=>{if(!myFile)return toast("Pilih ulang file kamu dulu.");updateDoc(tRef(me.id),{ready:Date.now()}).catch(fail)};
  const cn=E("button","p full s","Cancel");cn.style.marginTop="10px";cn.disabled=!(mine&&mine.ready);
  cn.onclick=()=>updateDoc(tRef(me.id),{ready:0}).catch(fail);
  const w=E("div");w.style.marginBottom="22px";w.append(ac,cn);box.appendChild(w);
}

/* ===== LELANG (poin virtual, file digital) ===== */
let aucs={},aTimer=null,reqd={},claiming={};const aEl={};
const myPts=()=>{const p=users[me.id]&&users[me.id].points;return p==null?100:p};
const aEnd=a=>a.endsAt.toMillis(),aOver=a=>Date.now()>=aEnd(a);
const mmss=ms=>{const s=Math.ceil(ms/1000);return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")};
const aRef=(rid,id)=>doc(db,"rooms",rid,"auctions",id);
function aTick(){if(!curRoom)return;if(view==="room")Object.keys(aucs).forEach(updAuc);settleAll(curRoom)}
function settleAll(rid){
  Object.entries(aucs).forEach(([id,a])=>{
    if(!aOver(a)||!a.top.uid)return;
    if(a.top.uid===me.id&&!reqd[id]){reqd[id]=1;asked["A"+id]=true;sig(a.seller,{k:"aucask",aid:id,rid});toast("Kamu menang! Meminta file ke penjual...")}
    if((a.top.uid===me.id||a.seller===me.id)&&!(claiming[id]>Date.now()))claim(rid,id,a);
  });
}
async function claim(rid,id,a){
  claiming[id]=Date.now()+15000;
  const win=a.top.uid===me.id,delta=win?-a.top.amount:a.top.amount,cR=doc(db,"rooms",rid,"auctions",id,"claims",me.id),uR=doc(db,"users",me.id);
  try{
    const did=await runTransaction(db,async t=>{const c=await t.get(cR);if(c.exists())return false;const u=await t.get(uR),p=(u.data()||{}).points,cur=p==null?100:p;t.update(uR,{points:Math.max(0,cur+delta)});t.set(cR,{delta,ts:Date.now()});return true});
    claiming[id]=Infinity;
    if(did)toast(win?"Poinmu dipotong "+a.top.amount+" untuk "+a.title:"Kamu dapat +"+a.top.amount+" poin dari "+a.title);
  }catch(e){}
}
async function giveAuc(from,d){
  try{
    const a=(await getDoc(aRef(d.rid,d.aid))).data(),f=files.find(x=>x.id===d.aid);
    if(!a||a.seller!==me.id||a.top.uid!==from||!aOver(a)||!f)return sig(from,{k:"no",tid:""});
    offer(from,[f],"A"+d.aid);
  }catch(e){sig(from,{k:"no",tid:""})}
}
async function bid(id,amount){
  const ref=aRef(curRoom,id);
  try{
    await runTransaction(db,async t=>{
      const a=(await t.get(ref)).data();
      if(aOver(a))throw new Error("Lelang sudah berakhir.");
      const min=a.top.uid?a.top.amount+a.step:a.startPrice;
      if(!(amount>=min))throw new Error("Tawaran minimal "+min+" poin.");
      if(amount>myPts())throw new Error("Poinmu tidak cukup.");
      t.update(ref,{top:{uid:me.id,amount},log:arrayUnion({u:me.id,a:amount})});
    });
    toast("Tawaranmu masuk: "+amount+" poin.");
  }catch(e){e.code?fail(e):toast(e.message)}
}
async function newAuction(o){
  const f=o.file,id=uid(),d={seller:me.id,title:o.title,name:f.name,size:f.size,type:f.type||"",startPrice:o.start,step:o.step,endsAt:new Date(Date.now()+o.mins*60000),top:{uid:"",amount:0},log:[],created:Date.now()};
  try{if(d.type.startsWith("image/"))d.thumb=await thumb(f);else if(d.type.startsWith("text/")||/\.(txt|md|csv|json|js|html|css)$/i.test(f.name))d.snip=await f.slice(0,400).text()}catch(e){}
  await addFile({id,owner:me.id,name:f.name,size:f.size,type:f.type,blob:f,folder:"Umum",vis:"priv",dl:false});
  await setDoc(aRef(curRoom,id),d);
}
function vNewAuc(m){
  const c=E("div","card");c.appendChild(E("h2","","Buat lelang"));let file=null,mins=5;
  c.appendChild(E("label","","Judul"));const ti=E("input");ti.type="text";ti.maxLength=40;ti.placeholder="Contoh: Paket wallpaper";c.appendChild(ti);
  const pk=E("button","b","Pilih file yang dilelang"),fl=E("div","sm","Belum ada file");pk.style.margin="8px 0 4px";
  pk.onclick=()=>pick(fs=>{file=fs[0];fl.textContent=file.name+" ("+fmt(file.size)+")"});c.append(pk,fl);
  c.appendChild(E("label","","Harga awal (poin)"));const sp=E("input");sp.type="number";sp.inputMode="numeric";sp.value=50;sp.min=1;c.appendChild(sp);
  c.appendChild(E("label","","Kelipatan tawaran (poin)"));const st=E("input");st.type="number";st.inputMode="numeric";st.value=10;st.min=1;c.appendChild(st);
  c.appendChild(E("label","","Durasi"));const ch=E("div","chips");
  [3,5,10].forEach(n=>{const b=E("button","",n+" menit");b.setAttribute("aria-pressed",n===mins);b.onclick=()=>{mins=n;[...ch.children].forEach(x=>x.setAttribute("aria-pressed",x===b))};ch.appendChild(b)});c.appendChild(ch);
  c.appendChild(E("p","sm","File disimpan di profilmu dan baru dikirim ke pemenang. Jangan hapus sebelum terkirim."));
  const row=E("div","row"),go=E("button","g","Mulai lelang"),cn=E("button","w","Batal");
  go.onclick=async()=>{
    const t=ti.value.trim(),a=Math.floor(Number(sp.value)),b=Math.floor(Number(st.value));
    if(t.length<2)return toast("Judul minimal 2 huruf.");if(!file)return toast("Pilih file dulu.");if(!(a>=1&&b>=1))return toast("Harga dan kelipatan minimal 1.");
    go.disabled=true;try{await newAuction({title:t,file,start:a,step:b,mins});toast("Lelang dimulai.");view="room";render()}catch(e){go.disabled=false;fail(e)}
  };
  cn.onclick=()=>{view="room";render()};row.append(go,cn);c.appendChild(row);m.appendChild(c);
}
function fillAuc(){
  const box=$("#au");if(!box||!me)return;
  if(!box.firstChild){
    const c=E("div","card"),h=E("div","row");h.appendChild(E("h2","grow","Lelang"));const pc=E("span","pts");pc.id="mpts";h.appendChild(pc);c.appendChild(h);
    const nb=E("button","b s","Buat lelang");nb.onclick=()=>{view="newauction";render()};c.appendChild(nb);
    const em=E("div","empty","Belum ada lelang.");em.id="aem";em.style.marginTop="12px";c.appendChild(em);
    const ul=E("ul");ul.id="al";c.appendChild(ul);box.appendChild(c);
  }
  $("#mpts").textContent="Poinmu: "+myPts();
  const ul=$("#al"),ids=Object.keys(aucs).sort((x,y)=>aucs[y].created-aucs[x].created);
  $("#aem").hidden=ids.length>0;
  Object.keys(aEl).forEach(id=>{if(!aucs[id]){aEl[id].remove();delete aEl[id]}});
  ids.forEach((id,i)=>{if(!aEl[id])aEl[id]=buildAuc(id);if(ul.children[i]!==aEl[id])ul.insertBefore(aEl[id],ul.children[i]||null)});
  ids.forEach(updAuc);
}
function buildAuc(id){
  const a=aucs[id],li=E("li"),r={};
  li.appendChild(E("div","n",a.title));r.meta=E("div","sm");li.appendChild(r.meta);
  if(a.thumb){const i=E("img","thumb nocopy");i.src=a.thumb;i.alt="Pratinjau";i.draggable=false;i.oncontextmenu=e=>e.preventDefault();li.appendChild(i)}
  if(a.snip){const p=E("div","snip nocopy",a.snip);["copy","cut","contextmenu","selectstart","dragstart"].forEach(ev=>p.addEventListener(ev,e=>e.preventDefault()));li.appendChild(p)}
  r.top=E("div","atop");r.cd=E("div","acd");li.append(r.top,r.cd);
  r.row=E("div","row");r.inp=E("input");r.inp.type="number";r.inp.inputMode="numeric";r.inp.style.flex="1";r.inp.style.margin="0";r.inp.style.minWidth="0";
  const bt=E("button","g","Tawar");bt.onclick=()=>bid(id,Math.floor(Number(r.inp.value)));r.row.append(r.inp,bt);li.appendChild(r.row);
  const act=E("div","row");act.style.marginTop="8px";
  r.mf=E("button","b s","Minta file");r.mf.onclick=()=>{asked["A"+id]=true;sig(aucs[id].seller,{k:"aucask",aid:id,rid:curRoom});toast("Meminta file ke penjual...")};
  r.dl=E("button","p s","Hapus lelang");r.dl.onclick=()=>deleteDoc(aRef(curRoom,id)).catch(fail);
  act.append(r.mf,r.dl);li.appendChild(act);li.r=r;return li;
}
function updAuc(id){
  const a=aucs[id],li=aEl[id];if(!a||!li)return;
  const r=li.r,over=aOver(a),mine=a.seller===me.id;
  r.meta.textContent=(mine?"Kamu penjual":"Penjual: "+nm(a.seller))+" - "+a.name+" ("+fmt(a.size)+")";
  r.top.textContent=a.top.uid?"Tertinggi: "+nm(a.top.uid)+" - "+a.top.amount+" poin":"Belum ada tawaran. Mulai dari "+a.startPrice+" poin";
  r.cd.textContent=over?(a.top.uid?"Selesai. Pemenang: "+nm(a.top.uid):"Selesai. Tidak ada penawar"):"Sisa waktu "+mmss(aEnd(a)-Date.now());
  const min=a.top.uid?a.top.amount+a.step:a.startPrice;
  r.row.hidden=over||mine;r.inp.min=min;
  if(document.activeElement!==r.inp&&(!r.inp.value||Number(r.inp.value)<min))r.inp.value=min;
  r.mf.hidden=!(over&&a.top.uid===me.id);r.dl.hidden=!(mine&&!a.top.uid);
                                                                                            }
