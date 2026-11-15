const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let tok=sessionStorage.getItem('tok')||'',A=[];
const CATS={low:'Табысы төмен',family:'Отбасы және балалар',housing:'Тұрғын үй',disability:'Мүгедектік',work:'Жұмыспен қамту',elderly:'Зейнеткерлер',other:'Басқа'};
const FL=[['n','Атауы'],['d','Қысқаша сипаттама'],['w','Кімге арналған'],['f','Қажетті құжаттар'],['a','Қайда және қалай өтініш беру']];
const api=async(m,u,b)=>{const r=await fetch(u,{method:m,headers:{'content-type':'application/json','x-token':tok},body:b?JSON.stringify(b):undefined});const j=await r.json().catch(()=>({}));if(r.status===401&&tok){out()}if(!r.ok)throw j;return j};
function out(){tok='';sessionStorage.removeItem('tok');login()}
$('#out').onclick=out;
function login(msg=''){$('#out').hidden=true;$('#app').innerHTML=`<h2>Кіру</h2><p>${esc(msg)}</p><form class="f" id="lf"><label>Логин<input id="u" autocomplete="username"></label><label>Құпиясөз<input id="p" type="password" autocomplete="current-password"></label><button>Кіру</button></form>`;
 $('#lf').onsubmit=async e=>{e.preventDefault();try{const j=await api('POST','/api/login',{user:$('#u').value,pass:$('#p').value});tok=j.token;sessionStorage.setItem('tok',tok);list()}catch(x){login(x.error==='no_admin'?'.env файлында ADMIN_PASS көрсетілмеген.':x.error==='rate'?'Талпыныс тым көп. Сәл күтіңіз.':'Логин немесе құпиясөз қате.')}}}
async function list(){try{A=await api('GET','/api/admin/aids')}catch{return login()}
 $('#out').hidden=false;$('#app').innerHTML=`<h2>Көмек түрлері (${A.length})</h2><p><button id="new">+ Жаңа көмек түрі</button></p><table><tr><th>№</th><th>Атауы</th><th>Санат</th><th>Күйі</th><th></th></tr>${A.map(a=>`<tr><td>${a.id}</td><td>${esc(a.kk.n)}</td><td>${CATS[a.cat]}</td><td>${a.ok?'Расталған':'Тексерілмеген'}</td><td><button class="alt" data-e="${a.id}">Өзгерту</button></td></tr>`).join('')}</table>`;
 $('#new').onclick=()=>edit({id:0,cat:'other',kk:{},ru:{},src:'',chk:'',ok:false});
 document.querySelectorAll('[data-e]').forEach(b=>b.onclick=()=>edit(A.find(a=>a.id==b.dataset.e)))}
function edit(a){const fs=l=>FL.map(([k,n])=>`<div class="f"><label>${n} (${l==='kk'?'қазақша':'русский'})</label><textarea data-l="${l}" data-k="${k}">${esc((a[l]||{})[k])}</textarea></div>`).join('');
 $('#app').innerHTML=`<h2>${a.id?'№'+a.id:'Жаңа жазба'}</h2><div class="f"><label>Санат</label><select id="c">${Object.entries(CATS).map(([k,v])=>`<option value="${k}" ${k===a.cat?'selected':''}>${v}</option>`).join('')}</select></div>${fs('kk')}${fs('ru')}<div class="f"><label>Ресми дереккөз (сілтеме немесе атауы)</label><input id="s" value="${esc(a.src)}"></div><div class="f"><label>Соңғы тексерілген күн (ЖЖЖЖ-АА-КК)</label><input id="k" value="${esc(a.chk)}"></div><label class="opts" style="display:flex"><input type="checkbox" id="o" ${a.ok?'checked':''}> Ресми дереккөзбен тексерілді (расталған)</label><p class="row"><button id="sv">Сақтау</button><button class="alt" id="bk">Тізімге оралу</button>${a.id?'<button class="alt" id="dl">Жою</button>':''}</p><p id="st"></p>`;
 $('#bk').onclick=list;
 $('#sv').onclick=async()=>{const b={cat:$('#c').value,kk:{},ru:{},src:$('#s').value,chk:$('#k').value,ok:$('#o').checked};document.querySelectorAll('textarea').forEach(t=>b[t.dataset.l][t.dataset.k]=t.value);
  try{await api(a.id?'PUT':'POST','/api/admin/aids'+(a.id?'/'+a.id:''),b);list()}catch{$('#st').textContent='Сақтау мүмкін болмады.'}};
 if(a.id)$('#dl').onclick=async()=>{if(confirm('Жою керек пе?')){await api('DELETE','/api/admin/aids/'+a.id);list()}}}
tok?list():login();
