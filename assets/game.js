const $ = (sel) => document.querySelector(sel);

function escapeHtml(s){
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
function clamp(n,min,max){return Math.max(min, Math.min(max,n));}
function shuffle(arr){
  const a = arr.slice();
  for (let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

const SCORE = { correct: 100, speedMax: 40 };

const MODE_PRESETS = {
  practice:        { label:"練習（ソロ）", bots:0, queueDelayMs: 0, botSkill:"mid", rated:false },

  // 練習（ジャンル別：あなたのみ）
  practice_calc:   { label:"練習（計算）", bots:0, queueDelayMs: 0, botSkill:"mid", rated:false },
  practice_memory: { label:"練習（記憶）", bots:0, queueDelayMs: 0, botSkill:"mid", rated:false },
  practice_logic:  { label:"練習（論理）", bots:0, queueDelayMs: 0, botSkill:"mid", rated:false },

  // 練習：CPU対戦（あなた + CPU3）
  cpu_easy:        { label:"CPU対戦（弱）", bots:3, queueDelayMs: 0, botSkill:"low", rated:false },
  cpu_mid:         { label:"CPU対戦（中）", bots:3, queueDelayMs: 0, botSkill:"mid", rated:false },
  cpu_hard:        { label:"CPU対戦（強）", bots:3, queueDelayMs: 0, botSkill:"high", rated:false },
  cpu_oni:         { label:"CPU対戦（鬼）", bots:3, queueDelayMs: 0, botSkill:"oni", rated:false },

  free:            { label:"フリー対戦", bots:3, queueDelayMs: 900,  botSkill:"mix",   rated:false },
  rated:           { label:"レート対戦", bots:3, queueDelayMs: 1200, botSkill:"match", rated:true  },
};

const STORY_KEY = "rqa_story_v1";

const STORY_STAGES = [
  { id:1,  name:"はじまりの門",  boss:"計算の番人", focus:"calc",  diffCap:2, timeLimit:8.0, bossSkill:"low",  minionSkill:"low"  },
  { id:2,  name:"記憶の回廊",    boss:"記憶の番人", focus:"memory",diffCap:2, timeLimit:8.0, bossSkill:"low",  minionSkill:"low"  },
  { id:3,  name:"論理の試練",    boss:"論理の番人", focus:"logic", diffCap:2, timeLimit:7.5, bossSkill:"mid",  minionSkill:"low"  },
  { id:4,  name:"混合の広場",    boss:"混合の闘士", focus:"calc",  diffCap:3, timeLimit:7.0, bossSkill:"mid",  minionSkill:"mid"  },
  { id:5,  name:"集中の塔",      boss:"一点突破",   focus:"memory",diffCap:3, timeLimit:6.8, bossSkill:"mid",  minionSkill:"mid"  },
  { id:6,  name:"推理の階段",    boss:"推理将",     focus:"logic", diffCap:3, timeLimit:6.8, bossSkill:"mid",  minionSkill:"mid"  },
  { id:7,  name:"加速の闘技場",  boss:"高速王",     focus:"calc",  diffCap:4, timeLimit:6.3, bossSkill:"high", minionSkill:"mid"  },
  { id:8,  name:"幻影の間",      boss:"記憶魔",     focus:"memory",diffCap:4, timeLimit:6.3, bossSkill:"high", minionSkill:"mid"  },
  { id:9,  name:"論理迷宮",      boss:"論理王",     focus:"logic", diffCap:4, timeLimit:6.0, bossSkill:"high", minionSkill:"high" },
  { id:10, name:"終局の門",      boss:"最終ボス",   focus:"mix",   diffCap:4, timeLimit:5.7, bossSkill:"oni",  minionSkill:"high" },
];

function readStory(){
  try{
    const raw = localStorage.getItem(STORY_KEY);
    if (!raw) return { unlocked: 1, cleared: {} };
    const obj = JSON.parse(raw);
    return {
      unlocked: clamp(parseInt(obj.unlocked ?? 1, 10) || 1, 1, STORY_STAGES.length),
      cleared: obj.cleared || {}
    };
  }catch(e){ return { unlocked: 1, cleared: {} }; }
}
function writeStory(s){
  try{ localStorage.setItem(STORY_KEY, JSON.stringify(s)); }catch(e){}
}

function storyModeKey(stageId){
  return `story_${String(stageId).padStart(2,"0")}`;
}

function renderStoryHome(){
  const s = readStory();
  const el = $("#app");

  const cards = STORY_STAGES.map(st=>{
    const locked = st.id > (s.unlocked ?? 1);
    const cleared = !!s.cleared?.[String(st.id)];
    const badge = cleared ? `<span class="pill" style="background:#e7fff1;border-color:#bdebd0">CLEAR</span>` :
                 locked ? `<span class="pill">LOCK</span>` : `<span class="pill">OPEN</span>`;
    const focusLabel = st.focus==="mix" ? "全ジャンル" : GENRE_LABEL[st.focus];
    const diffStars = "★".repeat(st.diffCap) + "☆".repeat(Math.max(0,4-st.diffCap));

    return `
      <section class="card">
        <div class="h2">STAGE ${String(st.id).padStart(2,"0")}　${escapeHtml(st.name)} ${badge}</div>
        <div class="small" style="margin-top:6px">
          BOSS：${escapeHtml(st.boss)}（得意：<b>${focusLabel}</b>）<br>
          制限：<b>${st.timeLimit.toFixed(1)}秒/問</b>　難易度：<b>${diffStars}</b>
        </div>
        <div class="hr"></div>
        <div class="small">
          クリア条件：<b>BOSSより上位</b>に入る
        </div>
        <div class="btnRow" style="margin-top:10px">
          <button class="btn ${locked?'ghost':'primary'}" data-stage="${st.id}" ${locked?'disabled':''}>
            ${locked ? "未解放" : (cleared ? "再挑戦" : "挑戦する")}
          </button>
        </div>
      </section>
    `;
  }).join("");

  el.innerHTML = `
    <div class="hero">
      <div class="h1">ストーリー（ボス戦）</div>
      <p class="p">10問で勝負。<b>BOSSより上位</b>に入るとクリアです。クリアで次のステージ解放（ローカル保存）。</p>
      <div class="btnRow">
        <button class="btn ghost" id="backHomeBtn">戻る</button>
        <a class="btn ghost" href="/story/">説明ページ</a>
      </div>
      <div class="hr"></div>
      <div class="notice">
        <b>進行度：</b> ${s.unlocked}/${STORY_STAGES.length}（CLEAR ${Object.keys(s.cleared||{}).length}）<br>
        同点判定：合計スコア → 正解数 → 総回答時間（短い方）
      </div>
    </div>

    <div class="grid grid2" style="margin-top:12px">
      ${cards}
    </div>
  `;

  $("#backHomeBtn").onclick = renderPlayHome;
  document.querySelectorAll("button[data-stage]").forEach(btn=>{
    btn.onclick = ()=>{
      const id = parseInt(btn.getAttribute("data-stage"),10);
      startStory(id);
    };
  });
}

function startStory(stageId){
  const st = STORY_STAGES.find(x=>x.id===stageId) || STORY_STAGES[0];
  const s = readStory();
  if (stageId > (s.unlocked ?? 1)){
    // 念のため：未解放は弾く
    renderStoryHome();
    return;
  }

  const config = {
    diffCap: st.diffCap,
    genRate: 0.55,
    plan: { calc:4, memory:3, logic:3 },
  };
  const qset = pickQuestions(10, null, config);

  const players = [];
  players.push(mkPlayer("あなた"));

  // ボス＆取り巻き（あなた + CPU3）
  const bossFocus = (st.focus==="mix") ? null : st.focus;
  const boss = mkBot(`BOSS ${st.boss}`, st.bossSkill, null, {
    isBoss:true,
    focusGenre: bossFocus,
    focusBonusAcc: 0.06,
    focusSpeedMul: 0.85
  });
  const m1 = mkBot("取り巻きA", st.minionSkill);
  const m2 = mkBot("取り巻きB", st.minionSkill);
  players.push(boss, m1, m2);

  const preset = { label:`ストーリー：STAGE ${String(st.id).padStart(2,"0")} ${st.name}`, bots:3, rated:false };

  const state = {
    modeKey: storyModeKey(st.id),
    preset, players, qset, qIndex: 0,
    answerLog: [],
    timeLimit: st.timeLimit,
    phase: "question",
    startedAt: null, myAnswered: false, myAnswer: null,
    storyStage: st
  };

  renderMatch(state);
}



const GENRE_LABEL = { calc:"計算", memory:"記憶", logic:"論理" };

function getProfile(){
  const raw = localStorage.getItem("rqa_profile_v1");
  if (raw){
    try{ return JSON.parse(raw); }catch{}
  }
  return { rp: 0, mmr: 1000, matches: 0, bestRank: null };
}
function saveProfile(p){ localStorage.setItem("rqa_profile_v1", JSON.stringify(p)); }

function readMatchStats(){
  try{
    const raw = localStorage.getItem("rqa_stats_v1");
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  }catch(e){ return []; }
}
function writeMatchStats(arr){
  try{
    localStorage.setItem("rqa_stats_v1", JSON.stringify(arr));
  }catch(e){}
}


function timeNow(){ return performance.now(); }

function choice(arr){
  return arr[Math.floor(Math.random()*arr.length)];
}

function pickDiff(cap){
  const c = clamp(cap ?? 4, 1, 4);
  const base = [0, 4, 6, 5, 4]; // 1..4
  const weights = base.slice(1, c+1);
  const sum = weights.reduce((s,x)=>s+x,0);
  let r = Math.random()*sum;
  for (let i=1;i<=c;i++){
    r -= base[i];
    if (r <= 0) return i;
  }
  return c;
}

function genCalcQuestion(diffCap=4){
  // ％は出さない。2桁×2桁は出さない（11〜19の平方のみはデータ側に固定で存在）
  const diff = pickDiff(diffCap);
  const mkMcq = (prompt, correct, distractors)=>{
    const choices = [String(correct)];
    for (const d of distractors){
      const s = String(d);
      if (!choices.includes(s)) choices.push(s);
      if (choices.length===4) break;
    }
    while (choices.length<4){
      const delta = choice([-12,-10,-8,-6,-5,-4,-3,-2,-1,1,2,3,4,5,6,8,10,12]);
      const s = String(parseInt(correct,10)+delta);
      if (!choices.includes(s)) choices.push(s);
    }
    return { genre:"calc", format:"mcq", difficulty:diff, prompt, choices: shuffle(choices), answer_index: null };
  };
  const mkNum = (prompt, ans)=>({ genre:"calc", format:"numeric", difficulty:diff, prompt, answer_value: ans });

  if (diff===1){
    const a = 10+Math.floor(Math.random()*90);
    const b = 10+Math.floor(Math.random()*90);
    if (Math.random()<0.5){
      const ans = a+b;
      const q = mkMcq(`${a} + ${b} = ?`, ans, [ans+10, ans-10, ans+1, ans-1]);
      q.answer_index = q.choices.indexOf(String(ans));
      return q;
    } else {
      const aa = Math.max(a,b), bb = Math.min(a,b);
      const ans = aa-bb;
      const q = mkMcq(`${aa} - ${bb} = ?`, ans, [ans+10, ans-10, ans+1, ans-1]);
      q.answer_index = q.choices.indexOf(String(ans));
      return q;
    }
  }

  if (diff===2){
    const t = choice(["mul","div","prec","sub"]);
    if (t==="mul"){
      const a = 2+Math.floor(Math.random()*8);
      const b = 2+Math.floor(Math.random()*8);
      const ans = a*b;
      const q = mkMcq(`${a} × ${b} = ?`, ans, [ans+6, ans-6, ans+1, ans-1]);
      q.answer_index = q.choices.indexOf(String(ans));
      return q;
    }
    if (t==="div"){
      const b = 2+Math.floor(Math.random()*8);
      const ans = 2+Math.floor(Math.random()*11);
      const a = b*ans;
      if (Math.random()<0.35){
        return mkNum(`${a} ÷ ${b} = ?`, ans);
      }
      const q = mkMcq(`${a} ÷ ${b} = ?`, ans, [ans+2, ans-2, ans+1, ans-1]);
      q.answer_index = q.choices.indexOf(String(ans));
      return q;
    }
    if (t==="prec"){
      const a = 2+Math.floor(Math.random()*8);
      const b = 2+Math.floor(Math.random()*8);
      const c = 2+Math.floor(Math.random()*8);
      const ans = a + b*c;
      const q = mkMcq(`${a} + ${b} × ${c} = ?`, ans, [(a+b)*c, a*b+c, ans+2, ans-2]);
      q.answer_index = q.choices.indexOf(String(ans));
      return q;
    }
    const a = 30+Math.floor(Math.random()*70);
    const b = 10+Math.floor(Math.random()*60);
    const aa = Math.max(a,b), bb = Math.min(a,b);
    const ans = aa-bb;
    const q = mkMcq(`${aa} - ${bb} = ?`, ans, [ans+11, ans+9, ans+1, ans-1]);
    q.answer_index = q.choices.indexOf(String(ans));
    return q;
  }

  if (diff===3){
    const t = choice(["mul2","par","combo"]);
    if (t==="mul2"){
      const a = 12+Math.floor(Math.random()*18); // 12-29
      const b = 3+Math.floor(Math.random()*7);  // 3-9
      const ans = a*b;
      if (Math.random()<0.55) return mkNum(`${a} × ${b} = ?`, ans);
      const q = mkMcq(`${a} × ${b} = ?`, ans, [ans+10, ans-10, ans+2, ans-2]);
      q.answer_index = q.choices.indexOf(String(ans));
      return q;
    }
    if (t==="par"){
      const a = 10+Math.floor(Math.random()*21);
      const b = 1+Math.floor(Math.random()*15);
      const c = 3+Math.floor(Math.random()*7);
      const aa = Math.max(a,b), bb = Math.min(a,b);
      const ans = (aa-bb)*c;
      const q = mkMcq(`(${aa} - ${bb}) × ${c} = ?`, ans, [ans+10, ans-10, ans+5, ans-5]);
      q.answer_index = q.choices.indexOf(String(ans));
      return q;
    }
    const b = 3+Math.floor(Math.random()*7);
    const qv = 6+Math.floor(Math.random()*13);
    const a = b*qv;
    const c = 1+Math.floor(Math.random()*20);
    const ans = qv+c;
    return mkNum(`${a} ÷ ${b} + ${c} = ?`, ans);
  }

  // diff===4
  const t = choice(["par2","combo2","mul_sub"]);
  if (t==="par2"){
    const a = 12+Math.floor(Math.random()*19);
    const b = 1+Math.floor(Math.random()*18);
    const c = 4+Math.floor(Math.random()*6);
    const aa = Math.max(a,b), bb = Math.min(a,b);
    const ans = (aa-bb)*c;
    return mkNum(`(${aa} - ${bb}) × ${c} = ?`, ans);
  }
  if (t==="combo2"){
    const b = 6+Math.floor(Math.random()*4);
    const qv = 6+Math.floor(Math.random()*9);
    const a = b*qv;
    const c = 10+Math.floor(Math.random()*21);
    const ans = qv+c;
    const q = mkMcq(`${a} ÷ ${b} + ${c} = ?`, ans, [ans+2, ans-2, ans+5, ans-5]);
    q.answer_index = q.choices.indexOf(String(ans));
    return q;
  }
  const a = 21+Math.floor(Math.random()*19);
  const b = 4+Math.floor(Math.random()*6);
  const d = 1+Math.floor(Math.random()*15);
  const ans = a*b-d;
  return mkNum(`${a} × ${b} - ${d} = ?`, ans);
}

function genMemoryQuestion(diffCap=4){
  const diff = pickDiff(diffCap);
  const symbols = ["◯","△","□","×","☆","♢"];
  const show_ms = diff===1?800 : (diff===2?700 : (diff===3?650 : 600));
  const len = diff<=2 ? 4 : 4;
  const useSymbols = (diff<=2 && Math.random()<0.35);
  const seq = [];
  for (let i=0;i<len;i++){
    if (useSymbols) seq.push(choice(symbols));
    else seq.push(String(Math.floor(Math.random()*10)));
  }

  const askType = Math.random()<0.40 ? "last" : "index";
  if (askType==="last"){
    const correct = seq[seq.length-1];
    const prompt = "（記憶）表示された列の「最後」は？";
    const pool = useSymbols ? symbols : ["0","1","2","3","4","5","6","7","8","9"];
    const choices = [correct];
    while (choices.length<4){
      const c = choice(pool);
      if (!choices.includes(c)) choices.push(c);
    }
    const q = { genre:"memory", format:"mcq", difficulty:diff, prompt,
      memory:{ show_ms, sequence: seq, ask:"last" }, choices: shuffle(choices), answer_index: null };
    q.answer_index = q.choices.indexOf(correct);
    return q;
  }

  // index ask
  const askIndex = 1 + Math.floor(Math.random()*seq.length);
  const correct = seq[askIndex-1];
  const prompt = `（記憶）表示された列の「${askIndex}番目」は？`;
  const pool = useSymbols ? symbols : ["0","1","2","3","4","5","6","7","8","9"];
  const choices = [correct];
  while (choices.length<4){
    const c = choice(pool);
    if (!choices.includes(c)) choices.push(c);
  }
  const q = { genre:"memory", format:"mcq", difficulty:diff, prompt,
    memory:{ show_ms, sequence: seq, ask:"index", ask_index: askIndex }, choices: shuffle(choices), answer_index: null };
  q.answer_index = q.choices.indexOf(correct);
  return q;
}

function genLogicQuestion(diffCap=4){
  const diff = pickDiff(diffCap);
  const mk = (prompt, choices, ansIdx)=>({ genre:"logic", format:"mcq", difficulty:diff, prompt, choices, answer_index: ansIdx });

  if (diff<=2 && Math.random()<0.5){
    // 余り
    const m = choice([3,4,5,6,7]);
    const n = 10 + Math.floor(Math.random()*90);
    const r = n % m;
    const opts = [];
    for (let i=0;i<m;i++) opts.push(String(i));
    const picks = shuffle(opts).slice(0,4);
    if (!picks.includes(String(r))){
      picks[Math.floor(Math.random()*4)] = String(r);
    }
    return mk(`${n}を${m}で割った余りは？`, picks, picks.indexOf(String(r)));
  }

  if (diff<=3 && Math.random()<0.5){
    // 偶奇/性質
    const t = choice(["even1","odd1","mulOdd","mod2"]);
    if (t==="even1") return mk("nが偶数のとき、n+1は？", ["偶数","奇数","0","不定"], 1);
    if (t==="odd1") return mk("nが奇数のとき、n+1は？", ["偶数","奇数","0","不定"], 0);
    if (t==="mulOdd") return mk("nが奇数のとき、n×nは？", ["偶数","奇数","0","不定"], 1);
    return mk("nを2で割った余りが1のとき、nは？", ["偶数","奇数","0","不定"], 1);
  }

  // 余りの移動（diff3-4寄り）
  const m = choice([4,5,6,7,8]);
  const r = Math.floor(Math.random()*m);
  const add = 1 + Math.floor(Math.random()*(m-1));
  const ans = (r + add) % m;
  const opts = [];
  for (let i=0;i<m;i++) opts.push(String(i));
  const picks = shuffle(opts).slice(0,4);
  if (!picks.includes(String(ans))){
    picks[Math.floor(Math.random()*4)] = String(ans);
  }
  return mk(`nを${m}で割った余りが${r}のとき、n+${add}を${m}で割った余りは？`, picks, picks.indexOf(String(ans)));
}

function finalizeGenerated(q, id){
  q.id = id;
  if (q.format==="mcq" && (q.answer_index==null)){
    // answer_index must exist; if missing, infer by keeping correct at index 0 would be wrong; but our gen sets it.
    q.answer_index = 0;
  }
  return q;
}

function pickQuestions(n, onlyGenre=null, config=null){
  const pool = window.RQA_QUESTIONS || [];
  const by = {
    calc: pool.filter(q=>q.genre==="calc"),
    memory: pool.filter(q=>q.genre==="memory"),
    logic: pool.filter(q=>q.genre==="logic"),
  };

  const cfg = config || {};
  const diffCap = clamp(cfg.diffCap ?? 4, 1, 4);
  const genRate = clamp(cfg.genRate ?? 0.45, 0, 1);
  // 基本配分（10問）：計算4 / 記憶3 / 論理3
  const plan = cfg.plan ? cfg.plan : (onlyGenre ? { [onlyGenre]: n } : { calc:4, memory:3, logic:3 });
  const picks = [];
  let genId = 1;

  const pushOne = (genre)=>{
    const useGenerated = Math.random() < genRate; // 生成を程よく混ぜる（飽き対策）
    if (useGenerated){
      let q;
      if (genre==="calc") q = genCalcQuestion(diffCap);
      else if (genre==="memory") q = genMemoryQuestion(diffCap);
      else q = genLogicQuestion(diffCap);
      picks.push(finalizeGenerated(q, `gen_${genre}_${String(genId++).padStart(3,"0")}`));
      return;
    }
    // ベース問題から選ぶ（重複回避）
    const candidates = shuffle(by[genre]);
    for (const c of candidates){
      if (!picks.some(p=>p.id===c.id)) { picks.push(c); return; }
    }
    // もし枯れたら生成で補完
    let q;
    if (genre==="calc") q = genCalcQuestion(diffCap);
    else if (genre==="memory") q = genMemoryQuestion(diffCap);
    else q = genLogicQuestion(diffCap);
    picks.push(finalizeGenerated(q, `gen_${genre}_${String(genId++).padStart(3,"0")}`));
  };

  for (const genre of ["calc","memory","logic"]){
    const count = plan[genre] || 0;
    for (let i=0;i<count;i++) pushOne(genre);
  }

  return shuffle(picks).slice(0,n);
}

function mkBot(name, skill, mmr, opts){
  let avg = 1.7, acc = 0.86;
  if (skill==="low"){ avg = 2.4; acc=0.72; }
  if (skill==="mid"){ avg = 1.7; acc=0.86; }
  if (skill==="high"){ avg = 1.25; acc=0.93; }
  if (skill==="oni"){ avg = 1.05; acc=0.96; }
  if (skill==="mix"){
    const r = Math.random();
    if (r<0.33) {avg=2.3; acc=0.75;}
    else if (r<0.66) {avg=1.7; acc=0.86;}
    else {avg=1.25; acc=0.93;}
  }
  const obj = { type:"bot", name, mmr: mmr ?? 1000, avgSec: avg, acc, score:0, correct:0, timeSum:0, totalTime:0 };
  if (opts) Object.assign(obj, opts);
  return obj;
}

function mkPlayer(name){
  return { type:"human", name, mmr: getProfile().mmr, score:0, correct:0, timeSum:0, totalTime:0 };
}

function scoreForAnswer(isCorrect, timeSec, timeLimit){
  if (!isCorrect) return 0;
  const t = clamp(timeSec, 0, timeLimit);
  const speed = (1 - (t / timeLimit));
  const bonus = Math.round(SCORE.speedMax * clamp(speed, 0, 1));
  return SCORE.correct + bonus;
}

function computeCorrect(q, answer){
  if (q.format==="mcq"){
    return parseInt(answer,10) === q.answer_index;
  }
  const v = parseInt(String(answer).trim(),10);
  return Number.isFinite(v) && v === q.answer_value;
}

function renderProfileBar(modeKey){
  const p = getProfile();
  const rated = MODE_PRESETS[modeKey]?.rated;
  const rp = p.rp ?? 0;
  const mmr = p.mmr ?? 1000;
  return `
    <div class="card">
      <div class="kpis">
        <div class="kpi"><div class="label">RP（表示ポイント）</div><div class="value">${rp}</div></div>
        <div class="kpi"><div class="label">内部MMR</div><div class="value">${mmr}</div></div>
        <div class="kpi"><div class="label">試合数</div><div class="value">${p.matches ?? 0}</div></div>
      </div>
      <div class="small" style="margin-top:8px">
        ${rated ? "レート対戦では、近い実力（MMR）同士で対戦し、順位に応じてRPを獲得します（RPは減りません）。" :
                 "フリー対戦はレート変動なし。練習（ソロ）はいつでも遊べます。"}
      </div>
    </div>
  `;
}

function renderPlayHome(){
  const el = $("#app");
  el.innerHTML = `
    <div class="hero">
      <div class="h1">遊ぶ</div>
      <p class="p">10問で決着するスコアバトル。まずは練習（ソロ/ジャンル別）で感覚を掴んでから、CPU/フリー／レートへ。</p>
      <div class="btnRow">
        <button class="btn primary" id="goPractice">練習（ソロ）10問</button>
        <button class="btn ghost" id="goPracticeCalc">練習（計算）</button>
        <button class="btn ghost" id="goPracticeMemory">練習（記憶）</button>
        <button class="btn ghost" id="goPracticeLogic">練習（論理）</button>
        <button class="btn" id="goCpuEasy">CPU対戦（弱）</button>
        <button class="btn" id="goCpuMid">CPU対戦（中）</button>
        <button class="btn" id="goCpuHard">CPU対戦（強）</button>
        <button class="btn danger" id="goCpuOni">CPU対戦（鬼）</button>
        <button class="btn" id="goFree">フリー対戦（ランダム）</button>
        <button class="btn warn" id="goRated">レート対戦（近い人同士）</button>
        <button class="btn primary" id="goStory">ストーリー（ボス戦）</button>
      </div>
      <div class="hr"></div>
      <div class="notice">
        <b>止まらない設計</b><br>
        マッチングが混雑しても、画面が空になったり、ずっと「読み込み中」のままになることはありません。いつでも練習に戻れます。
      </div>
    </div>

    <div class="grid grid2" style="margin-top:12px">
      <div>${renderProfileBar("free")}</div>
      <div class="card">
        <div class="h2">採点（1問あたり）</div>
        <ul class="list">
          <li>正解：+${SCORE.correct}</li>
          <li>早さボーナス：最大 +${SCORE.speedMax}（早いほど加点）</li>
          <li>不正解：0</li>
        </ul>
        <div class="hr"></div>
        <div class="small">同点は「合計スコア → 正解数 → 総回答時間（短い方）」で判定します。</div>
      </div>
    </div>
  `;
  $("#goPractice").onclick = ()=> startMatch("practice");
  $("#goPracticeCalc").onclick = ()=> startMatch("practice_calc");
  $("#goPracticeMemory").onclick = ()=> startMatch("practice_memory");
  $("#goPracticeLogic").onclick = ()=> startMatch("practice_logic");
  $("#goCpuEasy").onclick = ()=> startMatch("cpu_easy");
  $("#goCpuMid").onclick  = ()=> startMatch("cpu_mid");
  $("#goCpuHard").onclick = ()=> startMatch("cpu_hard");
  $("#goCpuOni").onclick  = ()=> startMatch("cpu_oni");
  $("#goFree").onclick = ()=> startQueue("free");
  $("#goRated").onclick = ()=> startQueue("rated");
  $("#goStory").onclick = ()=> renderStoryHome();
}

function startQueue(modeKey){
  const preset = MODE_PRESETS[modeKey];
  const el = $("#app");
  const started = timeNow();
  let cancelled = false;

  el.innerHTML = `
    <div class="card">
      <div class="h2">${preset.label}</div>
      <div class="small">対戦相手を探しています…（最大15秒で自動切替）</div>
      <div class="hr"></div>
      <div class="progress"><div id="bar"></div></div>
      <div class="btnRow" style="margin-top:12px">
        <button class="btn danger" id="cancelBtn">キャンセル</button>
        <button class="btn ghost" id="practiceBtn">練習を続ける</button>
      </div>
      <div class="hr"></div>
      <div class="notice">
        <b>待ち時間の間も遊べます</b><br>
        練習10問はいつでも即開始できます。読み込み待ちだけの画面にはしません。
      </div>
    </div>
  `;

  $("#cancelBtn").onclick = ()=> { cancelled = true; renderPlayHome(); };
  $("#practiceBtn").onclick = ()=> { cancelled = true; startMatch("practice"); };

  const bar = $("#bar");
  const tick = () => {
    if (cancelled) return;
    const t = (timeNow() - started);
    const frac = clamp(t / 15000, 0, 1);
    bar.style.width = `${Math.floor(frac*100)}%`;
    if (frac < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  setTimeout(()=>{ if (!cancelled) startMatch(modeKey); }, preset.queueDelayMs);
  setTimeout(()=>{ if (!cancelled) startMatch(modeKey); }, 15000);
}

function startMatch(modeKey){
  const preset = MODE_PRESETS[modeKey];
  const onlyGenre =
    (modeKey==="practice_calc") ? "calc" :
    (modeKey==="practice_memory") ? "memory" :
    (modeKey==="practice_logic") ? "logic" : null;
  const qset = pickQuestions(10, onlyGenre);

  const profile = getProfile();
  const meMmr = profile.mmr ?? 1000;

  const players = [];
  players.push(mkPlayer("あなた"));

  if (preset.bots > 0){
    if (preset.botSkill === "match"){
      const botMmrs = [
        meMmr + Math.floor((Math.random()-0.5)*260),
        meMmr + Math.floor((Math.random()-0.5)*260),
        meMmr + Math.floor((Math.random()-0.5)*260),
      ];
      players.push(mkBot("Bot A","mid", botMmrs[0]));
      players.push(mkBot("Bot B","mid", botMmrs[1]));
      players.push(mkBot("Bot C","mid", botMmrs[2]));
    } else if (preset.botSkill === "mix"){
      players.push(mkBot("Bot A","mix"));
      players.push(mkBot("Bot B","mix"));
      players.push(mkBot("Bot C","mix"));
    } else {
      players.push(mkBot("Bot A",preset.botSkill));
      players.push(mkBot("Bot B",preset.botSkill));
      players.push(mkBot("Bot C",preset.botSkill));
    }
  }

  const state = {
    modeKey, preset, players, qset, qIndex: 0,
    answerLog: [],
    timeLimit: 7.0, phase: "question",
    startedAt: null, myAnswered: false, myAnswer: null
  };

  renderMatch(state);
}

function renderMatch(state){
  const el = $("#app");
  const q = state.qset[state.qIndex];
  const n = state.qIndex + 1;

  el.innerHTML = `
    <div class="card">
      <div class="badge ${state.modeKey==="rated" ? "orange" : (state.modeKey==="free" ? "green" : "")}">
        ${escapeHtml(state.preset.label)}
      </div>
      <div class="h2" style="margin-top:10px">第${n}問 / 10　<span class="pill">${GENRE_LABEL[q.genre]}</span> <span class="pill">${q.format==="mcq"?"4択":"数字入力"}</span></div>
      <div class="hr"></div>

      ${q.genre==="memory" && q.memory ? `
        <div class="notice" id="memBox">
          <b>記憶表示（${q.memory.show_ms}ms）:</b>
          <span id="memSeq" style="font-weight:950">${q.memory.sequence.join(" ")}</span>
        </div>
        <div class="hr"></div>
      `: ""}

      <div style="font-size:18px;font-weight:950">${escapeHtml(q.prompt)}</div>
      <div class="small" style="margin-top:6px">制限時間：${state.timeLimit.toFixed(0)}秒　（早いほどボーナス）</div>

      <div class="hr"></div>
      <div id="answerArea"></div>

      <div class="hr"></div>
      <div class="btnRow">
        <button class="btn ghost" id="quitBtn">中断して戻る</button>
      </div>
    </div>

    <div class="grid grid2" style="margin-top:12px">
      <div class="card">
        <div class="h2">スコアボード</div>
        ${renderScoreboard(state)}
      </div>
      <div class="card">
        <div class="h2">この試合の状況</div>
        <div class="small">マッチング待ちでも止まらない設計（練習に切替可）。</div>
        <div class="hr"></div>
        <div class="small" id="timerText">開始準備中…</div>
        <div class="progress" style="margin-top:8px"><div id="timeBar"></div></div>
      </div>
    </div>
  `;

  $("#quitBtn").onclick = renderPlayHome;

  if (q.genre==="memory" && q.memory){
    setTimeout(()=>{
      const m = $("#memSeq");
      if (m) m.textContent = "（非表示）";
    }, q.memory.show_ms);
  }

  const area = $("#answerArea");
  if (q.format==="mcq"){
    const buttons = q.choices.map((c, idx)=> `
      <button class="btn choiceBtn" data-idx="${idx}">${escapeHtml(c)}</button>
    `).join("");
    area.innerHTML = `<div class="grid grid2">${buttons}</div>`;
    area.querySelectorAll("button[data-idx]").forEach(btn=>{
      btn.onclick = ()=> onHumanAnswer(state, parseInt(btn.dataset.idx,10));
    });
    state._keyHandler = (e)=>{
      if (state.phase!=="question") return;
      if (["1","2","3","4"].includes(e.key)){
        onHumanAnswer(state, parseInt(e.key,10)-1);
      }
    };
    window.addEventListener("keydown", state._keyHandler, { once:false });
  }else{
    area.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center">
        <input class="input" id="numInput" inputmode="numeric" placeholder="数字を入力" />
        <button class="btn" id="sendBtn">送信</button>
      </div>
    `;
    const inp = $("#numInput");
    const send = ()=> onHumanAnswer(state, inp.value);
    $("#sendBtn").onclick = send;
    state._keyHandler = (e)=>{
      if (state.phase!=="question") return;
      if (e.key==="Enter") send();
    };
    window.addEventListener("keydown", state._keyHandler, { once:false });
    setTimeout(()=>inp.focus(), 50);
  }

  state.phase = "question";
  state.startedAt = timeNow();
  state.myAnswered = false;
  state.myAnswer = null;

  runTimer(state);
  simulateBots(state);
}

function removeKeyHandler(state){
  if (state._keyHandler){
    window.removeEventListener("keydown", state._keyHandler);
    state._keyHandler = null;
  }
}

function runTimer(state){
  const start = state.startedAt;
  const limitMs = state.timeLimit * 1000;

  const tick = ()=>{
    if (state.phase!=="question") return;
    const t = timeNow() - start;
    const left = Math.max(0, limitMs - t);
    const frac = clamp(t / limitMs, 0, 1);
    const bar = $("#timeBar");
    const txt = $("#timerText");
    if (bar) bar.style.width = `${Math.floor(frac*100)}%`;
    if (txt) txt.textContent = `残り ${(left/1000).toFixed(1)} 秒`;
    if (t >= limitMs){
      resolveQuestion(state);
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function onHumanAnswer(state, ans){
  if (state.phase!=="question") return;
  if (state.myAnswered) return;
  state.myAnswered = true;
  state.myAnswer = ans;
  resolveQuestion(state);
}

function simulateBots(state){
  const q = state.qset[state.qIndex];
  const start = state.startedAt;

  state.players.forEach((p)=>{
    if (p.type!=="bot") return;
    let acc = p.acc;
    let avg = p.avgSec;
    if (p.focusGenre && p.focusGenre===q.genre){
      acc = Math.min(0.99, acc + (p.focusBonusAcc ?? 0.05));
      avg = Math.max(0.40, avg * (p.focusSpeedMul ?? 0.85));
    }
    const t = Math.max(0.45, avg + (Math.random()-0.5)*0.7);
    setTimeout(()=>{
      if (state.phase!=="question") return;
      const isCorrect = Math.random() < acc;
      const timeSec = (timeNow()-start)/1000;
      const pick = ()=>{
        if (q.format==="mcq"){
          if (isCorrect) return q.answer_index;
          const opts=[0,1,2,3].filter(x=>x!==q.answer_index);
          return opts[Math.floor(Math.random()*opts.length)];
        }else{
          if (isCorrect) return q.answer_value;
          return q.answer_value + (Math.random()<0.5?-1:1) * (1+Math.floor(Math.random()*3));
        }
      };
      const ans = pick();
      p._last = { ans, timeSec: Math.min(timeSec, state.timeLimit), correct: computeCorrect(q, ans) };
    }, t*1000);
  });
}

function resolveQuestion(state){
  if (state.phase!=="question") return;
  state.phase = "resolve";

  removeKeyHandler(state);

  const q = state.qset[state.qIndex];
  const endTimeSec = (timeNow() - state.startedAt)/1000;

  const me = state.players[0];
  const myTime = clamp(endTimeSec, 0, state.timeLimit);
  const myCorrect = state.myAnswered ? computeCorrect(q, state.myAnswer) : false;
  const myScore = scoreForAnswer(myCorrect, myTime, state.timeLimit);
  state.answerLog.push({
    genre: q.genre,
    correct: myCorrect,
    timeSec: myTime,
    myAnswered: state.myAnswered,
    myAnswer: state.myAnswered ? state.myAnswer : null,
    q: {
      id: q.id,
      genre: q.genre,
      format: q.format,
      prompt: q.prompt,
      choices: q.choices || null,
      answer_index: (q.answer_index ?? null),
      answer_value: (q.answer_value ?? null),
      memory: q.memory || null,
    }
  });
  me.score += myScore;
  me.correct += myCorrect ? 1 : 0;
  me.timeSum += myCorrect ? myTime : 0;
  me.totalTime += myTime;

  for (let i=1;i<state.players.length;i++){
    const p = state.players[i];
    if (p.type!=="bot") continue;
    const last = p._last;
    const correct = last?.correct ?? false;
    const timeSec = clamp(last?.timeSec ?? state.timeLimit, 0, state.timeLimit);
    const sc = scoreForAnswer(correct, timeSec, state.timeLimit);
    p.score += sc;
    p.correct += correct ? 1 : 0;
    p.timeSum += correct ? timeSec : 0;
    p.totalTime += timeSec;
    p._last = null;
  }

  const area = $("#answerArea");
  const msg = myCorrect ? `<div class="notice good"><b>正解！</b> +${myScore}</div>`
                        : `<div class="notice bad"><b>不正解</b> +0</div>`;
  area.innerHTML = msg + `<div class="small" style="margin-top:8px">次の問題へ進みます…</div>`;

  const boardCard = document.querySelector(".card .table")?.closest(".card");
  if (boardCard){
    boardCard.innerHTML = `<div class="h2">スコアボード</div>${renderScoreboard(state)}`;
  }

  setTimeout(()=> nextQuestion(state), 900);
}

function rankPlayers(players){
  const arr = players.slice();
  arr.sort((a,b)=>{
    if (b.score !== a.score) return b.score - a.score;
    if (b.correct !== a.correct) return b.correct - a.correct;
    // 同点判定：総回答時間（短い方が上）
    if ((a.totalTime ?? 0) !== (b.totalTime ?? 0)) return (a.totalTime ?? 0) - (b.totalTime ?? 0);
    // 念のため：正解した回答時間の合計（短い方が上）
    return (a.timeSum ?? 0) - (b.timeSum ?? 0);
  });
  return arr;
}

function renderScoreboard(state){
  const ranked = rankPlayers(state.players);
  const rows = ranked.map((p, idx)=>`
    <tr>
      <td>${idx+1}</td>
      <td>${escapeHtml(p.name)}</td>
      <td>${p.score}</td>
      <td>${p.correct}</td>
    </tr>
  `).join("");
  return `
    <table class="table">
      <thead><tr><th>順位</th><th>プレイヤー</th><th>スコア</th><th>正解</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function nextQuestion(state){
  state.qIndex++;
  if (state.qIndex >= state.qset.length){
    finishMatch(state);
    return;
  }
  renderMatch(state);
}


function buildPracticeReview(state){
  const logs = state.answerLog || [];
  if (!logs.length) return "";
  const rows = logs.map((a, i)=>{
    const q = a.q || {};
    const genre = GENRE_LABEL[q.genre] || q.genre || "—";

    let qText = escapeHtml(q.prompt || "");
    if (q.memory && Array.isArray(q.memory.sequence)){
      const seq = q.memory.sequence.join(" ");
      qText += `<div class="small muted" style="margin-top:4px">表示：${escapeHtml(seq)}</div>`;
    }

    let correctText = "—";
    if (q.format==="mcq" && q.choices && q.answer_index!=null){
      correctText = q.choices[q.answer_index];
    } else if (q.format==="numeric" && q.answer_value!=null){
      correctText = String(q.answer_value);
    }

    let myText = "未回答";
    if (a.myAnswered){
      if (q.format==="mcq" && q.choices){
        const idx = parseInt(a.myAnswer,10);
        myText = Number.isFinite(idx) && q.choices[idx]!=null ? q.choices[idx] : String(a.myAnswer ?? "");
      }else{
        myText = String(a.myAnswer ?? "").trim();
      }
    }

    const badge = a.correct ? `<span class="pill" style="background:#e7fff1;border-color:#bdebd0">○</span>` :
                              `<span class="pill" style="background:#ffeaea;border-color:#f3b2b2">×</span>`;

    return `<tr>
      <td>${i+1}</td>
      <td>${badge}</td>
      <td>${escapeHtml(genre)}</td>
      <td>${qText}</td>
      <td>${escapeHtml(myText)}</td>
      <td>${escapeHtml(correctText)}</td>
    </tr>`;
  }).join("");

  return `
    <div class="hr"></div>
    <details>
      <summary style="cursor:pointer;font-weight:700">復習（問題と正答を見る）</summary>
      <div style="margin-top:10px">
        <table class="table">
          <thead><tr>
            <th>#</th><th>判定</th><th>ジャンル</th><th>問題</th><th>あなた</th><th>正答</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="small muted" style="margin-top:8px">※復習は練習モードのみ表示されます。</div>
      </div>
    </details>
  `;
}


function finishMatch(state){
  removeKeyHandler(state);

  const ranked = rankPlayers(state.players);
  const myRank = ranked.findIndex(p=>p.type==="human") + 1;

  // 戦績保存（この端末のローカルに保存）
  try{
    const totalQ = state.qset.length;
    const youP = state.players[0];
    const genre = { calc:{correct:0,total:0}, memory:{correct:0,total:0}, logic:{correct:0,total:0} };
    for (const a of (state.answerLog||[])){
      if (!a || !genre[a.genre]) continue;
      genre[a.genre].total++;
      if (a.correct) genre[a.genre].correct++;
    }
    const entry = {
      ts: Date.now(),
      modeKey: state.modeKey,
      rank: myRank,
      score: youP.score,
      correct: youP.correct,
      totalQ,
      totalTimeSec: (youP.totalTime ?? 0),
      genre
    };
    const arr = readMatchStats();
    arr.push(entry);
    // 無限増加を防ぐ（直近300件のみ保持）
    while (arr.length > 300) arr.shift();
    writeMatchStats(arr);
  }catch(e){}


  if (state.modeKey === "rated"){
    const profile = getProfile();
    const base = (myRank===1?30:(myRank===2?15:(myRank===3?5:0)));

    const avg = Math.round(ranked.reduce((s,p)=>s+(p.mmr??1000),0) / ranked.length);
    const me = profile.mmr ?? 1000;
    const underdog = Math.max(0, avg - me);
    const bonus = Math.min(10, Math.floor(underdog/150)*2);

    let add = base;
    if (myRank===1) add = base + bonus;
    if (myRank===2) add = base + Math.floor(bonus/2);

    profile.rp = (profile.rp ?? 0) + add;

    const expected = 2.5 - clamp((me-avg)/400, -1.0, 1.0);
    const delta = Math.round((expected - myRank) * 24);
    profile.mmr = Math.max(200, Math.round((profile.mmr ?? 1000) + delta));

    profile.matches = (profile.matches ?? 0) + 1;
    profile.bestRank = profile.bestRank ? Math.min(profile.bestRank, myRank) : myRank;
    saveProfile(profile);

    state._rpAdded = add;
    state._mmrDelta = delta;
    state._avgMmr = avg;
  }

  const el = $("#app");
  const you = state.players[0];
  const resultBadge = myRank===1 ? "good" : (myRank===4 ? "bad" : "");
  const extra = state.modeKey==="rated" ? `
    <div class="hr"></div>
    <div class="notice ${resultBadge}">
      <b>レート結果</b><br>
      RP +${state._rpAdded}（減りません）<br>
      内部MMR ${state._mmrDelta>=0?"+":""}${state._mmrDelta}（ロビー平均 ${state._avgMmr}）
    </div>
  ` : "";
  const storyExtra = state.storyStage ? (()=>{
    const boss = state.players.find(p=>p.isBoss);
    const bossRank = boss ? (ranked.findIndex(p=>p===boss)+1) : 99;
    const clear = myRank < bossRank;
    const st = state.storyStage;
    const story = readStory();
    const id = String(st.id);
    if (clear){
      story.cleared = story.cleared || {};
      if (!story.cleared[id]) story.cleared[id] = { bestRank: myRank, bestScore: state.players[0].score };
      else{
        story.cleared[id].bestRank = Math.min(story.cleared[id].bestRank ?? myRank, myRank);
        story.cleared[id].bestScore = Math.max(story.cleared[id].bestScore ?? 0, state.players[0].score);
      }
      story.unlocked = Math.max(story.unlocked ?? 1, st.id + 1);
      story.unlocked = clamp(story.unlocked, 1, STORY_STAGES.length);
      writeStory(story);
    }
    // 戻る先をストーリーに
    state._onBack = renderStoryHome;

    const msg = clear
      ? `<div class="notice good"><b>ストーリー結果：クリア！</b><br>STAGE ${String(st.id).padStart(2,"0")} を突破。次のステージを解放しました。</div>`
      : `<div class="notice bad"><b>ストーリー結果：未クリア</b><br>BOSSより上位に入るとクリアです。もう一回挑戦してみてください。</div>`;
    return msg;
  })() : "";


  const practiceReview = (String(state.modeKey).startsWith("practice")) ? buildPracticeReview(state) : "";


  const rows = rankPlayers(state.players).map((p, idx)=>`
    <tr><td>${idx+1}</td><td>${escapeHtml(p.name)}</td><td>${p.score}</td><td>${p.correct}</td></tr>
  `).join("");

  el.innerHTML = `
    <div class="card">
      <div class="h2">結果</div>
      <div class="notice ${resultBadge}">
        <b>あなたの順位：</b>${myRank}位　／　スコア ${you.score}　／　正解 ${you.correct}　／　総回答時間 ${Math.round((you.totalTime ?? 0))}秒
      </div>
      ${extra}${storyExtra}
      <div class="hr"></div>
      <table class="table">
        <thead><tr><th>順位</th><th>プレイヤー</th><th>スコア</th><th>正解</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${practiceReview}
      <div class="btnRow" style="margin-top:12px">
        <button class="btn primary" id="againBtn">もう一回</button>
        <button class="btn ghost" id="backBtn">戻る</button>
      </div>
    </div>
  `;

  $("#backBtn").onclick = (state._onBack || renderPlayHome);
  $("#againBtn").onclick = ()=>{
    // もう一回：モードに応じて適切に再開
    if (state.storyStage){
      startStory(state.storyStage.id);
      return;
    }
    const mk = state.modeKey;
    if (mk==="practice" || mk==="practice_calc" || mk==="practice_memory" || mk==="practice_logic" ||
        mk==="cpu_easy" || mk==="cpu_mid" || mk==="cpu_hard" || mk==="cpu_oni"){
      startMatch(mk);
      return;
    }
    startQueue(mk);
  };
}

window.RQA = { renderPlayHome, startQueue, startMatch };

document.addEventListener("DOMContentLoaded", ()=>{
  const h = location.hash || "";
  if (h.startsWith("#story-")){
    const n = parseInt(h.replace("#story-",""),10);
    if (!isNaN(n)) { startStory(n); return; }
  }
  if (h==="#story"){ renderStoryHome(); return; }
  renderPlayHome();
});