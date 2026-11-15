const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
try{for(const l of fs.readFileSync(path.join(__dirname,'.env'),'utf8').split(/\r?\n/)){const m=l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);if(m&&!(m[1] in process.env))process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')}}catch{}
const E=process.env,PORT=E.PORT||3000,SECRET=E.SECRET||crypto.randomBytes(24).toString('hex');
const SEED=path.join(__dirname,'data','aids.json'),DB=path.join(E.DATA_DIR||path.join(__dirname,'data'),'aids.json'),PUB=path.join(__dirname,'public');
if(DB!==SEED&&!fs.existsSync(DB)){fs.mkdirSync(path.dirname(DB),{recursive:true});fs.copyFileSync(SEED,DB)}
const CATS=['low','family','housing','disability','work','elderly','other'];
const load=()=>JSON.parse(fs.readFileSync(DB,'utf8')),save=a=>fs.writeFileSync(DB,JSON.stringify(a,null,1));
const S=(v,n=1500)=>String(v==null?'':v).slice(0,n);
const T=t=>{t=t||{};return{n:S(t.n,200),d:S(t.d),w:S(t.w),f:S(t.f),a:S(t.a)}};
const clean=(b,id)=>({id,cat:CATS.includes(b.cat)?b.cat:'other',kk:T(b.kk),ru:T(b.ru),src:S(b.src,300),chk:S(b.chk,20),ok:!!b.ok});
const sign=s=>crypto.createHmac('sha256',SECRET).update(s).digest('hex');
const mk=()=>{const e=Date.now()+8*36e5;return e+'.'+sign(String(e))};
const okTok=t=>{const[e,s]=String(t||'').split('.');return !!(e&&s&&s.length===64&&Number(e)>Date.now()&&crypto.timingSafeEqual(Buffer.from(s),Buffer.from(sign(e))))};
const h=x=>crypto.createHash('sha256').update(String(x)).digest();
const eq=(a,b)=>crypto.timingSafeEqual(h(a),h(b));
const hits={};const limited=(ip,k,n,ms)=>{const key=k+ip,now=Date.now();hits[key]=(hits[key]||[]).filter(t=>now-t<ms);if(hits[key].length>=n)return true;hits[key].push(now);return false};
const readBody=req=>new Promise((ok,no)=>{let d='';req.on('data',c=>{d+=c;if(d.length>2e5){no(new Error('big'));req.destroy()}});req.on('end',()=>{try{ok(d?JSON.parse(d):{})}catch{no(new Error('json'))}});req.on('error',no)});
async function chat(b){
 if(!E.ANTHROPIC_API_KEY)return[503,{error:'no_key'}];
 const lang=b.lang==='ru'?'ru':'kk';
 const msgs=(Array.isArray(b.messages)?b.messages:[]).slice(-10).map(m=>({role:m.role==='assistant'?'assistant':'user',content:S(m.content,1000)})).filter(m=>m.content);
 while(msgs.length&&msgs[0].role!=='user')msgs.shift();
 if(!msgs.length||msgs[msgs.length-1].role!=='user')return[400,{error:'bad'}];
 const kb=load().map(a=>{const t=a[lang].n?a[lang]:a.kk;return `#${a.id} [${a.cat}] ${t.n}\n${t.d||''}\nWho: ${t.w||'-'}\nDocuments: ${t.f||'-'}\nHow to apply: ${t.a||'-'}\nSource: ${a.src||'-'}; checked: ${a.chk||'never'}; status: ${a.ok?'verified':'UNVERIFIED'}`}).join('\n\n');
 const sys=`You are KOMEK AI, an information navigator about social support in Zhambyl region, Kazakhstan. Answer ONLY from the knowledge base below. Never invent amounts, dates, income thresholds, phone numbers or rules. If the base lacks the answer, the entry is UNVERIFIED, or its fields are empty, say so plainly and send the person to the official body (Zhambyl region Employment Coordination and Social Programs Department, tel. 8 (7262) 45-37-67, ukzsp_taraz@zhambyl.gov.kz) or eGov.kz. You do not grant benefits or decide eligibility: say "may suit you", never "you will receive". Never ask for IIN, bank data, exact income or medical documents. Reply in ${lang==='ru'?'Russian':'Kazakh'} unless the person writes in another language. Be brief, warm and plain; use short steps; name the source of each fact. Resident's district: ${S(b.district,40)||'unknown'}.\n\nKNOWLEDGE BASE:\n${kb}`;
 const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':E.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:E.CLAUDE_MODEL||'claude-sonnet-5-5',max_tokens:700,system:sys,messages:msgs})});
 const j=await r.json().catch(()=>({}));
 if(!r.ok){console.error('Claude API',r.status,j.error&&j.error.message);return[502,{error:'api'}]}
 return[200,{reply:(j.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n')}];
}
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
http.createServer(async(req,res)=>{
 const p=decodeURIComponent(new URL(req.url,'http://x').pathname),ip=req.socket.remoteAddress;
 const send=(c,o)=>{res.writeHead(c,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(o))};
 try{
  if(p.startsWith('/api/')){
   const body=['POST','PUT'].includes(req.method)?await readBody(req):{};
   if(p==='/api/aids'&&req.method==='GET')return send(200,load());
   if(p==='/api/chat'&&req.method==='POST'){if(limited(ip,'c',30,6e5))return send(429,{error:'rate'});const[c,o]=await chat(body);return send(c,o)}
   if(p==='/api/login'&&req.method==='POST'){
    if(!E.ADMIN_PASS)return send(503,{error:'no_admin'});
    if(limited(ip,'l',10,6e5))return send(429,{error:'rate'});
    return eq(body.user||'',E.ADMIN_USER||'admin')&eq(body.pass||'',E.ADMIN_PASS)?send(200,{token:mk()}):send(401,{error:'auth'});
   }
   if(p.startsWith('/api/admin/aids')){
    if(!okTok(req.headers['x-token']))return send(401,{error:'auth'});
    const id=Number(p.split('/')[4]),a=load();
    if(req.method==='GET')return send(200,a);
    if(req.method==='POST'){const n=clean(body,Math.max(0,...a.map(x=>x.id))+1);a.push(n);save(a);return send(200,n)}
    const i=a.findIndex(x=>x.id===id);if(i<0)return send(404,{error:'nf'});
    if(req.method==='PUT'){a[i]=clean(body,id);save(a);return send(200,a[i])}
    if(req.method==='DELETE'){a.splice(i,1);save(a);return send(200,{ok:1})}
   }
   return send(404,{error:'nf'});
  }
  let f=path.normalize(path.join(PUB,p==='/'?'index.html':p));
  if(!f.startsWith(PUB)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end('404')}
  res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);
 }catch(e){console.error(e.message);send(500,{error:'server'})}
}).listen(PORT,()=>console.log('KOMEK AI: http://localhost:'+PORT));
