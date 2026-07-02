// ══════════════════════════════════════════════════════════════════
//  TV.JS  —  Tela principal (roda no notebook / TV)
//  Jogos: Arena Shooter, Snake Batalha, Pong 2v2, Corrida
// ══════════════════════════════════════════════════════════════════

const COLORS  = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c'];
const MEDALS  = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣'];
const MAX_PLR = 6;
const GAME_NAMES = {
  shooter: '🔫 Arena Shooter',
  snake:   '🐍 Snake Batalha',
  pong:    '🏓 Pong 2v2',
  race:    '🏎️ Corrida'
};

// Jogo é definido pelo celular, não pela TV
let selectedGame = null;

// ── Gera ID de sala ──────────────────────────────────────────────
function makeRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

const ROOM_ID = makeRoomId();
const PEER_ID = 'airgame-tv-' + ROOM_ID;

// ── Estado ───────────────────────────────────────────────────────
const conns   = {};
const players = {};
let gameRunning = false;
let cdTimer     = null;

// ── PeerJS ───────────────────────────────────────────────────────
const peer = new Peer(PEER_ID, {
  host: '0.peerjs.com', port: 443, secure: true,
  config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
});

peer.on('open', () => showQR());
peer.on('error', err => {
  console.warn('[TV] Peer error:', err.type, err.message);
  if (err.type === 'unavailable-id')
    document.getElementById('qr-spinner').textContent = '⚠️ ID ocupado. Recarregue.';
});

peer.on('connection', conn => {
  const pid = conn.peer;
  conn.on('open', () => {
    if (Object.keys(players).length >= MAX_PLR) { conn.send({ type: 'room-full' }); conn.close(); return; }
    conns[pid] = conn;
  });
  conn.on('data', msg => handleMsg(pid, msg));
  conn.on('close', () => { removePlayer(pid); });
  conn.on('error', e => console.warn('[TV] conn error:', e));
});

// ── Mensagens dos controles ──────────────────────────────────────
function handleMsg(pid, msg) {
  switch (msg.type) {
    case 'join':   addPlayer(pid, msg.name); break;
    case 'pick-game':
      // Aceita mudança de jogo enquanto o jogo não iniciou e ninguém está pronto ainda
      if (!gameRunning) {
        const anyReady = Object.values(players).some(p => p.ready);
        if (!anyReady) {
          selectedGame = msg.game;
          const name = GAME_NAMES[selectedGame] || selectedGame;
          document.getElementById('lobby-game-name').textContent = name + ' — aperte Pronto!';
          broadcast({ type: 'game-picked', game: selectedGame, gameName: name, pickedBy: players[pid] ? players[pid].name : '' });
        }
      }
      break;
    case 'ready':
      if (!selectedGame) return; // não pode ficar pronto sem jogo escolhido
      if (players[pid]) { players[pid].ready = true; renderLobby(); checkAllReady(); }
      break;
    case 'input':
      if (gameRunning) applyInput(pid, msg.data);
      break;
  }
}

function applyInput(pid, data) {
  if (selectedGame === 'shooter') {
    if (SHOOTER.ents[pid]) SHOOTER.ents[pid].input = data;
  } else if (selectedGame === 'snake') {
    // Não sobrescreve o objeto inteiro — só atualiza jx/jy no objeto existente
    if (SNAKE.inputs[pid]) {
      SNAKE.inputs[pid].jx = data.jx || 0;
      SNAKE.inputs[pid].jy = data.jy || 0;
    }
  } else if (selectedGame === 'pong') {
    // Pong usa jy para mover o paddle
    if (!PONG.inputs[pid]) PONG.inputs[pid] = {};
    PONG.inputs[pid].jy = data.jy || 0;
  } else if (selectedGame === 'race') {
    // Corrida usa jx para mover o carro
    if (RACE.cars[pid]) RACE.cars[pid].input = data;
  }
}

function sendTo(pid, msg) { if (conns[pid] && conns[pid].open) conns[pid].send(msg); }
function broadcast(msg)   { Object.keys(conns).forEach(pid => sendTo(pid, msg)); }

// ── Jogadores ────────────────────────────────────────────────────
function addPlayer(pid, name) {
  const idx = Object.keys(players).length;
  players[pid] = { pid, name, color: COLORS[idx % COLORS.length], ready: false, score: 0 };
  // Envia confirmação; se já tem jogo escolhido, informa também
  const msg = { type: 'registered', player: players[pid] };
  if (selectedGame) { msg.game = selectedGame; msg.gameName = GAME_NAMES[selectedGame]; }
  sendTo(pid, msg);
  renderLobby();
}

function removePlayer(pid) {
  delete players[pid]; delete conns[pid];
  renderLobby();
}

// ── QR Code ──────────────────────────────────────────────────────
function showQR() {
  document.getElementById('qr-spinner').style.display = 'none';
  const base = location.href.replace(/[^/]*$/, '') + 'controller.html';
  const url  = base + '?room=' + ROOM_ID;
  document.getElementById('room-id').textContent  = ROOM_ID;
  document.getElementById('ctrl-url').textContent = url;
  new QRCode(document.getElementById('qr-img'), {
    text: url, width: 180, height: 180,
    colorDark: '#6c63ff', colorLight: '#12122a',
    correctLevel: QRCode.CorrectLevel.H
  });
}

// ── Lobby ─────────────────────────────────────────────────────────
function renderLobby() {
  const list = document.getElementById('players-list');
  list.innerHTML = '';
  Object.values(players).forEach(p => {
    const d = document.createElement('div');
    d.className = 'pcard' + (p.ready ? ' ready' : '');
    d.innerHTML = `<div class="pdot" style="background:${p.color}"></div>
      <div><div class="pname">${esc(p.name)}</div>
      <div class="pstatus">${p.ready ? '✅ Pronto' : 'Aguardando...'}</div></div>`;
    list.appendChild(d);
  });
  document.getElementById('lobby-wait').classList.toggle('hidden', Object.keys(players).length > 0);
}

function checkAllReady() {
  if (gameRunning || cdTimer) return;
  const list = Object.values(players);
  if (list.length < 1 || !list.every(p => p.ready)) return;
  startCountdown();
}

function startCountdown() {
  const hint = document.getElementById('lobby-hint');
  const cdEl  = document.getElementById('cd');
  hint.classList.remove('hidden');
  let n = 3; cdEl.textContent = n;
  cdTimer = setInterval(() => {
    n--; cdEl.textContent = n;
    if (n <= 0) { clearInterval(cdTimer); cdTimer = null; startGame(); }
  }, 1000);
}

// ── Iniciar jogo certo ────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

function startGame() {
  if (!selectedGame) { console.warn('[TV] Nenhum jogo selecionado!'); return; }
  document.getElementById('lobby').classList.remove('active');
  document.getElementById('game').classList.add('active');
  document.getElementById('hud-round').textContent = 'Sala: ' + ROOM_ID;
  gameRunning = true;
  resize(); window.addEventListener('resize', resize);
  broadcast({ type: 'game-start', game: selectedGame });
  console.log('[TV] Iniciando jogo:', selectedGame);
  if      (selectedGame === 'shooter') startShooter();
  else if (selectedGame === 'snake')   startSnake();
  else if (selectedGame === 'pong')    startPong();
  else if (selectedGame === 'race')    startRace();
  else { console.error('[TV] Jogo desconhecido:', selectedGame); }
}

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}

function showGameOver(sorted) {
  cancelAnimationFrame(currentRAF);
  gameRunning = false;
  const fin = document.getElementById('final-list');
  fin.innerHTML = sorted.map((e, i) => `
    <div class="fr">
      <span>${MEDALS[i] || (i+1)+'.'}  </span>
      <div style="width:14px;height:14px;border-radius:50%;background:${e.color}"></div>
      <span>${esc(e.name)}</span>
      <strong>${e.score} pts</strong>
    </div>`).join('');
  document.getElementById('gameover').classList.remove('hidden');
  broadcast({ type: 'game-over', results: sorted.map(e => ({ name: e.name, score: e.score })) });
  setTimeout(() => location.reload(), 8000);
}

function updateHUD(ents) {
  const sc = document.getElementById('hud-scores');
  sc.innerHTML = '';
  ents.forEach(e => {
    const d = document.createElement('div');
    d.className = 'hs';
    d.innerHTML = `<div class="hd" style="background:${e.color}"></div>${esc(e.name)} <strong>${e.score}</strong>`;
    sc.appendChild(d);
  });
}

let currentRAF = null;
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ══════════════════════════════════════════════════════════════════
//  JOGO 1 — ARENA SHOOTER
// ══════════════════════════════════════════════════════════════════
const SHOOTER = { ents: {}, bullets: [] };

function startShooter() {
  SHOOTER.ents = {}; SHOOTER.bullets = [];
  const plist = Object.entries(players);
  plist.forEach(([pid, p], i) => {
    const a = (2 * Math.PI / plist.length) * i;
    SHOOTER.ents[pid] = {
      pid, color: p.color, name: p.name,
      x: canvas.width/2 + Math.cos(a)*canvas.width*0.3,
      y: canvas.height/2 + Math.sin(a)*canvas.height*0.3,
      vx: 0, vy: 0, angle: 0, hp: 3, score: 0, r: 24, cd: 0,
      input: { jx: 0, jy: 0 }
    };
  });
  updateHUD(Object.values(SHOOTER.ents));
  (function loop() {
    shooterUpdate(); shooterDraw();
    currentRAF = requestAnimationFrame(loop);
  })();
}

function shooterUpdate() {
  const W = canvas.width, H = canvas.height;
  Object.values(SHOOTER.ents).forEach(e => {
    if (e.hp <= 0) return;
    const { jx=0, jy=0, A } = e.input;
    const len = Math.hypot(jx, jy);
    if (len > 0.08) {
      e.vx = (jx/Math.max(len,1))*3.5; e.vy = (jy/Math.max(len,1))*3.5;
      e.angle = Math.atan2(jy, jx);
    } else { e.vx *= 0.8; e.vy *= 0.8; }
    e.x = clamp(e.x+e.vx, e.r, W-e.r);
    e.y = clamp(e.y+e.vy, e.r, H-e.r);
    if (A && e.cd <= 0) {
      SHOOTER.bullets.push({ x: e.x+Math.cos(e.angle)*(e.r+8), y: e.y+Math.sin(e.angle)*(e.r+8),
        vx: Math.cos(e.angle)*7.5, vy: Math.sin(e.angle)*7.5, color: e.color, owner: e.pid, life: 140 });
      e.cd = 18;
    }
    if (e.cd > 0) e.cd--;
  });
  const ents = Object.values(SHOOTER.ents);
  SHOOTER.bullets = SHOOTER.bullets.filter(b => {
    b.x += b.vx; b.y += b.vy; b.life--;
    if (b.x<4||b.x>canvas.width-4) b.vx*=-1;
    if (b.y<4||b.y>canvas.height-4) b.vy*=-1;
    if (b.life<=0) return false;
    for (const e of ents) {
      if (e.pid===b.owner||e.hp<=0) continue;
      if (Math.hypot(e.x-b.x,e.y-b.y)<e.r+5) {
        e.hp--;
        const owner = SHOOTER.ents[b.owner];
        if (owner) { owner.score+=100; sendTo(b.owner,{type:'score',value:owner.score}); }
        updateHUD(ents);
        const alive = ents.filter(x=>x.hp>0);
        if (alive.length<=1) showGameOver([...ents].sort((a,b)=>b.score-a.score));
        return false;
      }
    }
    return true;
  });
}

function shooterDraw() {
  const W=canvas.width, H=canvas.height;
  ctx.clearRect(0,0,W,H);
  ctx.strokeStyle='rgba(108,99,255,.055)'; ctx.lineWidth=1;
  for(let x=0;x<W;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=60){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  SHOOTER.bullets.forEach(b=>{
    ctx.beginPath();ctx.arc(b.x,b.y,5,0,Math.PI*2);
    ctx.fillStyle=b.color;ctx.shadowBlur=12;ctx.shadowColor=b.color;ctx.fill();ctx.shadowBlur=0;
  });
  Object.values(SHOOTER.ents).forEach(e=>{
    ctx.globalAlpha=e.hp>0?1:0.15;
    ctx.beginPath();ctx.arc(e.x,e.y,e.r,0,Math.PI*2);
    ctx.fillStyle=e.color+'28';ctx.strokeStyle=e.color;ctx.lineWidth=3;
    ctx.shadowBlur=16;ctx.shadowColor=e.color;ctx.fill();ctx.stroke();ctx.shadowBlur=0;
    ctx.beginPath();ctx.moveTo(e.x,e.y);
    ctx.lineTo(e.x+Math.cos(e.angle)*(e.r+14),e.y+Math.sin(e.angle)*(e.r+14));
    ctx.strokeStyle=e.color;ctx.lineWidth=3;ctx.stroke();
    for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(e.x-18+i*18,e.y-e.r-14,5,0,Math.PI*2);
      ctx.fillStyle=i<e.hp?e.color:'#1e1e2e';ctx.fill();}
    ctx.fillStyle='#ffffffcc';ctx.font='bold 12px Segoe UI,sans-serif';
    ctx.textAlign='center';ctx.fillText(e.name,e.x,e.y+e.r+18);
    ctx.globalAlpha=1;
  });
}

// ══════════════════════════════════════════════════════════════════
//  JOGO 2 — SNAKE BATALHA
// ══════════════════════════════════════════════════════════════════
const SNAKE = { segs: {}, inputs: {}, food: [], timer: 0 };
const SZ = 20; // tamanho do grid

function startSnake() {
  SNAKE.segs = {}; SNAKE.inputs = {}; SNAKE.food = [];
  const plist = Object.entries(players);
  const cols = Math.floor(canvas.width / SZ);
  const rows = Math.floor(canvas.height / SZ);
  plist.forEach(([pid, p], i) => {
    const gx = 2 + (i % 3) * Math.floor(cols/3);
    const gy = 2 + Math.floor(i/3) * Math.floor(rows/2);
    SNAKE.segs[pid]   = [{ x: gx, y: gy }, { x: gx-1, y: gy }, { x: gx-2, y: gy }];
    SNAKE.inputs[pid] = { dir: { x:1, y:0 }, next: { x:1, y:0 } };
    players[pid].score = 0;
  });
  spawnFood(5);
  updateHUD(Object.values(players).map(p => ({ ...p })));
  let tick = 0;
  (function loop() {
    tick++;
    if (tick % 8 === 0) snakeUpdate();
    snakeDraw();
    currentRAF = requestAnimationFrame(loop);
  })();
}

function spawnFood(n) {
  const cols = Math.floor(canvas.width/SZ), rows = Math.floor(canvas.height/SZ);
  for (let i=0;i<n;i++) SNAKE.food.push({ x: 1+Math.floor(Math.random()*(cols-2)), y: 1+Math.floor(Math.random()*(rows-2)) });
}

function snakeUpdate() {
  const cols = Math.floor(canvas.width/SZ), rows = Math.floor(canvas.height/SZ);
  const alive = Object.keys(SNAKE.segs).filter(pid => SNAKE.segs[pid].length > 0);

  // Aplica input
  alive.forEach(pid => {
    const inp = SNAKE.inputs[pid];
    // jx/jy do joystick → direção discreta
    const ax = Math.abs(inp.jx || 0), ay = Math.abs(inp.jy || 0);
    if (ax > 0.4 || ay > 0.4) {
      if (ax > ay) inp.next = { x: inp.jx > 0 ? 1 : -1, y: 0 };
      else         inp.next = { x: 0, y: inp.jy > 0 ? 1 : -1 };
    }
    // Não deixar inverter 180°
    if (inp.next.x !== -inp.dir.x || inp.next.y !== -inp.dir.y)
      inp.dir = { ...inp.next };
  });

  // Move cada cobra
  alive.forEach(pid => {
    const segs = SNAKE.segs[pid];
    const head = segs[0];
    const dir  = SNAKE.inputs[pid].dir;
    const nx = ((head.x + dir.x) + cols) % cols;
    const ny = ((head.y + dir.y) + rows) % rows;

    // Colisão com qualquer cobra (incluindo a própria)
    let hit = false;
    for (const pid2 of Object.keys(SNAKE.segs)) {
      const checkSegs = pid2 === pid ? segs.slice(1) : SNAKE.segs[pid2]; // ignora a cabeça própria
      for (const s of checkSegs) {
        if (s.x === nx && s.y === ny) { hit = true; break; }
      }
      if (hit) break;
    }
    if (hit) { SNAKE.segs[pid] = []; return; }

    // Come comida?
    const fi = SNAKE.food.findIndex(f => f.x === nx && f.y === ny);
    if (fi >= 0) {
      SNAKE.food.splice(fi, 1); spawnFood(1);
      players[pid].score += 50;
      sendTo(pid, { type:'score', value:players[pid].score });
    } else {
      segs.pop();
    }
    segs.unshift({ x:nx, y:ny });
  });

  updateHUD(Object.values(players).map(p=>({...p})));
  const stillAlive = Object.keys(SNAKE.segs).filter(pid=>SNAKE.segs[pid].length>0);
  if (stillAlive.length <= 1 && Object.keys(players).length > 1) {
    const sorted = Object.values(players).sort((a,b)=>b.score-a.score);
    showGameOver(sorted);
  }
}

function snakeDraw() {
  const W=canvas.width, H=canvas.height;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#0d0d20'; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(108,99,255,.04)'; ctx.lineWidth=1;
  for(let x=0;x<W;x+=SZ){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=SZ){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  // Comida
  SNAKE.food.forEach(f=>{
    ctx.fillStyle='#f39c12';ctx.shadowBlur=10;ctx.shadowColor='#f39c12';
    ctx.fillRect(f.x*SZ+2,f.y*SZ+2,SZ-4,SZ-4);ctx.shadowBlur=0;
  });
  // Cobras
  Object.entries(SNAKE.segs).forEach(([pid,segs])=>{
    if(!segs.length) return;
    const color=players[pid]?players[pid].color:'#fff';
    segs.forEach((s,i)=>{
      ctx.fillStyle=i===0?color:color+'99';
      ctx.shadowBlur=i===0?12:0;ctx.shadowColor=color;
      ctx.fillRect(s.x*SZ+1,s.y*SZ+1,SZ-2,SZ-2);
    });
    ctx.shadowBlur=0;
  });
}

// ══════════════════════════════════════════════════════════════════
//  JOGO 3 — PONG 2v2
// ══════════════════════════════════════════════════════════════════
const PONG = {
  ball: { x:0,y:0,vx:4,vy:3,r:10 },
  paddles: {},  // pid → { x, y, w, h, team }
  inputs: {},   // pid → { jy }
  score: [0,0]  // [teamA, teamB]
};
const WIN_SCORE = 7;

function startPong() {
  PONG.score = [0,0]; PONG.paddles = {}; PONG.inputs = {};
  const plist = Object.keys(players);
  const W=canvas.width, H=canvas.height;
  plist.forEach((pid, i) => {
    const team = i % 2; // 0=esquerda, 1=direita
    const slot  = Math.floor(i / 2);
    const ph    = 100;
    PONG.paddles[pid] = {
      x: team===0 ? 30 : W-50,
      y: H/2 - ph/2 + slot * (ph+20),
      w: 20, h: ph, team,
      color: players[pid].color, name: players[pid].name
    };
    PONG.inputs[pid] = { jy: 0 };
    players[pid].score = 0;
  });
  pongResetBall();
  updateHUD(Object.values(players).map(p=>({...p})));
  document.getElementById('hud-round').textContent = 'Time A  0 × 0  Time B  |  Sala: ' + ROOM_ID;
  (function loop() {
    pongUpdate(); pongDraw();
    currentRAF = requestAnimationFrame(loop);
  })();
}

function pongResetBall() {
  const W=canvas.width, H=canvas.height;
  PONG.ball = { x:W/2, y:H/2, vx:(Math.random()>0.5?1:-1)*4.5, vy:(Math.random()*4-2), r:10 };
}

function pongUpdate() {
  const W=canvas.width, H=canvas.height;
  const b=PONG.ball;

  // Mover paddles
  Object.entries(PONG.paddles).forEach(([pid,pad])=>{
    const inp = PONG.inputs[pid];
    pad.y += (inp.jy||0) * 7;
    pad.y  = clamp(pad.y, 0, H-pad.h);
  });

  b.x+=b.vx; b.y+=b.vy;
  if(b.y-b.r<0){b.y=b.r;b.vy*=-1;}
  if(b.y+b.r>H){b.y=H-b.r;b.vy*=-1;}

  // Colisão com paddles — checa lado correto para evitar tunnel
  Object.values(PONG.paddles).forEach(pad=>{
    const hitX = b.x + b.r > pad.x && b.x - b.r < pad.x + pad.w;
    const hitY = b.y + b.r > pad.y && b.y - b.r < pad.y + pad.h;
    if(hitX && hitY){
      // Empurra bola para fora do paddle
      b.vx *= -1;
      b.vx  = clamp(b.vx * 1.05, -14, 14);
      b.vy += (b.y - (pad.y + pad.h/2)) * 0.15;
      b.vy  = clamp(b.vy, -10, 10);
      // Separa a bola do paddle
      if(pad.team === 0) b.x = pad.x + pad.w + b.r + 1;
      else               b.x = pad.x - b.r - 1;
    }
  });

  // Ponto
  if(b.x-b.r<0){
    PONG.score[1]++;
    document.getElementById('hud-round').textContent=`Time A  ${PONG.score[0]} × ${PONG.score[1]}  Time B  |  Sala: ${ROOM_ID}`;
    if(PONG.score[1]>=WIN_SCORE) pongEnd();
    else pongResetBall();
  }
  if(b.x+b.r>W){
    PONG.score[0]++;
    document.getElementById('hud-round').textContent=`Time A  ${PONG.score[0]} × ${PONG.score[1]}  Time B  |  Sala: ${ROOM_ID}`;
    if(PONG.score[0]>=WIN_SCORE) pongEnd();
    else pongResetBall();
  }
}

function pongEnd() {
  const winner = PONG.score[0]>PONG.score[1] ? 0 : 1;
  Object.entries(PONG.paddles).forEach(([pid,pad])=>{
    players[pid].score = pad.team===winner ? 500 : 0;
  });
  const sorted=Object.values(players).sort((a,b)=>b.score-a.score);
  showGameOver(sorted);
}

function pongDraw() {
  const W=canvas.width, H=canvas.height;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#07071a';ctx.fillRect(0,0,W,H);
  // Linha central
  ctx.setLineDash([20,15]);ctx.strokeStyle='#ffffff18';ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(W/2,0);ctx.lineTo(W/2,H);ctx.stroke();ctx.setLineDash([]);
  // Bola
  const b=PONG.ball;
  ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);
  ctx.fillStyle='#fff';ctx.shadowBlur=18;ctx.shadowColor='#fff';ctx.fill();ctx.shadowBlur=0;
  // Paddles
  Object.values(PONG.paddles).forEach(pad=>{
    ctx.fillStyle=pad.color;ctx.shadowBlur=14;ctx.shadowColor=pad.color;
    ctx.beginPath();ctx.roundRect(pad.x,pad.y,pad.w,pad.h,6);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='#ffffffcc';ctx.font='bold 11px Segoe UI,sans-serif';ctx.textAlign='center';
    ctx.fillText(pad.name,pad.x+pad.w/2,pad.y-6);
  });
  // Placar grande
  ctx.fillStyle='#ffffff18';ctx.font='bold clamp(4rem,10vw,8rem) Segoe UI,sans-serif';ctx.textAlign='center';
  ctx.fillText(PONG.score[0],W*0.25,H*0.2);
  ctx.fillText(PONG.score[1],W*0.75,H*0.2);
}

// ══════════════════════════════════════════════════════════════════
//  JOGO 4 — CORRIDA (desvie dos obstáculos)
// ══════════════════════════════════════════════════════════════════
const RACE = { cars: {}, obstacles: [], speed: 4, tick: 0 };
const LANE_W = 80;

function startRace() {
  RACE.cars = {}; RACE.obstacles = []; RACE.speed = 4; RACE.tick = 0;
  const plist = Object.entries(players);
  const W=canvas.width, H=canvas.height;
  const totalW = plist.length * LANE_W;
  const startX = (W - totalW) / 2;
  plist.forEach(([pid,p],i)=>{
    RACE.cars[pid]={ pid, color:p.color, name:p.name,
      x: startX + i*LANE_W + LANE_W/2, y: H*0.8,
      vx:0, alive:true, score:0, input:{jx:0} };
    players[pid].score=0;
  });
  updateHUD(Object.values(players).map(p=>({...p})));
  (function loop(){
    RACE.tick++;
    raceUpdate(); raceDraw();
    currentRAF=requestAnimationFrame(loop);
  })();
}

function raceUpdate(){
  const W=canvas.width, H=canvas.height;
  if(RACE.tick % 40===0){
    for(let i=0;i<3;i++) RACE.obstacles.push({ x:Math.random()*(W-40)+20, y:-30, w:36, h:36 });
  }
  RACE.speed = 4 + RACE.tick/800;
  RACE.obstacles=RACE.obstacles.filter(o=>{ o.y+=RACE.speed; return o.y<H+50; });

  Object.values(RACE.cars).forEach(car=>{
    if(!car.alive) return;
    const jx = (car.input && car.input.jx) || 0;
    car.vx = jx * 5;
    car.x  = clamp(car.x + car.vx, 20, W-20);
    car.score = Math.floor(RACE.tick/10);
    players[car.pid].score = car.score;
    for(const o of RACE.obstacles){
      if(Math.abs(car.x - (o.x+o.w/2)) < o.w/2+14 &&
         Math.abs(car.y - (o.y+o.h/2)) < o.h/2+14){
        car.alive = false;
        sendTo(car.pid, { type:'score', value:car.score });
        break;
      }
    }
  });

  updateHUD(Object.values(RACE.cars).map(c=>({name:c.name,color:c.color,score:c.score})));
  const alive = Object.values(RACE.cars).filter(c=>c.alive);
  if(alive.length === 0){
    const sorted = Object.values(RACE.cars).sort((a,b)=>b.score-a.score)
      .map(c=>({name:c.name,color:c.color,score:c.score}));
    showGameOver(sorted);
  }
}

function raceDraw(){
  const W=canvas.width, H=canvas.height;
  ctx.clearRect(0,0,W,H);
  // Fundo estrada
  ctx.fillStyle='#111122';ctx.fillRect(0,0,W,H);
  // Linhas da estrada animadas
  ctx.strokeStyle='#ffffff0a';ctx.lineWidth=2;
  const off=(RACE.tick*RACE.speed)%80;
  for(let x=80;x<W;x+=80){
    ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();
  }
  for(let y=-off;y<H;y+=80){
    ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();
  }
  // Obstáculos
  RACE.obstacles.forEach(o=>{
    ctx.fillStyle='#e74c3c';ctx.shadowBlur=10;ctx.shadowColor='#e74c3c';
    ctx.beginPath();ctx.roundRect(o.x,o.y,o.w,o.h,6);ctx.fill();ctx.shadowBlur=0;
  });
  // Carros
  Object.values(RACE.cars).forEach(car=>{
    ctx.globalAlpha=car.alive?1:0.2;
    ctx.fillStyle=car.color;ctx.shadowBlur=16;ctx.shadowColor=car.color;
    ctx.beginPath();ctx.roundRect(car.x-14,car.y-22,28,44,8);ctx.fill();
    ctx.fillStyle='#000a';ctx.beginPath();ctx.roundRect(car.x-9,car.y-16,18,28,4);ctx.fill();
    ctx.shadowBlur=0;
    ctx.fillStyle='#ffffffcc';ctx.font='bold 11px Segoe UI,sans-serif';ctx.textAlign='center';
    ctx.fillText(car.name,car.x,car.y-28);
    ctx.globalAlpha=1;
  });
}
