// ══════════════════════════════════════════════════════════════════
//  CONTROLLER.JS  —  Celular vira controle via PeerJS (WebRTC P2P)
// ══════════════════════════════════════════════════════════════════

// ── Pega o room ID da URL ─────────────────────────────────────────
const urlParams = new URLSearchParams(location.search);
const roomFromURL = (urlParams.get('room') || '').toUpperCase();
if (roomFromURL) document.getElementById('inp-room').value = roomFromURL;

// ── Telas ─────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function showMsg(icon, title, body) {
  document.getElementById('msg-icon').textContent  = icon;
  document.getElementById('msg-title').textContent = title;
  document.getElementById('msg-body').textContent  = body;
  showScreen('s-msg');
}

// ── Estado ────────────────────────────────────────────────────────
let conn    = null;   // DataConnection com a TV
let myData  = null;   // { name, color, pid }
let gpReady = false;

// ── Join ──────────────────────────────────────────────────────────
document.getElementById('btn-join').addEventListener('click', doJoin);
document.getElementById('inp-name').addEventListener('keydown', e => { if (e.key === 'Enter') doJoin(); });
document.getElementById('inp-room').addEventListener('keydown', e => { if (e.key === 'Enter') doJoin(); });

function doJoin() {
  const name   = document.getElementById('inp-name').value.trim() || 'Jogador';
  const room   = document.getElementById('inp-room').value.trim().toUpperCase();
  const status = document.getElementById('join-status');

  if (!room) { status.textContent = 'Digite o ID da sala!'; return; }

  status.textContent = 'Conectando...';
  document.getElementById('btn-join').disabled = true;

  // Cria peer com ID aleatório
  const myPeer = new Peer(undefined, {
    host: '0.peerjs.com', port: 443, secure: true,
    config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
  });

  myPeer.on('error', err => {
    status.textContent = 'Erro: ' + err.message;
    document.getElementById('btn-join').disabled = false;
  });

  myPeer.on('open', myId => {
    // Conecta ao peer da TV
    const tvPeerId = 'airgame-tv-' + room;
    conn = myPeer.connect(tvPeerId, { reliable: true });

    const timeout = setTimeout(() => {
      status.textContent = 'Sala não encontrada. Verifique o ID.';
      document.getElementById('btn-join').disabled = false;
      conn.close();
    }, 8000);

    conn.on('open', () => {
      clearTimeout(timeout);
      status.textContent = '';
      // Envia pedido de entrada
      conn.send({ type: 'join', name });
    });

    conn.on('data', msg => handleMsg(msg, name));

    conn.on('close', () => {
      if (!myData) return; // ainda não entrou
      showMsg('📡', 'Desconectado', 'A TV se desconectou.');
    });

    conn.on('error', err => {
      status.textContent = 'Erro de conexão.';
      document.getElementById('btn-join').disabled = false;
    });
  });
}

// ── Mensagens da TV ───────────────────────────────────────────────
function handleMsg(msg, name) {
  switch (msg.type) {

    case 'registered':
      myData = msg.player;
      setupWaitScreen();
      showScreen('s-wait');
      break;

    case 'room-full':
      showMsg('😔', 'Sala Cheia', 'Máximo de 6 jogadores atingido.');
      break;

    case 'game-start':
      showController();
      break;

    case 'score':
      document.getElementById('t-score').textContent = msg.value;
      break;

    case 'game-over':
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      setTimeout(() => location.reload(), 8000);
      break;
  }
}

// ── Tela de espera ────────────────────────────────────────────────
function setupWaitScreen() {
  const badge = document.getElementById('w-badge');
  badge.textContent   = myData.pid.slice(-1) || '?'; // último char como número visual
  badge.style.color        = myData.color;
  badge.style.borderColor  = myData.color;
  document.getElementById('w-name').textContent = myData.name;
  document.getElementById('tdot').style.background = myData.color;
  document.getElementById('t-name').textContent    = myData.name;
}

document.getElementById('btn-ready').addEventListener('click', () => {
  if (!conn || !conn.open) return;
  conn.send({ type: 'ready' });
  document.getElementById('btn-ready').classList.add('hidden');
  document.getElementById('ready-ok').classList.remove('hidden');
});

// ── Mostrar controle ──────────────────────────────────────────────
function showController() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const ctrl = document.getElementById('ctrl');
  ctrl.classList.add('ctrl-visible');
  if (!gpReady) { gpReady = true; initGamepad(); }
}

// ══════════════════════════════════════════════════════════════════
//  GAMEPAD
// ══════════════════════════════════════════════════════════════════
const state  = { jx: 0, jy: 0 };    // joystick + botões compartilham este obj
let sendLoop = null;

function initGamepad() {
  initJoystick();
  initButtons();
  // Envia input para a TV a 20fps
  sendLoop = setInterval(() => {
    if (conn && conn.open) conn.send({ type: 'input', data: { ...state } });
  }, 50);
}

// ── Joystick ──────────────────────────────────────────────────────
function initJoystick() {
  const base = document.getElementById('jbase');
  const knob = document.getElementById('jknob');
  const MAX  = 44;
  let active = false;

  const getCenter = () => {
    const r = base.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  };

  const move = (clientX, clientY) => {
    const { cx, cy } = getCenter();
    let dx = clientX - cx, dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > MAX) { dx = dx / dist * MAX; dy = dy / dist * MAX; }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    state.jx = dx / MAX;
    state.jy = dy / MAX;
  };

  const reset = () => {
    active = false; state.jx = 0; state.jy = 0;
    knob.style.transform = 'translate(-50%,-50%)';
  };

  base.addEventListener('touchstart',  e => { e.preventDefault(); active = true; }, { passive: false });
  base.addEventListener('touchmove',   e => { e.preventDefault(); if (active) move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
  base.addEventListener('touchend',    e => { e.preventDefault(); reset(); }, { passive: false });
  base.addEventListener('touchcancel', e => { reset(); }, { passive: false });

  // Mouse (para testar no desktop)
  base.addEventListener('mousedown', () => { active = true; });
  window.addEventListener('mousemove', e => { if (active) move(e.clientX, e.clientY); });
  window.addEventListener('mouseup',   () => { if (active) reset(); });
}

// ── Botões ────────────────────────────────────────────────────────
function initButtons() {
  document.querySelectorAll('.abtn, .sh-btn').forEach(btn => {
    const a = btn.dataset.a;

    const press = e => {
      e.preventDefault();
      btn.classList.add('pressed');
      state[a] = true;
      if (navigator.vibrate) navigator.vibrate(22);
    };
    const release = e => {
      e.preventDefault();
      btn.classList.remove('pressed');
      state[a] = false;
    };

    btn.addEventListener('touchstart',  press,   { passive: false });
    btn.addEventListener('touchend',    release, { passive: false });
    btn.addEventListener('touchcancel', release, { passive: false });
    btn.addEventListener('mousedown', press);
    btn.addEventListener('mouseup',   release);
  });
}
