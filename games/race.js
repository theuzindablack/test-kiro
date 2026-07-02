// ══════════════════════════════════════════════════════════════════
//  JOGO 4 — CORRIDA (desvie dos obstáculos)
//  Globals esperados: canvas, ctx, players, sendTo, broadcast,
//                     showGameOver, updateHUD, clamp, esc, currentRAF
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
