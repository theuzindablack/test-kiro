// ══════════════════════════════════════════════════════════════════
//  JOGO 3 — PONG 2v2
//  Globals esperados: canvas, ctx, players, sendTo, broadcast,
//                     showGameOver, updateHUD, clamp, esc, currentRAF,
//                     ROOM_ID
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
