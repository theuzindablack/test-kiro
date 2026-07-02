// ══════════════════════════════════════════════════════════════════
//  CONTROLLER.JS
// ══════════════════════════════════════════════════════════════════

const urlParams  = new URLSearchParams(location.search);
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

// Esconde todos os controles específicos de jogo + topbar
function hideAllControls() {
  ['ctrl-topbar','ctrl-shooter','ctrl-snake','ctrl-pong','ctrl-race'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('ctrl-visible'); el.classList.add('ctrl-hidden'); }
  });
}

// Mostra o controle do jogo atual
function showGameControl(game) {
  hideAllControls();
  const topbar = document.getElementById('ctrl-topbar');
  topbar.classList.remove('ctrl-hidden'); topbar.classList.add('ctrl-visible');
  const map = { shooter:'ctrl-shooter', snake:'ctrl-snake', pong:'ctrl-pong', race:'ctrl-race' };
  const el = document.getElementById(map[game] || 'ctrl-shooter');
  el.classList.remove('ctrl-hidden'); el.classList.add('ctrl-visible');
}

// ── Estado ────────────────────────────────────────────────────────
let conn            = null;
let myData          = null;
let gpReady         = false;
let currentGameMode = 'shooter';
const state         = { jx: 0, jy: 0 };   // estado de input compartilhado
let sendLoop        = null;

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

  const myPeer = new Peer(undefined, {
    host: '0.peerjs.com', port: 443, secure: true,
    config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
  });

  myPeer.on('error', () => {
    status.textContent = 'Erro de conexão.';
    document.getElementById('btn-join').disabled = false;
  });

  myPeer.on('open', () => {
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
      conn.send({ type: 'join', name });
    });

    conn.on('data', msg => handleMsg(msg));

    conn.on('close', () => {
      if (!myData) return;
      showMsg('📡', 'Desconectado', 'A TV se desconectou.');
    });

    conn.on('error', () => {
      status.textContent = 'Erro de conexão.';
      document.getElementById('btn-join').disabled = false;
    });
  });
}

// ── Mensagens da TV ───────────────────────────────────────────────
function handleMsg(msg) {
  switch (msg.type) {
    case 'registered':
      myData = msg.player;
      setupWaitScreen();
      setupMenuScreen(msg.game || null, msg.gameName || null);
      showScreen('s-menu');
      break;

    case 'game-picked':
      updateMenuPicked(msg.gameName, msg.pickedBy);
      document.getElementById('wait-game-name').textContent = msg.gameName;
      document.querySelectorAll('.mgame-card').forEach(c =>
        c.classList.toggle('selected', c.dataset.game === msg.game));
      break;

    case 'room-full':
      showMsg('😔', 'Sala Cheia', 'Máximo de 6 jogadores atingido.');
      break;

    case 'game-start':
      currentGameMode = msg.game || 'shooter';
      showGameController(currentGameMode);
      break;

    case 'score':
      document.getElementById('t-score').textContent = msg.value;
      break;

    case 'game-over':
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      showMsg('🏁', 'Fim de Jogo!', 'Voltando ao início em 8s...');
      setTimeout(() => location.reload(), 8000);
      break;
  }
}

// ── Tela de espera ────────────────────────────────────────────────
function setupWaitScreen() {
  const badge = document.getElementById('w-badge');
  badge.textContent      = myData.pid.slice(-1) || '?';
  badge.style.color      = myData.color;
  badge.style.borderColor = myData.color;
  document.getElementById('w-name').textContent     = myData.name;
  document.getElementById('tdot').style.background  = myData.color;
  document.getElementById('t-name').textContent     = myData.name;
}

// ── Menu de jogos ─────────────────────────────────────────────────
function setupMenuScreen(game, gameName) {
  document.getElementById('menu-greeting').textContent  = myData.name;
  document.getElementById('menu-room-info').textContent = 'Sala: ' + (document.getElementById('inp-room').value || '---');
  document.getElementById('menu-avatar').style.borderColor = myData.color;
  if (game && gameName) {
    updateMenuPicked(gameName, '');
    document.querySelectorAll('.mgame-card').forEach(c =>
      c.classList.toggle('selected', c.dataset.game === game));
  }
}

function updateMenuPicked(gameName, pickedBy) {
  const el  = document.getElementById('menu-picked');
  const txt = document.getElementById('menu-picked-text');
  el.classList.remove('hidden');
  txt.textContent = pickedBy
    ? pickedBy + ' escolheu ' + gameName + ' — aperte Pronto!'
    : '✅ ' + gameName + ' selecionado — aperte Pronto!';
}

// Cards de jogo
document.querySelectorAll('.mgame-card').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!conn || !conn.open) return;
    const game     = btn.dataset.game;
    const gameName = btn.querySelector('.mgame-name').textContent;
    document.querySelectorAll('.mgame-card').forEach(c => c.classList.remove('selected'));
    btn.classList.add('selected');
    conn.send({ type: 'pick-game', game });
    if (navigator.vibrate) navigator.vibrate(30);
    document.getElementById('wait-game-name').textContent =
      btn.querySelector('.mgame-icon').textContent + ' ' + gameName;
    showScreen('s-wait');
  });
});

document.getElementById('btn-leave').addEventListener('click', () => {
  if (conn) conn.close();
  location.reload();
});

document.getElementById('btn-ready').addEventListener('click', () => {
  if (!conn || !conn.open) return;
  conn.send({ type: 'ready' });
  document.getElementById('btn-ready').classList.add('hidden');
  document.getElementById('ready-ok').classList.remove('hidden');
  document.getElementById('btn-back-menu').classList.add('hidden');
});

document.getElementById('btn-back-menu').addEventListener('click', () => {
  showScreen('s-menu');
});

// Botão 🏠 na topbar — volta ao menu de seleção de jogo
document.getElementById('btn-back-home').addEventListener('click', () => {
  // Para o loop de envio
  if (sendLoop) { clearInterval(sendLoop); sendLoop = null; gpReady = false; }
  // Reseta state
  state.jx = 0; state.jy = 0;
  Object.keys(state).forEach(k => { if (k !== 'jx' && k !== 'jy') state[k] = false; });
  hideAllControls();
  showScreen('s-menu');
});

// ── Mostrar controle do jogo certo ────────────────────────────────
function showGameController(game) {
  // Esconde todas as telas
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  showGameControl(game);
  if (!gpReady) {
    gpReady = true;
    initSendLoop();
    if (game === 'shooter') initShooterControl();
    else if (game === 'snake')   initSnakeControl();
    else if (game === 'pong')    initPongControl();
    else if (game === 'race')    initRaceControl();
  }
}

// Envia input a 20fps
function initSendLoop() {
  sendLoop = setInterval(() => {
    if (conn && conn.open) conn.send({ type: 'input', data: { ...state } });
  }, 50);
}

// ══════════════════════════════════════════════════════════════════
//  CONTROLE 1 — SHOOTER: joystick + botão ATIRAR
// ══════════════════════════════════════════════════════════════════
function initShooterControl() {
  initJoystick('jbase-shooter', 'jknob-shooter', 44);

  const btn = document.getElementById('btn-shoot');
  const press   = e => { e.preventDefault(); btn.classList.add('pressed'); state.A = true;  if (navigator.vibrate) navigator.vibrate(18); };
  const release = e => { e.preventDefault(); btn.classList.remove('pressed'); state.A = false; };
  btn.addEventListener('touchstart',  press,   { passive: false });
  btn.addEventListener('touchend',    release, { passive: false });
  btn.addEventListener('touchcancel', release, { passive: false });
  btn.addEventListener('mousedown', press);
  btn.addEventListener('mouseup',   release);
}

// ══════════════════════════════════════════════════════════════════
//  CONTROLE 2 — SNAKE: D-pad com 4 setas
// ══════════════════════════════════════════════════════════════════
function initSnakeControl() {
  const dirMap = { up:{jx:0,jy:-1}, down:{jx:0,jy:1}, left:{jx:-1,jy:0}, right:{jx:1,jy:0} };

  document.querySelectorAll('.dpad-btn').forEach(btn => {
    const dir = btn.dataset.dir;

    const press = e => {
      e.preventDefault();
      btn.classList.add('pressed');
      state.jx = dirMap[dir].jx;
      state.jy = dirMap[dir].jy;
      if (navigator.vibrate) navigator.vibrate(18);
    };
    const release = e => {
      e.preventDefault();
      btn.classList.remove('pressed');
      // Não reseta — mantém última direção (snake continua andando)
    };

    btn.addEventListener('touchstart',  press,   { passive: false });
    btn.addEventListener('touchend',    release, { passive: false });
    btn.addEventListener('touchcancel', release, { passive: false });
    btn.addEventListener('mousedown', press);
    btn.addEventListener('mouseup',   release);
  });
}

// ══════════════════════════════════════════════════════════════════
//  CONTROLE 3 — PONG: botões ▲ e ▼
// ══════════════════════════════════════════════════════════════════
function initPongControl() {
  const upBtn   = document.getElementById('pong-up');
  const downBtn = document.getElementById('pong-down');

  const makeHandlers = (btn, jyVal) => {
    const press   = e => { e.preventDefault(); btn.classList.add('pressed'); state.jy = jyVal; if (navigator.vibrate) navigator.vibrate(12); };
    const release = e => { e.preventDefault(); btn.classList.remove('pressed'); state.jy = 0; };
    btn.addEventListener('touchstart',  press,   { passive: false });
    btn.addEventListener('touchend',    release, { passive: false });
    btn.addEventListener('touchcancel', release, { passive: false });
    btn.addEventListener('mousedown', press);
    btn.addEventListener('mouseup',   release);
  };

  makeHandlers(upBtn,   -1);
  makeHandlers(downBtn,  1);
}

// ══════════════════════════════════════════════════════════════════
//  CONTROLE 4 — CORRIDA: joystick horizontal
// ══════════════════════════════════════════════════════════════════
function initRaceControl() {
  const leftArrow  = document.getElementById('race-arrow-left');
  const rightArrow = document.getElementById('race-arrow-right');

  initJoystick('jbase-race', 'jknob-race', 52, jx => {
    // Acende as setas visualmente
    leftArrow.classList.toggle('active',  jx < -0.2);
    rightArrow.classList.toggle('active', jx >  0.2);
  });
}

// ══════════════════════════════════════════════════════════════════
//  JOYSTICK GENÉRICO — usado pelo Shooter e pela Corrida
// ══════════════════════════════════════════════════════════════════
function initJoystick(baseId, knobId, MAX, onMove) {
  const base   = document.getElementById(baseId);
  const knob   = document.getElementById(knobId);
  let active   = false;

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
    if (onMove) onMove(state.jx, state.jy);
  };

  const reset = () => {
    active = false;
    state.jx = 0; state.jy = 0;
    knob.style.transform = 'translate(-50%,-50%)';
    if (onMove) onMove(0, 0);
  };

  base.addEventListener('touchstart',  e => { e.preventDefault(); active = true; move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
  base.addEventListener('touchmove',   e => { e.preventDefault(); if (active) move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
  base.addEventListener('touchend',    e => { e.preventDefault(); reset(); }, { passive: false });
  base.addEventListener('touchcancel', () => reset(), { passive: false });
  base.addEventListener('mousedown',   () => { active = true; });
  window.addEventListener('mousemove', e => { if (active) move(e.clientX, e.clientY); });
  window.addEventListener('mouseup',   () => { if (active) reset(); });
}
