// ══════════════════════════════════════════════════════════════════
//  TV.JS  —  Tela principal (roda no notebook / TV)
//  Tecnologia: PeerJS (WebRTC P2P) — sem servidor, sem instalar nada
// ══════════════════════════════════════════════════════════════════

const COLORS  = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c'];
const MEDALS  = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣'];
const MAX_PLR = 6;

// ── Gera ID de sala curto e legível ──────────────────────────────
function makeRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

const ROOM_ID  = makeRoomId();
const PEER_ID  = 'airgame-tv-' + ROOM_ID;   // ID fixo para os celulares encontrarem

// ── Estado ───────────────────────────────────────────────────────
const conns   = {};   // { pid: DataConnection }
const players = {};   // { pid: { name, color, ready, score } }
let gameRunning   = false;
let cdTimer       = null;

// ── PeerJS ───────────────────────────────────────────────────────
const peer = new Peer(PEER_ID, {
  host: '0.peerjs.com', port: 443, secure: true,
  config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
});

peer.on('open', id => {
  console.log('[TV] Peer aberto:', id);
  showQR();
});

peer.on('error', err => {
  // Se o ID já está em uso (outra aba/sessão), gera novo ID
  console.warn('[TV] Peer error:', err.type, err.message);
  if (err.type === 'unavailable-id') {
    document.getElementById('qr-spinner').textContent = '⚠️ ID ocupado. Recarregue a página.';
  }
});

peer.on('connection', conn => {
  const pid = conn.peer;

  conn.on('open', () => {
    if (Object.keys(players).length >= MAX_PLR) {
      conn.send({ type: 'room-full' });
      conn.close();
      return;
    }
    conns[pid] = conn;
    console.log('[TV] Controller conectado:', pid);
  });

  conn.on('data', msg => handleMsg(pid, msg));

  conn.on('close', () => {
    console.log('[TV] Controller desconectou:', pid);
    removePlayer(pid);
  });

  conn.on('error', e => console.warn('[TV] conn error:', e));
});

// ── Mensagens recebidas dos controles ────────────────────────────
function handleMsg(pid, msg) {
  switch (msg.type) {
    case 'join':
      addPlayer(pid, msg.name);
      break;
    case 'ready':
      if (players[pid]) {
        players[pid].ready = true;
        renderLobby();
        checkAllReady();
      }
      break;
    case 'input':
      if (gameRunning && GAME.ents[pid]) {
        GAME.ents[pid].input = msg.data;
      }
      break;
  }
}

// ── Enviar mensagem para um controle ─────────────────────────────
function sendTo(pid, msg) {
  if (conns[pid] && conns[pid].open) conns[pid].send(msg);
}

function broadcast(msg) {
  Object.keys(conns).forEach(pid => sendTo(pid, msg));
}

// ── Jogadores ────────────────────────────────────────────────────
function addPlayer(pid, name) {
  const idx   = Object.keys(players).length;
  const color = COLORS[idx % COLORS.length];
  players[pid] = { pid, name, color, ready: false, score: 0 };
  sendTo(pid, { type: 'registered', player: players[pid] });
  renderLobby();
}

function removePlayer(pid) {
  delete players[pid];
  delete conns[pid];
  if (gameRunning && GAME.ents[pid]) {
    delete GAME.ents[pid];
    updateHUD();
    checkEnd();
  }
  renderLobby();
}

// ── QR Code ──────────────────────────────────────────────────────
function showQR() {
  const spinner = document.getElementById('qr-spinner');
  spinner.style.display = 'none';

  // URL do controller com o room id na query string
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
  const n = Object.keys(players).length;
  document.getElementById('lobby-wait').classList.toggle('hidden', n > 0);
}

function checkAllReady() {
  if (gameRunning || cdTimer) return;
  const list = Object.values(players);
  if (list.length < 1) return;
  if (list.every(p => p.ready)) startCountdown();
}

function startCountdown() {
  const hint = document.getElementById('lobby-hint');
  const cdEl  = document.getElementById('cd');
  hint.classList.remove('hidden');
  let n = 3;
  cdEl.textContent = n;
  cdTimer = setInterval(() => {
    n--;
    cdEl.textContent = n;
    if (n <= 0) { clearInterval(cdTimer); cdTimer = null; startGame(); }
  }, 1000);
}

// ══════════════════════════════════════════════════════════════════
//  JOGO — Arena Shooter
// ══════════════════════════════════════════════════════════════════
const GAME = { ents: {}, bullets: [], W: 0, H: 0, raf: null };
const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

function startGame() {
  document.getElementById('lobby').classList.remove('active');
  const gameEl = document.getElementById('game');
  gameEl.classList.add('active');
  gameRunning = true;

  resize(); window.addEventListener('resize', resize);

  // Spawnar jogadores em círculo
  GAME.ents    = {};
  GAME.bullets = [];
  const plist  = Object.entries(players);
  plist.forEach(([pid, p], i) => {
    const a = (2 * Math.PI / plist.length) * i;
    GAME.ents[pid] = {
      pid, color: p.color, name: p.name,
      x: GAME.W / 2 + Math.cos(a) * GAME.W * 0.3,
      y: GAME.H / 2 + Math.sin(a) * GAME.H * 0.3,
      vx: 0, vy: 0, angle: 0,
      hp: 3, score: 0, r: 24, cd: 0,
      input: { jx: 0, jy: 0 }
    };
  });

  broadcast({ type: 'game-start' });
  updateHUD();
  gameLoop();
}

function resize() {
  GAME.W = canvas.width  = window.innerWidth;
  GAME.H = canvas.height = window.innerHeight;
}

// ── Loop ──────────────────────────────────────────────────────────
function gameLoop() {
  update(); draw();
  GAME.raf = requestAnimationFrame(gameLoop);
}

function update() {
  const ents = Object.values(GAME.ents);

  ents.forEach(e => {
    if (e.hp <= 0) return;
    const { jx = 0, jy = 0, A } = e.input;
    const spd = 3.5, len = Math.hypot(jx, jy);

    if (len > 0.08) {
      e.vx = (jx / Math.max(len, 1)) * spd;
      e.vy = (jy / Math.max(len, 1)) * spd;
      e.angle = Math.atan2(jy, jx);
    } else { e.vx *= 0.8; e.vy *= 0.8; }

    e.x = clamp(e.x + e.vx, e.r, GAME.W - e.r);
    e.y = clamp(e.y + e.vy, e.r, GAME.H - e.r);

    if (A && e.cd <= 0) { shoot(e); e.cd = 18; }
    if (e.cd > 0) e.cd--;
  });

  GAME.bullets = GAME.bullets.filter(b => {
    b.x += b.vx; b.y += b.vy; b.life--;
    if (b.x < 4 || b.x > GAME.W - 4) b.vx *= -1;
    if (b.y < 4 || b.y > GAME.H - 4) b.vy *= -1;
    if (b.life <= 0) return false;

    for (const e of ents) {
      if (e.pid === b.owner || e.hp <= 0) continue;
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 5) {
        e.hp--;
        const owner = GAME.ents[b.owner];
        if (owner) {
          owner.score += 100;
          sendTo(b.owner, { type: 'score', value: owner.score });
        }
        updateHUD(); checkEnd();
        return false;
      }
    }
    return true;
  });
}

function shoot(e) {
  const spd = 7.5;
  GAME.bullets.push({
    x: e.x + Math.cos(e.angle) * (e.r + 8),
    y: e.y + Math.sin(e.angle) * (e.r + 8),
    vx: Math.cos(e.angle) * spd, vy: Math.sin(e.angle) * spd,
    color: e.color, owner: e.pid, life: 140
  });
}

// ── Draw ──────────────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, GAME.W, GAME.H);

  // Grid de fundo
  ctx.strokeStyle = 'rgba(108,99,255,.055)';
  ctx.lineWidth = 1;
  for (let x = 0; x < GAME.W; x += 60) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,GAME.H); ctx.stroke(); }
  for (let y = 0; y < GAME.H; y += 60) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(GAME.W,y); ctx.stroke(); }

  // Balas
  GAME.bullets.forEach(b => {
    ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI*2);
    ctx.fillStyle = b.color;
    ctx.shadowBlur = 12; ctx.shadowColor = b.color;
    ctx.fill(); ctx.shadowBlur = 0;
  });

  // Entidades
  Object.values(GAME.ents).forEach(e => {
    ctx.globalAlpha = e.hp > 0 ? 1 : 0.15;

    // Corpo
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI*2);
    ctx.fillStyle   = e.color + '28';
    ctx.strokeStyle = e.color; ctx.lineWidth = 3;
    ctx.shadowBlur  = 16; ctx.shadowColor = e.color;
    ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;

    // Canhão
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x + Math.cos(e.angle)*(e.r+14), e.y + Math.sin(e.angle)*(e.r+14));
    ctx.strokeStyle = e.color; ctx.lineWidth = 3; ctx.stroke();

    // HP pips
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.arc(e.x - 18 + i*18, e.y - e.r - 14, 5, 0, Math.PI*2);
      ctx.fillStyle = i < e.hp ? e.color : '#1e1e2e'; ctx.fill();
    }

    // Nome
    ctx.fillStyle = '#ffffffcc'; ctx.font = 'bold 12px Segoe UI,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(e.name, e.x, e.y + e.r + 18);
    ctx.globalAlpha = 1;
  });
}

function updateHUD() {
  const sc = document.getElementById('hud-scores');
  sc.innerHTML = '';
  Object.values(GAME.ents).forEach(e => {
    const d = document.createElement('div');
    d.className = 'hs';
    d.innerHTML = `<div class="hd" style="background:${e.color}"></div>${esc(e.name)} <strong>${e.score}</strong>`;
    sc.appendChild(d);
  });
}

function checkEnd() {
  const alive = Object.values(GAME.ents).filter(e => e.hp > 0);
  if (alive.length <= 1 || Object.keys(GAME.ents).length === 0) endGame();
}

function endGame() {
  cancelAnimationFrame(GAME.raf);
  gameRunning = false;

  const sorted = Object.values(GAME.ents).sort((a, b) => b.score - a.score);
  const fin = document.getElementById('final-list');
  fin.innerHTML = sorted.map((e, i) => `
    <div class="fr">
      <span>${MEDALS[i] || (i+1)+'.'}</span>
      <div style="width:14px;height:14px;border-radius:50%;background:${e.color}"></div>
      <span>${esc(e.name)}</span>
      <strong>${e.score} pts</strong>
    </div>`).join('');

  document.getElementById('gameover').classList.remove('hidden');
  broadcast({ type: 'game-over', results: sorted.map(e => ({ name: e.name, score: e.score })) });

  setTimeout(() => location.reload(), 8000);
}

// ── Utils ─────────────────────────────────────────────────────────
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
