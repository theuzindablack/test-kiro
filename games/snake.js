// ══════════════════════════════════════════════════════════════════
//  JOGO 2 — SNAKE BATALHA
//  Globals esperados: canvas, ctx, players, sendTo, broadcast,
//                     showGameOver, updateHUD, clamp, esc, currentRAF
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
