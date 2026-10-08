(()=>{
'use strict';
const frame=document.getElementById('appFrame');
const installBtn=document.getElementById('installBtn');
const modal=document.getElementById('shellModal');
const modalBody=document.getElementById('shellModalBody');
const bioGate=document.getElementById('bioGate');
const bioStatus=document.getElementById('bioStatus');
const bioUnlock=document.getElementById('bioUnlock');
const bioPassword=document.getElementById('bioPassword');
let frameOrigin='*', installPrompt=null, platformBio=false, passwordMode=false, record=null;
const DB='purongair-device-v710', STORE='secure', RK='trustedBiometric', DK='deviceId';
const pending=new Map();

function toast(t){const n=document.createElement('div');n.className='toast';n.textContent=t;document.body.appendChild(n);setTimeout(()=>n.remove(),3200)}
function rid(){return 'r'+Date.now().toString(36)+Math.random().toString(36).slice(2)}
function b64u(a){let s='';new Uint8Array(a).forEach(b=>s+=String.fromCharCode(b));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function unb64u(s){s=String(s||'').replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const r=atob(s),o=new Uint8Array(r.length);for(let i=0;i<r.length;i++)o[i]=r.charCodeAt(i);return o}
function rand(n=32){return crypto.getRandomValues(new Uint8Array(n))}
function openDb(){return new Promise((ok,no)=>{const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains(STORE))q.result.createObjectStore(STORE)};q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})}
async function get(k){const d=await openDb();return new Promise((ok,no)=>{const q=d.transaction(STORE).objectStore(STORE).get(k);q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})}
async function put(k,v){const d=await openDb();return new Promise((ok,no)=>{const tx=d.transaction(STORE,'readwrite');tx.objectStore(STORE).put(v,k);tx.oncomplete=()=>ok();tx.onerror=()=>no(tx.error)})}
async function del(k){const d=await openDb();return new Promise((ok,no)=>{const tx=d.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(k);tx.oncomplete=()=>ok();tx.onerror=()=>no(tx.error)})}
async function key(){let k=await get('aesKey');if(!k){k=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);await put('aesKey',k)}return k}
async function enc(s){const k=await key(),iv=rand(12),c=await crypto.subtle.encrypt({name:'AES-GCM',iv},k,new TextEncoder().encode(s));return {iv:b64u(iv),data:b64u(c)}}
async function dec(x){if(!x)return '';const k=await key(),p=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64u(x.iv)},k,unb64u(x.data));return new TextDecoder().decode(p)}
async function deviceId(){let x=await get(DK);if(!x){x='dev-'+b64u(rand(18));await put(DK,x)}return x}
function deviceName(){const u=navigator.userAgent||'';if(/iPhone/i.test(u))return'iPhone';if(/iPad/i.test(u))return'iPad';if(/Android/i.test(u))return /Mobile/i.test(u)?'Android Phone':'Android Tablet';if(/Windows/i.test(u))return'Windows PC';if(/Mac/i.test(u))return'Mac';return'อุปกรณ์ของฉัน'}
async function bioSupport(){try{return !!(window.PublicKeyCredential&&PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable&&await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())}catch(e){return false}}
function standalone(){return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}
function post(type,payload={}){if(frame.contentWindow)frame.contentWindow.postMessage(Object.assign({source:'PURONGAIR_SHELL',type},payload),frameOrigin)}
function bridge(type,payload,responseType){const id=rid();return new Promise((ok,no)=>{const timer=setTimeout(()=>{pending.delete(id);no(new Error('ระบบตอบกลับช้าเกินไป'))},15000);pending.set(id,{type:responseType,ok:v=>{clearTimeout(timer);pending.delete(id);ok(v)},no:e=>{clearTimeout(timer);pending.delete(id);no(e)}});post(type,Object.assign({requestId:id},payload))})}
function settle(m){const p=pending.get(String(m.requestId||''));if(!p||p.type!==m.type)return false;if(m.ok===false)p.no(new Error(m.message||'ดำเนินการไม่สำเร็จ'));else p.ok(m);return true}
function showModal(html){modalBody.innerHTML=html;modal.hidden=false;modalBody.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>modal.hidden=true)}
function installHelp(note=''){showModal('<h2>ติดตั้ง PUROnGAIR</h2><img class="logo" src="icons/icon-192.svg" alt="logo"><p>'+note+'</p><p><b>Android / Chrome:</b> กด “ติดตั้งแอป” หรือเมนู ⋮ → ติดตั้งแอป</p><p><b>iPhone / iPad:</b> Safari → แชร์ → เพิ่มไปยังหน้าจอโฮม</p><button data-close>ปิด</button>')}
async function installApp(){if(standalone())return toast('ติดตั้งเป็นแอปอยู่แล้ว');if(installPrompt){installPrompt.prompt();const c=await installPrompt.userChoice;installPrompt=null;installBtn.hidden=true;toast(c.outcome==='accepted'?'กำลังติดตั้งแอป':'ยกเลิกการติดตั้ง');post('PURONGAIR_INSTALL_RESULT',{ok:c.outcome==='accepted'});return}installHelp('ถ้าปุ่มติดตั้งยังไม่ขึ้น ให้เปิดหน้านี้ด้วย Chrome โดยตรง ไม่ใช่เบราว์เซอร์ภายใน Facebook/LINE')}

async function loadRec(){record=await get(RK)||null;return record}
function validRec(){return !!(record&&record.credentialId&&record.tokenEnc&&record.deviceId)}
async function shellStatus(){await loadRec();post('PURONGAIR_SHELL_STATUS',{supported:platformBio,enrolled:!!(record&&record.credentialId),hasToken:validRec(),deviceName:record&&record.deviceName||deviceName(),standalone:standalone()})}
async function createCredential(user){const uid=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(user.id||user.email||'user')))).slice(0,32);const c=await navigator.credentials.create({publicKey:{challenge:rand(),rp:{name:'PUROnGAIR'},user:{id:uid,name:user.email||user.id,displayName:user.name||user.email||'PUROnGAIR'},pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],authenticatorSelection:{authenticatorAttachment:'platform',residentKey:'preferred',userVerification:'required'},attestation:'none',timeout:60000}});if(!c)throw new Error('ไม่ได้สร้างข้อมูลยืนยันอุปกรณ์');return b64u(c.rawId)}
async function verifyCredential(){if(!record||!record.credentialId)throw new Error('ยังไม่ได้เปิดใช้สแกนนิ้ว / ใบหน้า');const c=await navigator.credentials.get({publicKey:{challenge:rand(),allowCredentials:[{type:'public-key',id:unb64u(record.credentialId)}],userVerification:'required',timeout:60000}});if(!c)throw new Error('ยืนยันตัวตนไม่สำเร็จ')}
async function enroll(session){if(!platformBio)throw new Error('อุปกรณ์นี้ไม่รองรับสแกนนิ้ว / ใบหน้า');const credentialId=await createCredential(session.user||{}),did=await deviceId(),name=deviceName(),r=await bridge('PURONGAIR_TRUSTED_DEVICE_CREATE_REQUEST',{deviceId:did,deviceName:name,credentialId},'PURONGAIR_TRUSTED_DEVICE_CREATED');if(!r.deviceToken)throw new Error('ระบบไม่ได้คืนรหัสอุปกรณ์');record={credentialId,deviceId:did,deviceName:name,userId:session.user.id,tokenEnc:await enc(r.deviceToken),createdAt:new Date().toISOString()};await put(RK,record);await shellStatus();toast('เปิดใช้สแกนนิ้ว / ใบหน้าแล้ว')}
async function unlock(){bioUnlock.disabled=true;bioStatus.textContent='กำลังยืนยันตัวตน...';try{await loadRec();if(!validRec())throw new Error('กรุณาเข้าสู่ระบบด้วยรหัสผ่าน 1 ครั้ง');await verifyCredential();const t=await dec(record.tokenEnc);post('PURONGAIR_DEVICE_LOGIN',{deviceToken:t,deviceId:record.deviceId});bioStatus.textContent='ยืนยันสำเร็จ กำลังเข้าสู่ระบบ...'}catch(e){bioStatus.textContent=e.message;bioUnlock.disabled=false}}
function showBio(){if(passwordMode)return;bioGate.hidden=false;bioUnlock.disabled=false;bioStatus.textContent=''}
function hideBio(){bioGate.hidden=true;bioStatus.textContent=''}

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;if(!standalone())installBtn.hidden=false});
window.addEventListener('appinstalled',()=>{installPrompt=null;installBtn.hidden=true;toast('ติดตั้ง PUROnGAIR สำเร็จ')});
installBtn.onclick=installApp;
bioUnlock.onclick=unlock;
bioPassword.onclick=()=>{passwordMode=true;hideBio();post('PURONGAIR_BIOMETRIC_STATUS',{supported:platformBio,enrolled:!!(record&&record.credentialId),hasToken:false,deviceName:deviceName()})};
modal.onclick=e=>{if(e.target===modal)modal.hidden=true};

window.addEventListener('message',async e=>{if(e.source!==frame.contentWindow)return;const m=e.data||{};if(m.source!=='PURONGAIR')return;frameOrigin=e.origin;if(settle(m))return;
  if(m.type==='PURONGAIR_BRIDGE_READY'){await shellStatus();return}
  if(m.type==='PURONGAIR_BIOMETRIC_REQUIRED'){await loadRec();if(validRec()&&!passwordMode)showBio();return}
  if(m.type==='PURONGAIR_SESSION_READY'){hideBio();passwordMode=false;await loadRec();if(!record&&platformBio&&confirm('ต้องการเปิดใช้สแกนนิ้ว / ใบหน้า เพื่อเข้าระบบครั้งต่อไปให้เร็วขึ้นหรือไม่?')){try{await enroll(m)}catch(err){toast(err.message)}}return}
  if(m.type==='PURONGAIR_BIOMETRIC_ENROLL_REQUEST'){try{await enroll(m)}catch(err){toast(err.message)}return}
  if(m.type==='PURONGAIR_BIOMETRIC_STATUS_REQUEST'){await shellStatus();return}
  if(m.type==='PURONGAIR_SESSION_CLEAR'){await loadRec();if(validRec())showBio();return}
  if(m.type==='PURONGAIR_BIOMETRIC_LOGIN_OK'){hideBio();bioUnlock.disabled=false;toast('เข้าสู่ระบบด้วยสแกนนิ้ว / ใบหน้าแล้ว');return}
  if(m.type==='PURONGAIR_BIOMETRIC_TOKEN_REJECTED'){await del(RK);record=null;hideBio();passwordMode=true;toast('อุปกรณ์หมดอายุ กรุณาเข้าสู่ระบบด้วยรหัสผ่าน 1 ครั้ง');return}
  if(m.type==='PURONGAIR_INSTALL_REQUEST'||m.type==='PURONGAIR_INSTALL_CENTER_REQUEST'){installApp();return}
  if(m.type==='PURONGAIR_DEVICE_CENTER_REQUEST'){showModal('<h2>อุปกรณ์นี้</h2><p>'+(validRec()?'สแกนนิ้ว / ใบหน้าเปิดใช้อยู่':'ยังไม่ได้เปิดใช้สแกนนิ้ว / ใบหน้า')+'</p><button id="clearBio">ยกเลิกการจดจำเครื่องนี้</button><button data-close>ปิด</button>');const b=document.getElementById('clearBio');if(b)b.onclick=async()=>{await del(RK);record=null;modal.hidden=true;await shellStatus();toast('ยกเลิกการจดจำเครื่องนี้แล้ว')};return}
});

(async()=>{
  platformBio=await bioSupport();await loadRec();
  if('serviceWorker' in navigator){try{await navigator.serviceWorker.register('/airservice-online/sw.js',{scope:'/airservice-online/'})}catch(e){}}
  if(standalone())installBtn.hidden=true;
  if(validRec())showBio();
})();
})();