/* =====================================================================
   ДВИГУН
   ===================================================================== */
const app = document.getElementById('app');
const S = { role:null, i:0, infl:50, rep:100, repMin:100, streak:0, correct:0, total:0,
            picks:new Set(), audience:null, cons:0, results:[], badges:[], usedWild:[], timerCut:0, lastTechPos:-1,
            feed:[], osintLeft:2, osintTotal:2, osintDone:new Set(), op1Bad:false };
let timerInt=null, wtimerInt=null;

/* =====================================================================
   ЗВУК (задача 8). Файлів може не бути — .play() тоді відхиляється
   промісом, catch() ковтає це мовчки, гра лишається повністю робочою.
   ===================================================================== */
const SFX_FILES = {
  click:"assets/sfx/click.ogg", tick:"assets/sfx/tick.ogg", alert:"assets/sfx/alert.ogg",
  gain:"assets/sfx/gain.ogg", loss:"assets/sfx/loss.ogg", badge:"assets/sfx/badge.ogg",
  result:"assets/sfx/result.ogg"
};
const SFX = (function(){
  let muted = false, unlocked = false, ambientWanted = false, introWanted = false;
  const ambient = new Audio('assets/sfx/ambient.ogg');
  const bossAmbient = new Audio('assets/sfx/boss_ambient.ogg');
  const introMusic = new Audio('assets/sfx/intro.ogg');
  [ambient, bossAmbient, introMusic].forEach(a=>{ a.loop = true; a.volume = 0; a.preload = 'auto'; });
  /* setInterval, а не requestAnimationFrame: rAF повністю зупиняється в неактивній
     вкладці, і гучність застрягала б на нулі. setInterval лише тротлиться, тому
     фейд завжди рано чи пізно доходить до цілі. */
  function fadeTo(el, target, ms){
    if(el._fadeInt) clearInterval(el._fadeInt);
    const start = el.volume, t0 = Date.now();
    el._fadeInt = setInterval(()=>{
      const p = Math.min(1, (Date.now()-t0)/ms);
      el.volume = start + (target-start)*p;
      if(p>=1){ clearInterval(el._fadeInt); el._fadeInt=null; }
    }, 50);
  }
  function unlock(){                          // перший клік користувача знімає блокування автоплею
    if(unlocked) return; unlocked = true;
    if(ambientWanted && ambient.paused) ambient.play().catch(()=>{});
    if(introWanted && introMusic.paused) introMusic.play().catch(()=>{});
  }
  function play(name){
    if(muted) return;
    const src = SFX_FILES[name]; if(!src) return;
    try{ const a = new Audio(src); a.volume = 0.55; a.play().catch(()=>{}); }catch(e){}
  }
  /* .paused-перевірка: повторний виклик не має ще раз смикати play() на вже граючому треку. */
  function startAmbient(){
    ambientWanted = true;
    if(unlocked && ambient.paused) ambient.play().catch(()=>{});
    fadeTo(ambient, muted?0:0.34, 900);
  }
  // Вступна катсцена (задача 7): свій трек, окремий від геймплейного амбієнту.
  function startIntroMusic(){
    introWanted = true;
    if(unlocked && introMusic.paused) introMusic.play().catch(()=>{});
    fadeTo(introMusic, muted?0:0.34, 900);
  }
  function crossfadeToBoss(){
    fadeTo(ambient, 0, 1500);
    if(unlocked && bossAmbient.paused) bossAmbient.play().catch(()=>{});
    fadeTo(bossAmbient, muted?0:0.34, 1500);
  }
  function crossfadeToAmbient(){
    fadeTo(bossAmbient, 0, 1500);
    if(unlocked && ambient.paused) ambient.play().catch(()=>{});
    fadeTo(ambient, muted?0:0.34, 1500);
  }
  // Перехід катсцена → мапа кампанії: кросфейд intro.ogg у геймплейний ambient.
  function crossfadeIntroToAmbient(){
    introWanted = false;
    fadeTo(introMusic, 0, 1500);
    if(unlocked && ambient.paused) ambient.play().catch(()=>{});
    ambientWanted = true;
    fadeTo(ambient, muted?0:0.34, 1500);
    setTimeout(()=>{ if(introWanted) return; try{ introMusic.pause(); introMusic.currentTime=0; }catch(e){} }, 1550);
  }
  function stopAmbient(){
    ambientWanted = false; introWanted = false;
    fadeTo(ambient, 0, 400); fadeTo(bossAmbient, 0, 400); fadeTo(introMusic, 0, 400);
    setTimeout(()=>{ if(ambientWanted || introWanted) return; try{ ambient.pause(); bossAmbient.pause(); introMusic.pause(); ambient.currentTime=0; bossAmbient.currentTime=0; introMusic.currentTime=0; }catch(e){} }, 450);
  }
  function setMuted(v){
    muted = v; ambient.muted = v; bossAmbient.muted = v; introMusic.muted = v;
    // M2: unmute мав лишати трек на гучності 0 — дофейдити активний трек назад до робочого рівня
    if(!v && ambientWanted){
      const active = document.body.classList.contains('boss-mode') ? bossAmbient : ambient;
      fadeTo(active, 0.34, 900);
    }
    if(!v && introWanted) fadeTo(introMusic, 0.34, 900);
  }
  function toggle(){ setMuted(!muted); return muted; }
  return { play, startAmbient, startIntroMusic, crossfadeToBoss, crossfadeToAmbient, crossfadeIntroToAmbient, stopAmbient, toggle, unlock, isMuted:()=>muted };
})();
function toggleSfx(){
  SFX.unlock();
  const muted = SFX.toggle();
  const btn = document.getElementById('sfxBtn'); if(btn) btn.textContent = muted?'🔇':'🔊';
}
/* Клік по кнопках/опціях = звук click; той самий жест знімає блокування автоплею браузера. */
document.addEventListener('click', function(e){
  SFX.unlock();
  // .dialogue-box навмисно без звуку: перемикання реплік не повинно клацати
  if(e.target.closest('.btn,.opt,.mode,.msg,.osint-btn,.role-card,.intro-skip,.osint-x,.sfx-btn,.narr-card,.hint-panel')) SFX.play('click');
}, true);

function clamp(v){return Math.max(4,Math.min(100,v))}
function pen(v){ return Math.round(v * S.role.pen); } /* v від'ємне */
function gainAdj(v, isCounter){
  let m = 1;
  if(S.streak>=5) m=2; else if(S.streak>=3) m=1.5;
  v = Math.round(v*m);
  if(isCounter && S.rep<50){ v = Math.ceil(v/2); setTimeout(()=>toast('Довіра низька: вам менше вірять','minus0'),1700); }
  return v;
}
/* =====================================================================
   ВБУДОВАНИЙ ТУТОРІАЛ (задача 11): підказки Інструктора в операції 1.
   Показуються один раз за тригер, і лише в першому проходженні кампанії
   за сесію ("ЩЕ РАЗ" підказок не показує) — тому стан тримаємо поза S,
   резет кампанії (resetState) його не чіпає, так само як introSeen.
   ===================================================================== */
let tutorialDone = false;
const hintsShown = new Set();
let hintQueue = [], hintBusy = false;
function showHint(id, force){
  if(hintsShown.has(id)) return;
  if(!force && tutorialDone) return;
  const t = TUTORIAL.find(x=>x.id===id); if(!t) return;
  hintsShown.add(id);
  hintQueue.push({id, text:t.text});
  if(!hintBusy) advanceHintQueue();
}
function advanceHintQueue(){
  if(!hintQueue.length){ hintBusy=false; return; }
  hintBusy = true;
  const {id, text} = hintQueue.shift();
  // у фазі контрнаративу перша підказка морозить таймер, щоб не з'їдати час гравця.
  // Заморозка стається до першого тіку, тому без підпису здається, що таймер "не запустився" —
  // явно показуємо паузу, щоб це читалось як стан, а не поломка.
  const freeze = (id==='counter_enter' && timerInt);
  const freezeWild = (id==='wildcard_first' && wtimerInt);   // FIX 2б: той самий патерн заморозки для choice-wildcard
  if(freeze){
    clearInterval(timerInt); timerInt=null;
    const note = document.querySelector('.timer .note'); if(note) note.textContent = '⏸ пауза: підказка Інструктора';
  }
  if(freezeWild){ clearInterval(wtimerInt); wtimerInt=null; }
  const wrap = document.createElement('div');
  wrap.className = 'hint-panel';
  wrap.innerHTML =
      '<div class="hint-panel-top">'
    +   '<div class="hint-portrait"><div class="hint-silhouette"></div><img src="assets/instructor_1.png" alt="" onerror="this.remove()"></div>'
    +   '<div class="hint-body"><div class="hint-name">ІНСТРУКТОР</div><div class="hint-text">'+text+'</div></div>'
    + '</div>'
    + '<button class="hint-ok">OK</button>';
  wrap.addEventListener('click', ()=>{
    if(!wrap.parentNode) return;
    wrap.classList.remove('show');
    setTimeout(()=>{
      wrap.remove();
      // відновити таймер лише якщо гравець ще не відповів (не встиг натиснути опцію)
      if(freeze && !S._counterDone && S._timeLeft>0 && document.getElementById('timerT')){
        const note = document.querySelector('.timer .note'); if(note) note.textContent = 'вакуум працює на ворога';
        startTimer(S._timeLeft, S._op.timeTotal);
      }
      if(freezeWild && !S._wildDone && S._wildLeft>0 && document.getElementById('wT')){
        startWildTimer(S._wildLeft, 15);
      }
      advanceHintQueue();
    }, 250);
  });
  document.body.appendChild(wrap);
  // верхній правий кут, нижче HUD: top = фактичний низ топбару (якщо він видимий).
  // На мобілі (≤560px) inline-top не виставляється — позицію повністю тримає CSS bottom.
  if(window.innerWidth > 560){
    const topbarEl = document.getElementById('topbar');
    const topOffset = (topbarEl && topbarEl.style.display!=='none') ? Math.max(8, topbarEl.getBoundingClientRect().bottom+8) : 16;
    wrap.style.top = topOffset+'px';
  }
  requestAnimationFrame(()=>wrap.classList.add('show'));
}

function setInfl(delta,label,sfx){
  S.infl = clamp(S.infl + delta);
  const m = document.getElementById('inflMarker'), f = document.getElementById('inflFill'), n = document.getElementById('inflNum');
  m.style.left = 'calc('+S.infl+'% - 3px)';
  f.style.clipPath = 'inset(0 '+S.infl+'% 0 0)';
  n.textContent = S.infl;
  if(delta!==0){
    toast((delta>0?'+':'')+delta+' '+(label||''), delta>0);
    if(sfx!==false) SFX.play(sfx || (delta>0?'gain':'loss'));
    // відкладено на макротаск: launchAttack() викликає setInfl, а одразу після — phaseFeed(),
    // чий render() чистить чергу підказок. Без затримки ця підказка вбивала б сама себе.
    if(delta<0 && S.i===0) setTimeout(()=>showHint('infl_drop'),0);
  }
  hud();
}
function setRep(delta){
  if(!delta) return;
  const before = S.rep;
  S.rep = Math.max(0,Math.min(100,S.rep+delta));
  const applied = S.rep - before;
  if(!applied) return;   // вже на межі 0/100, реальної зміни нема — тост зайвий
  if(S.rep < S.repMin) S.repMin = S.rep;
  toast('ДОВІРА '+(applied>0?'+':'')+applied, applied>0);
  if(S.i===0) showHint('rep_change');
  hud();
}
function hud(){
  const st=document.getElementById('hudStreak'), rp=document.getElementById('hudRep'), bd=document.getElementById('hudBadges');
  if(!st) return;
  const av=document.getElementById('hudAvatar');
  if(av) av.innerHTML = S.role ? avatarHTML(S.role,'av-sm') : '';
  let mult = S.streak>=5?' ×2':(S.streak>=3?' ×1.5':'');
  st.textContent = 'СЕРІЯ '+S.streak+mult;
  st.className = 'streak'+(S.streak>=3?'':' cold');
  rp.textContent = 'ДОВІРА '+S.rep;
  rp.className = 'rep'+(S.rep<50?' low':'');
  bd.innerHTML = '<span>'+SCENARIOS.map(sc=>S.badges.includes(sc.badge)?'▣':'▢').join('')+'</span>';
}
/* M5: черга тостів — активний тост дограє свій час, наступний чекає в масиві
   й показується після нього, замість того щоб перебивати поточний. */
let toastQueue = [], toastBusy = false;
function toast(txt,plus){
  toastQueue.push({txt,plus});
  if(!toastBusy) processToastQueue();
}
function processToastQueue(){
  if(!toastQueue.length){ toastBusy=false; return; }
  toastBusy = true;
  const {txt,plus} = toastQueue.shift();
  const t=document.getElementById('toast');
  t.textContent=txt; t.className='toast show '+(plus===true||plus==='plus'?'plus':'minus');
  setTimeout(()=>{
    t.classList.remove('show');
    setTimeout(processToastQueue, 400);
  }, 1700);
}
function prog(){ document.getElementById('prog').textContent = (S.i+1)+'/'+SCENARIOS.length; }
function render(html){ stopAllTimers(); stopBossGlitch(); document.querySelectorAll('.osint-modal').forEach(e=>e.remove()); document.querySelectorAll('.hint-panel').forEach(e=>e.remove()); hintQueue=[]; hintBusy=false; toastQueue=[]; app.innerHTML = '<div class="screen">'+html+'</div>'; window.scrollTo({top:0}); }
function shuffled(n){ const a=[...Array(n).keys()]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
function stopAllTimers(){ if(timerInt){clearInterval(timerInt);timerInt=null;} if(wtimerInt){clearInterval(wtimerInt);wtimerInt=null;} if(S._viewsInt){clearInterval(S._viewsInt);S._viewsInt=null;} }

/* Задача 12, блок А: таймер рахує залишок від реального часу (Date.now()),
   а не декрементом на кожне спрацювання setInterval. У фоновій/неактивній
   вкладці браузер тротлить інтервали, тож раніше "left--" рахував ЧИСЛО
   тіків замість секунд, і таймер відставав або зависав. Тепер, скільки б
   тіків не пропустив тротлінг, наступний виклик доганяє реальний залишок. */
function startTimer(seconds, total){
  total = total || seconds;   // total лишається сталим при відновленні після заморозки підказкою
  const startedAt = Date.now();
  let lastLeft = seconds;
  let vacuumStarted = false, vacuumTicksApplied = 0;
  S._timeLeft = seconds;
  const el=document.getElementById('timerT'), bar=document.getElementById('timerBar'), box=document.getElementById('timerBox');
  function tick(){
    const elapsed = Math.floor((Date.now()-startedAt)/1000);
    const left = Math.max(0, seconds-elapsed);
    S._timeLeft = left;
    if(left<=0){
      // FIX 1: на нулі тиск не зникає — вакуум-режим триває, поки гравець не відповість
      if(!vacuumStarted){
        vacuumStarted = true;
        setRep(-3);   // жива довіра: промовчав у вакуумі
        if(S._op) S._op.timedOut = true;   // PATCH B1: таймаут = помилка
        if(el) el.textContent = 'ВАКУУМ';
        if(bar) bar.style.width = '0%';
        if(box) box.classList.add('hot');
        const note = document.querySelector('.timer .note'); if(note) note.textContent = 'ворог заповнює тишу';
      }
      const vacElapsed = elapsed - seconds;
      const dueTicks = Math.floor(vacElapsed/5);
      // PATCH: агрегація catch-up тостів — один виклик на всі пропущені тіки замість N
      const n = dueTicks - vacuumTicksApplied;
      if(n>0){ vacuumTicksApplied = dueTicks; setInfl(pen(-5)*n,'Вакуум'); }   // PATCH B2: буст вакууму
      lastLeft = 0;
      return;
    }
    if(el) el.textContent = left;
    if(bar) bar.style.width = (left/total*100)+'%';
    if(left<=12 && box) box.classList.add('hot');
    // побічні ефекти прив'язані до КОЖНОЇ цілої секунди, яку таймер щойно перетнув —
    // навіть якщо тротлінг фонової вкладки "проскочив" одразу кілька секунд за раз.
    // PATCH: тик-звук і штраф інфовакууму агрегуються — один тост/один звук на весь
    // пропущений діапазон, а не по одному на кожну перетнуту секунду.
    const spanCovered = lastLeft - left;
    let count = 0, tickPlayed = false;
    for(let s=lastLeft-1; s>=left; s--){
      if(s<=10 && s>0){
        if(spanCovered>3){ if(!tickPlayed){ SFX.play('tick'); tickPlayed=true; } }
        else SFX.play('tick');
      }
      if(s>0 && s%9===0) count++;
    }
    if(count>0) setInfl(pen(-2)*count,'Інфовакуум',false);
    lastLeft = left;
  }
  timerInt = setInterval(tick, 1000);
}

/* ---------- Бос-глітч (задача 8.3): RGB-зсув + jitter, 300-400мс кожні 3-5с ---------- */
let glitchTimeout = null;
function initGlitch(selector){
  stopBossGlitch();
  scheduleGlitch(selector);
}
function scheduleGlitch(selector){
  glitchTimeout = setTimeout(()=>{
    document.querySelectorAll(selector).forEach(el=>el.classList.add('glitch-active'));
    const dur = 300 + Math.random()*100;
    setTimeout(()=>{ document.querySelectorAll(selector).forEach(el=>el.classList.remove('glitch-active')); }, dur);
    scheduleGlitch(selector);
  }, 3000 + Math.random()*2000);
}
function stopBossGlitch(){
  if(glitchTimeout){ clearTimeout(glitchTimeout); glitchTimeout=null; }
  document.querySelectorAll('.glitch-active').forEach(el=>el.classList.remove('glitch-active'));
}

/* ---------- Екрани ---------- */
function modeSelect(){
  document.getElementById('topbar').style.display='none';
  render(`
    <div class="title-screen" style="padding-top:7vh">
      <div class="eyebrow">ПЛАТФОРМА ТРЕНУВАННЯ ІНФОСТІЙКОСТІ</div>
      <h1><span style="color:var(--gold)">ІПСО</span>МНІЯ</h1>
      <p class="lead">Одне ядро зі спільною моделлю аудиторії та наративів. Режими працюють як контент-паки поверх нього.</p>
      <div class="modes">
        <button class="mode" onclick="startIntro()">
          <span class="mode-badge live px">ГРАТИ</span>
          <div class="mode-name">ІНФОСТІЙКІСТЬ</div>
          <div class="mode-desc">Базовий режим для будь-кого. Розпізнавання ворожих наративів, аналіз технік, контрнаративи. Кампанія з 6 операцій.</div>
        </button>
        <div class="mode locked" aria-disabled="true">
          <span class="mode-badge lock px">СКОРО</span>
          <div class="mode-name">МОБІЛЬНІ ГРУПИ</div>
          <div class="mode-desc">Для виїзних мистецьких груп: читання аудиторії за чотирма шкалами, побудова програми, адаптація на ходу. На базі карткової версії.</div>
        </div>
        <div class="mode locked" aria-disabled="true">
          <span class="mode-badge lock px">СКОРО</span>
          <div class="mode-name">МІЖНАРОДНИЙ</div>
          <div class="mode-desc">Дипломатичні та медійні сценарії для скептичних аудиторій. Прев'ю вже всередині базового режиму, операція 4.</div>
        </div>
        <div class="mode locked" aria-disabled="true">
          <span class="mode-badge lock px">СКОРО</span>
          <div class="mode-name">ЧЕРВОНА КОМАНДА</div>
          <div class="mode-desc">Зворотний режим: сконструюй ІПСО сам. Ціль, емоція, техніка, канал. Найшвидший шлях зрозуміти захист, це раз побувати атакою.</div>
        </div>
      </div>
      <div class="footer-note">ІПСОМНІЯ v0.3 · DEMO BUILD · КУЛЬТУРНІ СИЛИ</div>
    </div>`);
}

/* =====================================================================
   ВСТУПНА КАТСЦЕНА · Інструктор (задача 7)
   ===================================================================== */
let introSeen = false;          // показуємо один раз за сесію, без localStorage
let introState = null;          // {line, full, pos, done, typeInt}
let talkInt = null, talkIdx = 0;
const talkSeq = [1,2,3,2];
let blinkTimeout = null;
let instrImgOk = true;

/* Портрет інструктора. Якщо файлів instructor_N.png ще нема — лишається
   піксельний силует, бо onerror лише ховає <img>, нічого не ламає.
   PATCH F2: раніше onerror будь-якого кадру (найчастіше 4-го, блимання)
   ховав img назавжди. Тепер кожен кадр перевіряється окремо через
   preloadFrames, і відсутність одного кадру не вбиває анімацію решти. */
let framesOK = {};   // src -> true після успішного завантаження
function preloadFrames(frames){
  framesOK = {};
  frames.forEach(src=>{ const im=new Image(); im.onload=()=>{framesOK[src]=true;}; im.src=src; });
}
function instructorHTML(){
  return '<div class="instr-portrait" id="instrPortrait">'
       +   '<div class="instr-silhouette"></div>'
       +   '<img id="instrImg" src="'+activePortrait[0]+'" alt="" onerror="instrImgFailed()">'
       + '</div>';
}
function instrImgFailed(){
  const im = document.getElementById('instrImg');
  if(im && framesOK[activePortrait[0]]){ im.src = activePortrait[0]; return; }  // відкат на кадр 1
  instrImgOk = false; if(im) im.style.display='none';                            // нема навіть кадру 1 — силует
}
function setInstrFrame(n){
  if(!instrImgOk) return;
  const src = activePortrait[n-1];
  if(!framesOK[src]) return;              // кадру нема — лишаємось на поточному, без onerror-смерті
  const im = document.getElementById('instrImg'); if(im) im.src = src;
}
function startTalkAnim(){
  stopTalkAnim();
  talkIdx = 0; setInstrFrame(talkSeq[0]);
  talkInt = setInterval(()=>{
    talkIdx = (talkIdx+1) % talkSeq.length;
    setInstrFrame(talkSeq[talkIdx]);
  }, 140);
}
function stopTalkAnim(){ if(talkInt){ clearInterval(talkInt); talkInt=null; } }
function scheduleBlink(){
  if(blinkTimeout) clearTimeout(blinkTimeout);
  blinkTimeout = setTimeout(()=>{
    if(!introState || !introState.done) return;
    setInstrFrame(4);
    setTimeout(()=>{ if(introState && introState.done) setInstrFrame(1); }, 120);
    scheduleBlink();
  }, 3000 + Math.random()*2000);
}
function clearIntroTimers(){
  if(introState && introState.typeInt){ clearInterval(introState.typeInt); introState.typeInt=null; }
  stopTalkAnim();
  if(blinkTimeout){ clearTimeout(blinkTimeout); blinkTimeout=null; }
}

/* Задача 12, Г9: та сама діалогова система обслуговує і вступ, і катсцену
   перед босом — activeDialogue/dialogueDoneCb визначають, які репліки
   програти і що робити після (roleSelect чи запуск операції боса). */
let activeDialogue = DIALOGUE;
let dialogueDoneCb = roleSelect;
let activePortrait = INSTRUCTOR.frames, activeSpeaker = 'ІНСТРУКТОР';
function renderDialogueScreen(){
  preloadFrames(activePortrait);
  instrImgOk = true;
  introState = null;
  render(`
    <div class="intro-screen">
      <button class="intro-skip px" onclick="skipIntro()">SKIP ▸</button>
      ${instructorHTML()}
      <div class="dialogue-box" id="dlgBox" onclick="advanceDialogue()" role="button" tabindex="0"
           onkeydown="if(event.key==='Enter'||event.key===' ')advanceDialogue()">
        <div class="dlg-name px">${activeSpeaker}</div>
        <div class="dlg-text" id="dlgText"></div>
        <div class="dlg-next" id="dlgNext">▼</div>
      </div>
    </div>`);
  playLine(0);
}
function startIntro(){
  if(introSeen){ roleSelect(); return; }
  SFX.startIntroMusic();   // окремий трек для катсцени, стартує разом із нею, не чекає вибору ролі
  activeDialogue = DIALOGUE;
  dialogueDoneCb = ()=>{ introSeen=true; roleSelect(); };
  activePortrait = INSTRUCTOR.frames; activeSpeaker = 'ІНСТРУКТОР';
  renderDialogueScreen();
}
/* Тригер: клік «ФІНАЛЬНА ОПЕРАЦІЯ» на мапі, перед запуском операції боса. */
function startBossIntro(){
  activeDialogue = BOSS_DIALOGUE;
  dialogueDoneCb = startScenario;
  activePortrait = BOSS_CHAR.frames; activeSpeaker = BOSS_CHAR.name;
  document.body.classList.add('boss-mode');   // фон уже червоний до входу в операцію; startScenario підтвердить клас
  SFX.crossfadeToBoss();
  renderDialogueScreen();
  const p = document.getElementById('instrPortrait');
  if(p){ p.classList.add('glitch-target'); initGlitch('.glitch-target'); }
}
function playLine(idx){
  clearIntroTimers();
  introState = { line: idx, full: activeDialogue[idx], pos: 0, done: false, typeInt: null };
  const textEl = document.getElementById('dlgText'), nextEl = document.getElementById('dlgNext');
  textEl.textContent = ''; nextEl.classList.remove('show');
  startTalkAnim();
  introState.typeInt = setInterval(()=>{
    introState.pos++;
    textEl.textContent = introState.full.slice(0, introState.pos);
    if(introState.pos >= introState.full.length) finishLine();
  }, 25);
}
function finishLine(){
  if(introState.typeInt){ clearInterval(introState.typeInt); introState.typeInt=null; }
  introState.done = true;
  stopTalkAnim();
  setInstrFrame(1);
  scheduleBlink();
  const nextEl = document.getElementById('dlgNext'); if(nextEl) nextEl.classList.add('show');
}
function advanceDialogue(){
  if(!introState) return;
  if(!introState.done){
    const textEl = document.getElementById('dlgText'); if(textEl) textEl.textContent = introState.full;
    finishLine();
    return;
  }
  const next = introState.line + 1;
  if(next < activeDialogue.length) playLine(next); else skipIntro();
}
/* Один обробник на SKIP і на природне завершення репліки: обидва просто
   переходять до того, що призначено в dialogueDoneCb. */
function skipIntro(){ clearIntroTimers(); dialogueDoneCb(); }

/* Портрет ролі. Якщо файлу в assets ще нема — лишається піксельний плейсхолдер
   (ініціали на кольоровому квадраті), бо onerror прибирає лише <img>. */
function avatarHTML(r, cls){
  return '<span class="avatar '+(cls||'')+'" style="--acol:'+r.col+'">'
       +   '<span class="avatar-ini">'+r.ini+'</span>'
       +   '<img src="'+r.img+'" alt="" onerror="this.remove()">'
       + '</span>';
}

function roleSelect(){
  render(`
    <div style="padding-top:4vh">
      <div class="eyebrow">ОБЕРИ РОЛЬ</div>
      <h2>Хто ти в цій кампанії?</h2>
      <p class="lead">Роль визначає темп і ціну помилки. Ворожі наративи не схожі на пропаганду: вони схожі на інсайд, на обережного експерта, на голос миру. Твоя робота: знайти їх у стрічці, назвати техніку і встигнути з контрходом, поки вакуум не заповнив ворог.</p>
      <div class="modes">
        ${ROLES.map((r,i)=>`
          <button class="mode role-card" onclick="pickRole(${i})">
            ${avatarHTML(r,'av-lg bob')}
            <div class="role-text">
              <div class="mode-name">${r.n}</div>
              <div class="mode-desc">${r.d}</div>
              <div class="role-stats">${r.stats}</div>
            </div>
          </button>`).join('')}
      </div>
      <button class="btn ghost" onclick="modeSelect()">НАЗАД</button>
    </div>`);
}
function pickRole(i){
  S.role = ROLES[i];
  document.getElementById('topbar').style.display='block';
  hud();
  SFX.crossfadeIntroToAmbient();   // перехід на мапу кампанії: кросфейд intro.ogg → ambient.ogg
  campaignMap();
}

function campaignMap(cliff){
  prog();
  const isBoss = S.i===SCENARIOS.length-1;
  const btnLabel = isBoss ? 'ФІНАЛЬНА ОПЕРАЦІЯ' : 'ОПЕРАЦІЯ '+(S.i+1);
  render(`
    <div class="eyebrow">МАПА КАМПАНІЇ</div>
    <div class="map-geo">
      <img class="map-bg" src="assets/map_ukraine.png" alt="" onerror="this.remove()">
      ${SCENARIOS.map((sc,idx)=>{
        const st = idx<S.i?'done':(idx===S.i?'cur':'locked');
        const click = idx===S.i ? ` onclick="${sc.boss?'startBossIntro()':'startScenario()'}"` : '';
        return `<div class="gnode ${st}${sc.boss?' gboss':''}" style="left:${sc.map.x}%;top:${sc.map.y}%"${click} ${idx===S.i?'role="button" tabindex="0"':''}>
          <div class="dot${sc.boss?' glitch-target':''}">${idx<S.i?'✓':(sc.boss?'☠':(idx===S.i?idx+1:'▒'))}</div>
          <div class="nlabel">${idx<=S.i?sc.node:'???'}</div>
        </div>`;
      }).join('')}
    </div>
    ${cliff?`<div class="cliff"><b>ТИМ ЧАСОМ</b>${cliff}</div>`:''}
    <button class="btn" onclick="${isBoss?'startBossIntro()':'startScenario()'}">${btnLabel} ▸</button>`);
  initGlitch('.glitch-target');
}

function startScenario(){
  prog();
  const sc = SCENARIOS[S.i];
  S.picks = new Set(); S.audience = null; S.timerCut = 0;
  // робоча стрічка операції. Мутація (задача 6): якщо операцію 1 закрито погано,
  // у фінал додається наратив-відлуння блекауту як звичайний тонкий наратив.
  S.feed = sc.feed.slice();
  if(sc.mutation && S.op1Bad) S.feed.push(sc.mutation);
  // ресурс OSINT (задача 4, задача 12 Д10): 2 перевірки джерела на операцію, у боса 3
  S.osintTotal = sc.boss ? 3 : 2;
  S.osintLeft = S.osintTotal; S.osintDone = new Set();
  // пам'ять вибору для блоку «РОЗКРИТІ НАРАТИВИ» (задача 9), наповнюється у resolveFeed
  S._recognized = [];
  S._techAnswered = false;   // підтипи наративів з'являються лише після фази 2 (задача 12, Б4)
  // дані для рангу поточної операції
  S._op = {found:0, total:0, false:0, miss:0, techOK:false, counter:'', timeLeft:0, timeTotal:0};
  // знімок стану на старті операції — щоб «перепройти» без скидання кампанії
  S._snap = { infl:S.infl, rep:S.rep, repMin:S.repMin, streak:S.streak, correct:S.correct, total:S.total,
              cons:S.cons, resultsLen:S.results.length, badges:S.badges.slice(),
              usedWild:S.usedWild.slice(), lastTechPos:S.lastTechPos };
  document.body.classList.toggle('boss-mode', !!sc.boss);
  if(sc.boss) SFX.crossfadeToBoss();
  render(`
    <div class="eyebrow">ОПЕРАЦІЯ ${S.i+1}${sc.international?' · ПРЕВ\u0027Ю МІЖНАРОДНОГО АДДОНУ':''}${sc.boss?' · ФІНАЛ':''}</div>
    <h2 class="${sc.boss?'glitch-target':''}">${sc.title}</h2>
    ${sc.art?'<img class="op-art" src="'+sc.art+'" alt="" onerror="this.remove()">':''}
    <div class="card"><p style="line-height:1.6;font-size:15px">${sc.brief}</p></div>
    <button class="btn" onclick="launchAttack()">ВІДКРИТИ СТРІЧКУ</button>`);
  if(sc.boss) initGlitch('.glitch-target');
  if(sc.boss) showHint('boss_brief', true);
}

function launchAttack(){
  const sc = SCENARIOS[S.i];
  // жива довіра (задача 10): другий поріг, <30 -> вкид на старті операції б'є сильніше
  const lowTrust = S.rep < 30;
  const atk = lowTrust ? Math.round(sc.attack*1.25) : sc.attack;
  setInfl(pen(atk),'Атаку запущено','alert');
  if(lowTrust) setTimeout(()=>toast('Вам не вірять. Вкидам вірять охочіше','minus0'),1700);
  phaseFeed();
}

function phaseFeed(){
  const sc = SCENARIOS[S.i];
  const feed = S.feed;
  // FIX 4: у боса пара пост↔стемп несе сюжет (Пн вкид → Вт експерт → Ср медіа) — не шафлити,
  // щоб хронологія лишилась авторською. В операціях 1-3 шафл лишається.
  S._feedOrder = sc.boss ? [...Array(feed.length).keys()] : shuffled(feed.length);
  S._feedStamps = feed.map(m=>m.m);       // таймстемпи в авторському (хронологічному) порядку
  S._feedReady = false;
  S._feedGen = (S._feedGen||0) + 1;       // захист від застарілого ланцюжка reveal, якщо екран змінився
  const gen = S._feedGen;
  render(`
    <div class="eyebrow">ФАЗА 1 · РОЗПІЗНАЙ</div>
    ${sc.boss?'<div class="attack-banner glitch-target">⚠ ПІДВИЩЕНА АКТИВНІСТЬ ІПСО</div>':''}
    <div class="task">🎯 <div>Познач <b>усі ворожі наративи</b> й підтверди. Скільки їх, не підказуємо. Хибна тривога теж коштує: бачити ІПСО там, де його нема, це програш іншого типу.</div></div>
    <div class="osint-bar">🛰 <b>OSINT</b> · ПЕРЕВІРКА ДЖЕРЕЛА · лишилось <span id="osintLeft">${S.osintLeft}</span> / ${S.osintTotal}</div>
    <div class="feed" id="feed"></div>
    <button class="btn" id="confirmBtn" disabled onclick="resolveFeed()">ПІДТВЕРДИТИ ВИБІР</button>`);
  if(sc.boss) initGlitch('.glitch-target');
  if(S.i===0) showHint('feed_enter');
  revealFeed(gen, 0);
}
function msgHTML(idx, m, stamp){
  return '<div class="msg" tabindex="0" role="button" data-i="'+idx+'" data-views="'+parseViews(m.v)+'" data-hostile="'+(m.h?1:0)+'" onclick="pickMsg('+idx+')" onkeydown="if(event.key===\'Enter\')pickMsg('+idx+')">'
    + '<div class="msg-head"><span class="msg-author">'+m.a+'</span><span class="msg-tools"><span class="msg-meta">'+stamp+'</span><button class="osint-btn" data-i="'+idx+'" title="OSINT: перевірити джерело" onclick="event.stopPropagation();osintOpen('+idx+')" onkeydown="event.stopPropagation()">🔍</button></span></div>'
    + (m.flagged ? '<div class="msg-flag">⚠ МОДЕРАЦІЯ ВЖЕ ПОЗНАЧИЛА: ФЕЙК</div>' : '')
    + '<div class="msg-text">'+m.t+'</div>'
    + '<div class="msg-views">👁 <span class="views-n">'+m.v+'</span></div>'
    + '</div>';
}
/* Жива стрічка (задача 8.2): пости зʼявляються послідовно з typing-індикатором. */
function revealFeed(gen, i){
  if(gen !== S._feedGen) return;
  const feedEl = document.getElementById('feed');
  if(!feedEl) return;
  const order = S._feedOrder, stamps = S._feedStamps;
  if(i >= order.length){
    S._feedReady = true;
    startViewsTicker();
    updateConfirmBtn();
    return;
  }
  const typEl = document.createElement('div');
  typEl.className = 'msg typing';
  typEl.innerHTML = '<span class="typing-dots">●●●</span>';
  feedEl.appendChild(typEl);
  setTimeout(()=>{
    if(gen !== S._feedGen || !document.getElementById('feed')) return;
    typEl.remove();
    const idx = order[i], m = S.feed[idx];
    feedEl.insertAdjacentHTML('beforeend', msgHTML(idx, m, stamps[i]));
    setTimeout(()=>revealFeed(gen, i+1), 300 + Math.random()*200);
  }, 420);
}
function parseViews(str){
  const m = /^([\d.]+)\s*K$/i.exec(String(str).trim());
  return m ? parseFloat(m[1])*1000 : (parseFloat(str)||0);
}
function formatViews(n){
  const k = n/1000, r = Math.round(k*10)/10;
  return (Number.isInteger(r) ? r : r.toFixed(1)) + 'K';
}
/* Лічильник переглядів росте в реальному часі; ворожі пости — швидше. */
function startViewsTicker(){
  if(S._viewsInt) clearInterval(S._viewsInt);
  S._viewsInt = setInterval(()=>{
    document.querySelectorAll('#feed .msg[data-views]').forEach(el=>{
      const hostile = el.dataset.hostile==='1';
      const v = parseFloat(el.dataset.views) + (hostile ? 150+Math.random()*450 : 20+Math.random()*130);
      el.dataset.views = v;
      const disp = el.querySelector('.views-n'); if(disp) disp.textContent = formatViews(v);
    });
  }, 1400);
}
function updateConfirmBtn(){
  const btn = document.getElementById('confirmBtn');
  if(btn) btn.disabled = !S._feedReady || S.picks.size===0;
}
function pickMsg(idx){
  if(document.querySelector('#feed.locked-feed')) return;   // FIX 5: pointer-events:none не блокує keydown
  if(S.i===0) showHint('first_pick');
  const el = document.querySelector('.msg[data-i="'+idx+'"]');
  if(S.picks.has(idx)){ S.picks.delete(idx); el.classList.remove('sel'); }
  else { S.picks.add(idx); el.classList.add('sel'); }
  updateConfirmBtn();
}

/* ---------- OSINT: «Перевірити джерело» (задача 4) ---------- */
function osintOpen(idx){
  const m = S.feed[idx];
  if(!m || !m.osint) return;
  if(!S.osintDone.has(idx)){                        // повторний перегляд перевіреного безкоштовний
    if(S.osintLeft<=0){ toast('OSINT вичерпано','minus'); return; }
    S.osintLeft--; S.osintDone.add(idx);
    const el=document.getElementById('osintLeft'); if(el) el.textContent=S.osintLeft;
    const b=document.querySelector('.osint-btn[data-i="'+idx+'"]'); if(b) b.classList.add('used');
  }
  showOsint(m);
}
/* Задача 12, Д10: профіль показує лише сирі факти, без готового вердикту.
   Жодного "підозріло" в інтерфейсі — висновок робить сам гравець. */
function showOsint(m){
  const o=m.osint;
  const wrap=document.createElement('div');
  wrap.className='osint-modal';
  const row=(icon,label,valueHtml)=>
    '<div class="osint-row"><span class="osint-ico">'+icon+'</span>'
    + '<div class="osint-rowbody"><b>'+label+'</b><span>'+valueHtml+'</span></div></div>';
  wrap.innerHTML =
    '<div class="osint-card">'
    + '<div class="osint-h"><span>🛰 OSINT-ДОСЬЄ КАНАЛУ</span><button class="osint-x" onclick="this.closest(\'.osint-modal\').remove()">✕</button></div>'
    + '<div class="osint-name">'+m.a+'</div>'
    + row('📅','СТВОРЕНО', o.created)
    + row('📊','АКТИВНІСТЬ', o.postsMonth)
    + row('🖼','АВАТАРКА', o.avatar)
    + row('🏷','НАЗВИ', o.nameHistory)
    + row('📄','СТАРІ ПОСТИ', o.oldPosts.map(p=>'<span class="osint-post">'+p+'</span>').join(''))
    + row('🔁','РЕПОСТЯТЬ', o.repostedBy)
    + '<button class="btn" onclick="this.closest(\'.osint-modal\').remove()">ЗАКРИТИ</button>'
    + '</div>';
  wrap.addEventListener('click', e=>{ if(e.target===wrap) wrap.remove(); });
  document.body.appendChild(wrap);
}

function resolveFeed(){
  const sc = SCENARIOS[S.i];
  if(S._viewsInt){ clearInterval(S._viewsInt); S._viewsInt=null; }   // заморозити перегляди на моменті підтвердження
  const picked = [...S.picks];
  document.getElementById('feed').classList.add('locked-feed');
  document.getElementById('confirmBtn').style.display='none';
  let gain=0, loss=0, hostileTotal=0, hostileFound=0, falseAlarms=0, missedExplicit=0, missedSubtle=0;
  const recognized = [];   // пам'ять вибору (задача 9): усі ворожі пости цієї операції, знайдені й пропущені
  S.feed.forEach((m,idx)=>{
    const el = document.querySelector('.msg[data-i="'+idx+'"]');
    el.classList.remove('sel');
    if(m.h){
      hostileTotal++;
      const subtle = m.tier==='sub';
      const found = picked.includes(idx);
      recognized.push({idx, found});
      if(found){
        hostileFound++;
        gain += subtle?8:5;
        el.classList.add('hit');
        el.insertAdjacentHTML('afterbegin','<span class="tag '+(subtle?'hs':'h')+'">'+(subtle?'✓ ТОНКИЙ НАРАТИВ ×2':'✓ НАРАТИВ')+'</span>');
      } else {
        loss += -6;
        if(!subtle) missedExplicit++;   // тонкий пропуск довіру не чіпає, явний коштує
        else missedSubtle++;
        el.classList.add('missed','shake');
        el.insertAdjacentHTML('afterbegin','<span class="tag '+(subtle?'hs':'h')+'">ПРОПУЩЕНО</span>');
      }
    } else if(picked.includes(idx)){
      falseAlarms++;
      loss += -6;
      el.classList.add('safe','shake');
      el.insertAdjacentHTML('afterbegin','<span class="tag n">ХИБНА ТРИВОГА</span>');
      el.insertAdjacentHTML('beforeend','<div class="expl">'+m.w+'</div>');
    }
  });
  S._recognized = recognized;
  S.total += hostileTotal;
  S.correct += hostileFound;
  const clean = (hostileFound===hostileTotal && falseAlarms===0);
  S._spotClean = clean;
  S._op.found=hostileFound; S._op.total=hostileTotal; S._op.false=falseAlarms; S._op.miss=hostileTotal-hostileFound;
  if(clean){ S.streak++; } else { S.streak=0; }
  // жива довіра (задача 10): хибна тривога -2, пропущений явний наратив -1
  const repDelta = falseAlarms*-2 + missedExplicit*-1;
  if(repDelta) setRep(repDelta);
  if(S.i===0){
    if(falseAlarms>0) showHint('feed_false_alarm');
    if(missedSubtle>0) showHint('feed_missed_subtle');
  }
  const delta = (clean?gainAdj(gain):gain) + pen(loss);
  setTimeout(()=>{ setInfl(delta, delta>0?'Розпізнавання':'Промахи'); },350);
  app.querySelector('.screen').insertAdjacentHTML('beforeend',
    '<button class="btn" onclick="wildThen(\'phaseTech\')">ДАЛІ · АНАЛІЗ ТЕХНІКИ</button>');
}

/* ---------- Wildcard ---------- */
function wildThen(fnName){
  const pool = WILD.filter(w=>!S.usedWild.includes(w.id));
  if(pool.length && Math.random() < S.role.wild){
    const w = pool[Math.floor(Math.random()*pool.length)];
    S.usedWild.push(w.id);
    showWild(w, fnName);
  } else {
    window[fnName]();
  }
}
function showWild(w, fnName){
  if(w.type==='inst'){
    render(`
      <div class="eyebrow" style="color:var(--purple)">НЕОЧІКУВАНА ПОДІЯ</div>
      <div class="wild">
        <h3>${w.h}</h3>
        <p>${w.p}</p>
      </div>
      <button class="btn" onclick="window['${fnName}']()">ПРИЙНЯТИ Й ПРАЦЮВАТИ ДАЛІ</button>`);
    // Ефект застосовуємо синхронно одразу при показі події: шкала в топбарі анімується
    // своїм CSS-переходом, ефект видимий до «продовжити» й не губиться (rAF/таймер у
    // прихованій вкладці можуть не спрацювати).
    if(w.fx) setInfl(w.fx>0?w.fx:pen(w.fx), w.fx>0?'Подія':'Подія');
    if(w.rep) setRep(w.rep);
    if(w.timerCut) S.timerCut = w.timerCut;
  } else {
    render(`
      <div class="eyebrow" style="color:var(--purple)">НЕОЧІКУВАНА ПОДІЯ · 15 СЕКУНД</div>
      <div class="wild">
        <h3>${w.h}</h3>
        <p>${w.p}</p>
      </div>
      <div class="timer" id="wBox">⏱ <span class="t" id="wT">15</span><div class="timer-bar"><i id="wBar" style="width:100%"></i></div></div>
      <div class="opts">
        <button class="opt" id="wOptA" onclick="wildPick('a')"><b>${w.a.t}</b></button>
        <button class="opt" id="wOptB" onclick="wildPick('b')"><b>${w.b.t}</b></button>
      </div>`);
    S._wild = w; S._wildNext = fnName;
    S._wildDone = false;
    startWildTimer(15);
  }
  if(S.i===0) showHint('wildcard_first');   // після render(), інакше підказку одразу змиє очищення екрана
}
/* FIX 2а: той самий Date.now()-based патерн, що й у startTimer — стійкий до тротлінгу вкладки. */
function startWildTimer(seconds, total){
  total = total || seconds;
  const startedAt = Date.now();
  S._wildLeft = seconds;
  const el=document.getElementById('wT'), bar=document.getElementById('wBar'), box=document.getElementById('wBox');
  wtimerInt = setInterval(()=>{
    const elapsed = Math.floor((Date.now()-startedAt)/1000);
    const left = Math.max(0, seconds-elapsed);
    S._wildLeft = left;
    if(el) el.textContent=left;
    if(bar) bar.style.width=(left/total*100)+'%';
    if(left<=5 && box) box.classList.add('hot');
    if(left<=0){ clearInterval(wtimerInt); wtimerInt=null; wildPick('b',true); }
  },1000);
}
function wildPick(key, timedOut){
  S._wildDone = true;
  if(wtimerInt){ clearInterval(wtimerInt); wtimerInt=null; }
  const w=S._wild, o=w[key], other=w[key==='a'?'b':'a'];
  const elA=document.getElementById('wOptA'), elB=document.getElementById('wOptB');
  const picked = key==='a'?elA:elB, notPicked = key==='a'?elB:elA;
  [elA,elB].forEach(e=>e.disabled=true);
  const goodPick = o.fx>0 && !o.cons && !(o.rep&&o.rep<0);
  picked.classList.add(goodPick?'good':'bad');
  if(!goodPick) picked.classList.add('shake');
  notPicked.classList.add('dim');
  picked.insertAdjacentHTML('beforeend','<div class="expl">'+(timedOut?'Час вийшов, рішення прийняли за тебе. ':'')+o.e+'</div>');
  setInfl(o.fx>0?o.fx:pen(o.fx),'Подія');
  if(o.rep) setRep(o.rep);
  if(o.cons) S.cons++;
  app.querySelector('.screen').insertAdjacentHTML('beforeend',
    '<button class="btn" onclick="window[\''+S._wildNext+'\']()">ПРОДОВЖИТИ</button>');
}

/* ---------- Пам'ять вибору (задача 9): «РОЗКРИТІ НАРАТИВИ» ---------- */
function narrativesBlockHTML(){
  const rec = S._recognized || [];
  if(!rec.length) return '';
  const showSubtype = !!S._techAnswered;   // задача 12, Б4: ярлик підтипу з'являється лише після фази 2
  const cards = rec.map(r=>{
    const m = S.feed[r.idx];
    const subtle = m.tier==='sub';
    const short = m.t.length>80 ? m.t.slice(0,80)+'…' : m.t;
    return '<div class="narr-card'+(r.found?'':' narr-missed')+'" onclick="toggleNarr(this)">'
      + '<div class="narr-head"><span class="narr-author">'+m.a+'</span>'
      +   '<span class="narr-tags"><span class="narr-tag '+(subtle?'sub':'ob')+'">'+(subtle?'ТОНКИЙ':'ЯВНИЙ')+'</span>'
      +   (r.found?'':'<span class="narr-tag miss">ПРОПУЩЕНО</span>')+'</span></div>'
      + (showSubtype && m.subtype ? '<div class="narr-subtype">'+m.subtype+'</div>' : '')
      + '<div class="narr-text short">'+short+'</div>'
      + '<div class="narr-text full">'+m.t+'</div>'
      + '</div>';
  }).join('');
  return '<div class="narr-block"><div class="narr-label">РОЗКРИТІ НАРАТИВИ · ОПЕРАЦІЯ «'+SCENARIOS[S.i].node+'»</div><div class="narr-list">'+cards+'</div></div>';
}
function toggleNarr(el){ el.classList.toggle('narr-open'); }

/* ---------- Фази 2-4 ---------- */
function phaseTech(){
  const sc = SCENARIOS[S.i];
  const okIdx = sc.techniques.opts.findIndex(o=>o.ok);
  let order = shuffled(sc.techniques.opts.length);
  // правильна відповідь не має стояти на тій самій позиції, що в попередній операції
  while(sc.techniques.opts.length>1 && order.indexOf(okIdx)===S.lastTechPos){
    order = shuffled(sc.techniques.opts.length);
  }
  S.lastTechPos = order.indexOf(okIdx);
  render(`
    <div class="ph-analysis">
    <div class="eyebrow">ФАЗА 2 · НАЗВИ ТЕХНІКУ</div>
    ${narrativesBlockHTML()}
    <div class="task">🔬 <div>${sc.techniques.q}</div></div>
    <div class="opts">
      ${order.map(idx=>{const o=sc.techniques.opts[idx];return `
        <button class="opt" data-i="${idx}" onclick="pickTech(${idx})"><b>${o.n}</b>${o.d}</button>`}).join('')}
    </div>
    </div>`);
  if(S.i===0) showHint('tech_enter');
}
function pickTech(idx){
  const sc = SCENARIOS[S.i]; S.total++;
  const ok = sc.techniques.opts[idx].ok;
  S._techOK = ok; S._op.techOK = ok;
  S._techAnswered = true;   // задача 12, Б4: підтипи наративів з'являються тільки після відповіді у фазі 2
  if(ok){ S.correct++; S.streak++; if(!S.badges.includes(sc.badge)){S.badges.push(sc.badge); setTimeout(()=>{ toast('БЕЙДЖ: '+sc.badge,'plus'); SFX.play('badge'); },1800);} }
  else S.streak=0;
  sc.techniques.opts.forEach((o,j)=>{
    const el = document.querySelector('.opt[data-i="'+j+'"]');
    el.disabled = true;
    if(o.ok){ el.classList.add('good'); el.insertAdjacentHTML('beforeend','<div class="expl">'+o.e+'</div>'); }
    else if(j===idx){ el.classList.add('bad','shake'); el.insertAdjacentHTML('beforeend','<div class="expl">'+o.e+'</div>'); }
    else el.classList.add('dim');
  });
  setInfl(ok?gainAdj(7):pen(-8), ok?'Техніку розкрито':'Хибний аналіз');
  const next = sc.audiences ? 'phaseAudience' : 'phaseCounter';
  app.querySelector('.screen').insertAdjacentHTML('beforeend',
    '<button class="btn" onclick="wildThen(\''+next+'\')">ДАЛІ · ПРОТИДІЯ</button>');
}

function phaseAudience(){
  const sc = SCENARIOS[S.i];
  render(`
    <div class="ph-counter">
    <div class="phase-banner live">📡 ОБИРАЄШ НАПРЯМОК УДАРУ</div>
    <div class="eyebrow">ФАЗА 3 · НАПРЯМОК</div>
    ${narrativesBlockHTML()}
    <div class="task">📡 <div>${sc.audienceQ}</div></div>
    <div class="opts">
      ${sc.audiences.map((a,idx)=>`
        <button class="opt" onclick="pickAudience(${idx})"><b>${a.n}</b>${a.d}</button>`).join('')}
    </div>
    <p class="lead" style="margin-top:12px;font-size:13px">Обидва напрямки правильні. У повній версії команди ділять їх між собою, у демо обираєш один.</p>
    </div>`);
}
function pickAudience(idx){ S.audience = idx; phaseCounter(); }

function phaseCounter(){
  const sc = SCENARIOS[S.i];
  const c = sc.audiences ? sc.audiences[S.audience].counters : sc.counters;
  // задача 12, В8: бос забирає з таймера контрходу ще й додаткові секунди від сюжету
  const t = Math.max(12, S.role.time - S.timerCut - (sc.bossTimerCut||0));
  S._op.timeTotal = t;
  S._counterDone = false;   // задача 11: чи гравець уже відповів (щоб не відновлювати таймер даремно)
  const order = shuffled(c.opts.length);
  render(`
    <div class="ph-counter">
    <div class="phase-banner live">🔴 ЕФІР ЖИВИЙ · ВОРОЖА ВЕРСІЯ ШИРИТЬСЯ</div>
    <div class="eyebrow">ФАЗА ${sc.audiences?'4':'3'} · КОНТРНАРАТИВ</div>
    <div class="timer" id="timerBox">⏱ <span class="t" id="timerT">${t}</span>
      <div class="timer-bar"><i id="timerBar" style="width:100%"></i></div>
      <span class="note">вакуум працює на ворога</span>
    </div>
    ${narrativesBlockHTML()}
    <div class="task">⚔️ <div>${c.q}</div></div>
    <div class="opts">
      ${order.map(idx=>{const o=c.opts[idx];return `
        <button class="opt" data-i="${idx}" onclick="pickCounter(${idx})"><b>${o.n}</b>${o.d}</button>`}).join('')}
    </div>
    </div>`);
  startTimer(t);
  if(S.i===0) showHint('counter_enter');
}
function pickCounter(idx){
  S._counterDone = true;
  if(timerInt){clearInterval(timerInt);timerInt=null;}
  const sc = SCENARIOS[S.i]; S.total++;
  const c = sc.audiences ? sc.audiences[S.audience].counters : sc.counters;
  const o = c.opts[idx];
  if(o.best){ S.correct++; S.streak++; } else S.streak=0;
  if(o.cons) S.cons++;
  // жива довіра (задача 10): оптимальний контрхід +3, середній без змін, наявні штрафи з полів rep лишаються
  const repDelta = (o.rep||0) + (o.best?3:0);
  if(repDelta) setTimeout(()=>setRep(repDelta), 900);   // затримка, щоб не забити тост впливу нижче
  S._op.counter = o.best ? 'best' : (o.fx<0 ? 'bad' : 'mid');
  S._op.timeLeft = S._timeLeft||0;
  S.results.push({tech: sc.tech, techOK: S._techOK, counterGood: !!o.best});
  c.opts.forEach((op,j)=>{
    const el = document.querySelector('.opt[data-i="'+j+'"]');
    el.disabled = true;
    let cls = op.fx>=8 ? 'good' : (op.fx<0 ? 'bad' : 'mid');
    if(j===idx){
      el.classList.add(cls);
      if(op.fx<0) el.classList.add('shake');
      el.insertAdjacentHTML('beforeend','<div class="expl">'+op.e+'</div>');
    }
    else if(op.best){ el.classList.add('good'); el.insertAdjacentHTML('beforeend','<div class="expl">'+op.e+'</div>'); }
    else el.classList.add('dim');
  });
  // PATCH B5: чесний фідбек середньої опції — не видавати частковий ефект за перемогу
  const label = o.best ? 'Контрнаратив працює' : (o.fx>0 ? 'Частковий ефект' : 'Хід на користь ІПСО');
  setInfl(o.fx>0?gainAdj(o.fx,true):pen(o.fx), label, (!o.best && o.fx>0) ? false : undefined);
  app.querySelector('.screen').insertAdjacentHTML('beforeend',
    '<button class="btn" onclick="phaseDebrief()">ДАЛІ · РОЗБІР</button>');
}

function phaseDebrief(){
  const sc = SCENARIOS[S.i];
  render(`
    <div class="eyebrow">РОЗБІР ОПЕРАЦІЇ</div>
    <h2>${sc.title}</h2>
    <div class="card debrief"><p style="line-height:1.65;font-size:15px">${sc.debrief}</p></div>
    ${narrativesBlockHTML()}
    <button class="btn" onclick="phaseRank()">ОЦІНКА ОПЕРАЦІЇ ▸</button>`);
}

/* ---------- Ранг за операцію (S/A/B/C) ---------- */
/* Задача 12, В7: шкала A/B/C без S. Помилка рахується за кожен пропуск, кожну
   хибну тривогу, хибну техніку та неоптимальний контрхід. 0 помилок = A,
   рівно 1 = B, дві й більше = C. */
function countMistakes(d){
  let m = (d.miss||0) + (d.false||0);
  if(!d.techOK) m++;
  if(d.counter!=='best') m++;
  if(d.timedOut) m++;   // PATCH B1: таймаут = помилка
  return m;
}
function gradeOp(){
  const mistakes = countMistakes(S._op || {});
  if(mistakes===0) return 'A';
  if(mistakes===1) return 'B';
  return 'C';
}
function phaseRank(){
  const sc = SCENARIOS[S.i], d = S._op || {};
  const g = gradeOp();
  // задача 6: якщо операцію 1 закрито погано (ранг C або нечисте розпізнавання) — вмикаємо мутацію у фіналі
  if(S.i===0) S.op1Bad = (g==='C') || !S._spotClean;
  const gcls = 'gr-'+g.toLowerCase();
  const frac = d.timeTotal>0 ? Math.round(d.timeLeft/d.timeTotal*100) : 0;
  let parts=[];
  if(d.miss) parts.push(d.miss+' пропущено');
  if(d.false) parts.push(d.false+' хибних');
  const recV = d.found+'/'+d.total+(parts.length?' · '+parts.join(', '):' · чисто');
  const techV = d.techOK ? '✓ вірно' : '✗ хибно';
  const cV = d.counter==='best'?'оптимальний':(d.counter==='mid'?'середній':'шкідливий');
  const spV = d.timedOut ? 'час вичерпано · вакуум' : d.timeLeft+'с лишок · '+frac+'%';
  // колір кожного рядка за власною оцінкою: гуд зелений, середнє жовте (без класу, дефолт), погане червоне
  const errCount = (d.miss||0)+(d.false||0);
  const recCls = errCount===0 ? 'good' : (errCount>=2 ? 'bad' : '');
  const techCls = d.techOK ? 'good' : 'bad';
  const cCls = d.counter==='best' ? 'good' : (d.counter==='bad' ? 'bad' : '');
  const spCls = d.timedOut ? 'bad' : '';
  const subs = {A:'бездоганно',B:'одна помилка, тримайся',C:'є над чим працювати'};
  SFX.play('result');
  render(`
    <div style="padding-top:3vh;text-align:center">
      <div class="eyebrow">ОЦІНКА ОПЕРАЦІЇ · ${sc.node}</div>
      <div class="grade ${gcls}">${g}</div>
      <div class="grade-sub">${subs[g]}</div>
      <div class="card" style="text-align:left">
        <div class="stat"><span>Розпізнавання</span><span class="v ${recCls}">${recV}</span></div>
        <div class="stat"><span>Аналіз техніки</span><span class="v ${techCls}">${techV}</span></div>
        <div class="stat"><span>Контрхід</span><span class="v ${cCls}">${cV}</span></div>
        <div class="stat"><span>Швидкість</span><span class="v ${spCls}">${spV}</span></div>
      </div>
      <button class="btn" onclick="nextScenario()">${S.i < SCENARIOS.length-1 ? 'ДО МАПИ ▸' : 'ПІДСУМОК ▸'}</button>
      <button class="btn ghost" onclick="replayOp()">↻ ПЕРЕПРОЙТИ ОПЕРАЦІЮ</button>
    </div>`);
}
/* Рестарт поточної операції без скидання кампанії: відкат до знімка старту. */
function replayOp(){
  const s = S._snap; if(!s) return;
  S.infl=s.infl; S.rep=s.rep; S.repMin=s.repMin; S.streak=s.streak; S.correct=s.correct; S.total=s.total;
  S.cons=s.cons; S.results.length=s.resultsLen; S.badges=s.badges.slice();
  S.usedWild=s.usedWild.slice(); S.lastTechPos=s.lastTechPos;
  setInfl(0);   // перемалювати шкалу й HUD під відновлені значення
  startScenario();
}
function nextScenario(){
  const sc = SCENARIOS[S.i];
  const leavingOp1 = (S.i===0);
  if(S.i < SCENARIOS.length-1){
    const cliff = sc.cliff; S.i++; campaignMap(cliff);
    // задача 11: прощальна підказка й вимкнення туторіалу лишень після неї,
    // щоб сама підказка встигла спрацювати, поки tutorialDone ще false
    if(leavingOp1){ showHint('map_after_op1'); tutorialDone = true; }
  }
  else finale();
}

function finale(){
  document.body.classList.remove('boss-mode');
  SFX.crossfadeToAmbient();   // M4: бос-музика кросфейдиться назад в амбієнт
  let crisisHtml = '';
  const doCrisis = S.cons >= 2;
  if(doCrisis){
    crisisHtml = `<div class="crisis">
      <h3>⚠ ПОДІЯ: ГУЧНЕ МОВЧАННЯ</h3>
      <p>Кілька разів ти обирав «заспокоїти» замість «відповісти». Зовні ставало тихіше, але питання без відповідей нікуди не дівались. Вони консервувались і тепер вибухнули падінням довіри. Гучне мовчання не означає відсутності проблем. Воно означає їхню консервацію. Стійкість −10.</p>
    </div>`;
  }
  // FIX 3: одразу рендеримо проміжний екран без кнопок — убиває і дабл-клік "ПІДСУМОК",
  // і клік "ПЕРЕПРОЙТИ", що рендерився б поверх цієї ж затримки
  if(doCrisis){
    render(`
      <div style="padding-top:3vh;text-align:center">
        <div class="eyebrow">ПІДСУМОК КАМПАНІЇ</div>
        ${crisisHtml}
      </div>`);
  }

  const resilient = [...new Set(S.results.filter(r=>r.techOK && r.counterGood).map(r=>r.tech))];
  const vulnerable = [...new Set(S.results.filter(r=>!r.techOK || !r.counterGood).map(r=>r.tech))];

  const doRender = ()=>{
    let rank, cls, note;
    if(S.infl>=78){ rank='ІНФОСТІЙКИЙ'; cls='gold'; note='Лінія впливу на твоєму боці. Ти читаєш техніки, а не заголовки.'; }
    else if(S.infl>=52){ rank='МЕДІАГРАМОТНИЙ'; cls='mid'; note='Основу тримаєш. Частина рішень зіграла на ворожий фрейм, розбори підкажуть де саме.'; }
    else { rank='ЖЕРТВА МЕТОДИЧКИ'; cls='low'; note='Наративи пройшли крізь оборону. Хороша новина: тепер ти знаєш, де саме. А це вже половина захисту.'; }

    render(`
      <div style="padding-top:3vh;text-align:center">
        <div class="eyebrow">ПІДСУМОК КАМПАНІЇ · ${S.role.n}</div>
        <div class="rank ${cls}">${rank}</div>
        <p class="lead" style="max-width:440px;margin:0 auto 20px">${note}</p>
        <img class="finale-art" src="assets/finale_art.png" alt="" onerror="this.remove()">
        ${crisisHtml}
        <div class="card" style="text-align:left">
          <div class="stat"><span>Фінальна стійкість</span><span class="v">${S.infl} / 100</span></div>
          <div class="stat"><span>Довіра до тебе</span><span class="v">${S.rep} / 100</span></div>
          <div class="stat"><span>Мін. довіра за кампанію</span><span class="v">${S.repMin} / 100</span></div>
          <div class="stat"><span>Точні рішення</span><span class="v">${S.correct} з ${S.total}</span></div>
          <div class="stat"><span>Бейджі технік</span><span class="v">${S.badges.length} / ${SCENARIOS.length}</span></div>
        </div>
        <div class="card" style="text-align:left">
          <div class="px" style="font-size:9px;color:var(--gold);margin-bottom:10px;line-height:1.7">ПРОФІЛЬ ВРАЗЛИВОСТІ</div>
          ${resilient.length?'<div style="font-size:13px;color:var(--muted)">Стійкий до:</div><div class="vuln-row">'+resilient.map(t=>'<span class="chip ok">'+t+'</span>').join('')+'</div>':''}
          ${vulnerable.length?'<div style="font-size:13px;color:var(--muted);margin-top:10px">Зона роботи:</div><div class="vuln-row">'+vulnerable.map(t=>'<span class="chip vuln">'+t+'</span>').join('')+'</div>':'<div style="font-size:13px;color:var(--ok);margin-top:10px">Чистий прохід по всіх техніках. Рідкість.</div>'}
          <p style="font-size:12px;color:var(--muted);margin-top:12px;line-height:1.5">У повній версії профіль накопичується між сесіями і дає тренеру картину по підрозділу: які техніки пробивають людей найчастіше.</p>
        </div>
        <div class="demo-note">
          <h3>ЦЕ ДЕМО-ЗБІРКА ЯДРА</h3>
          <ul>
            <li>Прогресія: починаєш простим пресофіцером, прокачуєш персонажа і відкриваєш складніші ролі, нові регіони мапи та режими</li>
            <li>Вільний вибір операцій на мапі — у демо порядок фіксований заради наскрізного сюжету</li>
            <li>Мутація наративів: слабка відповідь на початку кампанії повертається сильнішою у фіналі</li>
            <li>Прикладне ворогознавство: дерево знань про техніки, що відкриває нові контрходи</li>
            <li>Командний режим: два гравці, одна ситуація, порівняння рішень</li>
            <li>Аналітика для тренера і регіональні профілі стійкості</li>
          </ul>
          <h3 style="margin-top:14px">АДДОНИ В РОЗРОБЦІ</h3>
          <ul>
            <li>МОБІЛЬНІ ГРУПИ: читання аудиторії, побудова виступу. На базі карткової версії</li>
            <li>МІЖНАРОДНИЙ: дипломатичні сценарії, скептичні аудиторії</li>
            <li>ЧЕРВОНА КОМАНДА: сконструюй ІПСО сам і зрозумій захист зсередини</li>
          </ul>
        </div>
        <button class="btn" onclick="restart()">ЩЕ РАЗ · ІНША РОЛЬ</button>
        <button class="btn ghost" onclick="restartToModes()">ДО РЕЖИМІВ</button>
      </div>`);
  };

  if(doCrisis){
    setTimeout(()=>setInfl(-10,'Гучне мовчання'), 700);
    setTimeout(doRender, 1500);
  } else doRender();
}

function resetState(){ S.role=null; S.i=0; S.infl=50; S.rep=100; S.repMin=100; S.streak=0; S.correct=0; S.total=0; S.cons=0; S.results=[]; S.badges=[]; S.usedWild=[]; S.timerCut=0; S.lastTechPos=-1; S._op=null; S._snap=null; S.feed=[]; S.osintLeft=2; S.osintTotal=2; S.osintDone=new Set(); S.op1Bad=false; S._recognized=[]; S._techAnswered=false; document.body.classList.remove('boss-mode'); SFX.stopAmbient(); }
function restart(){ resetState(); setInfl(0); roleSelect(); }
function restartToModes(){ resetState(); setInfl(0); modeSelect(); }

hud();
setInfl(0);
modeSelect();
