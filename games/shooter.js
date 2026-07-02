// ══════════════════════════════════════════════════════════════════
//  JOGO 1 — ARENA SHOOTER
//  Globals esperados: canvas, ctx, players, sendTo, broadcast,
//                     showGameOver, updateHUD, clamp, esc, currentRAF
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
