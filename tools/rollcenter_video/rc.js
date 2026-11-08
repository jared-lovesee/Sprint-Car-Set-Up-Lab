// Roll centers, 9:16, 56 s: what the two roll centers are, how the front track bar and the Jacobs ladder
// clevis move them, and what that does to LR load on corner exit (0.7 g lateral, 0.5 g longitudinal, no wing).
// Rendered close-ups use the lab's own globals; the app footage is filmed by caprc.js into cap/<shot>/.
// Every shot is 5 s with one header; the voice-over goes on top. VID.init(), VID.still(t, name), VID.render().
(function(){
const W=1080,H=1920,FPS=30,SUB=8,SHUTTER=0.5,SHOT=5;
const O='#F2500F',BONE='#ECE6D8',INK='#0F1012',LG='#7A7D82',TG='#4A4C52';
const FONT=(px,w=700)=>`${w} ${px}px Bahnschrift, "Barlow Condensed", sans-serif`;
const LEAN=Math.tan(12*Math.PI/180);
const LEFT=64,RIGHT=W-124;   // Reels keeps the right edge for its buttons
const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');
const bg=document.createElement('canvas');bg.width=W;bg.height=H;const b=bg.getContext('2d');
const cl=u=>Math.max(0,Math.min(1,u)),sm=u=>{u=cl(u);return u*u*(3-2*u);},out3=u=>1-Math.pow(1-cl(u),3);
const q=(x,st)=>Math.round(x/st)*st;
const AB=(u,A,B)=>A*sm((u-.8)/.8)+(B-A)*sm((u-2.6)/.8);   // hold, ease to A, hold, ease to B, hold
const EXIT={g:.7,gx:.5};
const TB=[-4,4], CLEV=[-0.625,0.625];          // the two setups each comparison puts side by side

// ---------------- shots ----------------
// cam: [u, azimuth, elevation, distance, target x, y, z]; sh: px the picture is pushed up; cap: filmed from the app
const SHOTS=[
  {k:'open',cam:[[0,-28,5,520,0,0,30],[5,-44,9,480,4,0,26]],sh:-60},
  {k:'axis',head:'ROLL CENTERS',hl:[],cam:[[0,-58,12,560,0,0,20],[5,-70,14,545,0,0,20]],sh:60},
  {k:'exit',head:'CORNER EXIT',cap:1},
  {k:'tbar3d',head:'FRONT TRACK BAR',hl:['ftb'],cam:[[0,-6,6,350,42,0,16],[5,6,8,335,42,0,16]],sh:-40,exit:1},
  {k:'tbarapp',head:'FRONT TRACK BAR',cap:1},
  {k:'tbarlr',head:'LR LOAD ON EXIT',hl:[],cam:[[0,-38,14,600,0,0,22],[5,-46,16,585,0,0,22]],sh:260,exit:1,loads:1},
  {k:'lad3d',head:"JACOB'S LADDER",hl:['ladT','ladU','ladL'],cam:[[0,194,8,360,-44,0,15],[5,184,10,345,-44,0,15]],sh:-60,exit:1},
  {k:'ladapp',head:'CLEVIS HOLE',cap:1},
  {k:'ladlr',head:'LR LOAD ON EXIT',hl:[],cam:[[0,-38,14,600,0,0,22],[5,-46,16,585,0,0,22]],sh:260,exit:1,loads:1},
  {k:'sum',head:'FRONT VS REAR',hl:[],cam:[[0,-30,10,620,0,0,22],[5,-40,12,605,0,0,22]],sh:300,exit:1,loads:1},
  {k:'end'},
];
SHOTS.forEach((s,i)=>{s.t0=i*SHOT;s.t1=s.t0+SHOT;});
SHOTS[SHOTS.length-1].t1+=1;
const DUR=SHOTS[SHOTS.length-1].t1;
const shotAt=t=>SHOTS.find(s=>t<s.t1)||SHOTS[SHOTS.length-1];

// ---------------- look ----------------
let bgTex,stage3,fill,hemi,HL,logo;
function look(){
  window.requestAnimationFrame=()=>0;              // stop the lab's own loop; every frame is drawn from here
  document.body.style.visibility='hidden';
  for(const id of ['g','gx','bank','wing','fwing'])$(id).step='any';
  world.children.forEach(o=>{if(o.isLine||o.isArrowHelper||o.isMesh)o.visible=false;});
  grid.visible=false;
  renderer.setPixelRatio(1);renderer.setSize(W,H,false);cam.aspect=W/H;cam.fov=24;cam.updateProjectionMatrix();
  renderer.toneMapping=THREE.NoToneMapping;renderer.outputEncoding=THREE.sRGBEncoding;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  bgTex=new THREE.CanvasTexture(bg);bgTex.encoding=THREE.sRGBEncoding;scene.background=bgTex;
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-0.0006;sun.shadow.normalBias=.05;
  const c=sun.shadow.camera;c.left=-120;c.right=120;c.top=120;c.bottom=-120;c.near=10;c.far=800;c.updateProjectionMatrix();
  sun.intensity=.62;scene.add(sun.target);sun.target.position.set(0,0,10);
  hemi=scene.children.find(o=>o.isHemisphereLight);hemi.intensity=.60;
  const rg=document.createElement('canvas');rg.width=rg.height=256;const rc=rg.getContext('2d'),gr=rc.createRadialGradient(128,128,20,128,128,128);
  gr.addColorStop(0,'#fff');gr.addColorStop(.55,'#888');gr.addColorStop(1,'#000');rc.fillStyle=gr;rc.fillRect(0,0,256,256);
  stage3=new THREE.Mesh(new THREE.PlaneGeometry(300,300),new THREE.MeshLambertMaterial({color:'#26282c',transparent:true,alphaMap:new THREE.CanvasTexture(rg)}));
  stage3.receiveShadow=true;stage3.position.z=.02;world.add(stage3);
  fill=new THREE.DirectionalLight(0xffffff,.22);fill.position.set(-200,160,120);scene.add(fill);
  carRoot.traverse(m=>{if(m.isMesh){m.castShadow=m.receiveShadow=true;m.userData.base=m.material;}});
  for(const m of matCache.values()){const t=m.userData.tint;
    if(t==='--steel'){m.color.set('#d5d7d8');m.metalness=.25;m.roughness=.45;}
    else if(t==='--unsprung')m.color.set('#70757b');
    else if(t==='#17191b')m.color.set('#17181b');
  }
  HL=new THREE.MeshStandardMaterial({color:O,metalness:.2,roughness:.42});
  discs.forEach(d=>{d.material.color.set(O);d.material.opacity=.55;});
}
let hlSig=null;
function highlight(s){
  if(s.k===hlSig)return;hlSig=s.k;
  const on=new Set(s.hl||[]),brand=!s.hl;
  for(const m of matCache.values())if(m.userData.tint==='--link')m.color.set(brand?O:'#8f949b');
  for(const [name,list] of Object.entries(G))for(const o of list)o.traverse(m=>{if(m.isMesh&&m.userData.base)m.material=on.has(name)?HL:m.userData.base;});
}

// ---------------- the setup, per shot ----------------
let lastSig='';
function apply(f,r,inp){
  const sig=JSON.stringify([f,r]);
  if(sig!==lastSig){lastSig=sig;fadj=f;radj=r;buildAll();}
  for(const id of ['g','gx'])$(id).value=inp[id];
  $('bank').value=0;$('wing').value=0;$('fwing').value=0;
  model=calc();world.rotation.x=0;world.updateMatrixWorld(true);
}
const fresh=()=>[JSON.parse(JSON.stringify(FADJ0)),JSON.parse(JSON.stringify(RADJ0))];
// the side-by-side setups, solved once: [low, high] for each comparison
const CMP={};
function solveCompare(){
  const one=(fset,rset)=>{const [f,r]=fresh();fset(f);rset(r);apply(f,r,EXIT);return {hf:model.hf,hr:model.hr,lr:model.loads[2]};};
  CMP.tb=TB.map(v=>one(f=>{f.tbA=f.tbC=v;},()=>{}));
  CMP.lad=CLEV.map(v=>one(()=>{},r=>{r.clevis=v;}));
  lastSig='';
}
function setup(t,s){
  const u=t-s.t0,[f,r]=fresh(),inp=s.exit?EXIT:{g:0,gx:0};
  if(s.k==='tbar3d')f.tbA=f.tbC=q(AB(u,TB[0],TB[1]),.125);
  if(s.k==='tbarlr')f.tbA=f.tbC=u<2.5?TB[0]:TB[1];
  if(s.k==='lad3d')r.clevis=u<1.4?0:u<2.9?CLEV[0]:CLEV[1];
  if(s.k==='ladlr')r.clevis=u<2.5?CLEV[0]:CLEV[1];
  apply(f,r,inp);
  return {u};
}

// ---------------- motion ----------------
const wave=(t,per,ph=0)=>Math.sin(2*Math.PI*(t/per+ph));
function attitude(t,s){
  const o={h:0,roll:0,pitch:0,steer:0,drop:0,model:!!s.exit},u=t-s.t0;
  if(s.k==='open'){
    if(u<.5){o.drop=125*(1-(u/.5)*(u/.5));o.h=2.2;}
    else{const v=u-.5;o.h=2.2*Math.exp(-2.6*v)*Math.cos(11*v);o.pitch=.9*Math.exp(-2.2*v)*Math.sin(11*v);}
    o.steer=-14*sm((u-2.2)/.5)*sm((4.6-u)/.5);
  }else if(s.k==='axis'){
    o.roll=2.6*wave(u,2.5)*sm(u/.5);         // the body rolls about the axis between the two centers
  }
  return o;
}
function poseCar(a){
  const r=model.rest;let roll,zF,zR;
  if(a.model){roll=r.phi+model.phi;zF=r.dzF+model.zJF;zR=r.dzR+model.zJR;}
  else{const d=dynAttitude(a.h,a.roll,a.pitch);roll=r.phi+d.roll;zF=r.dzF+d.zF;zR=r.dzR+d.zR;}
  const P=poseF(-zF,-roll,a.steer,guessF);guessF=P;
  const Rp=poseR(-zR,-roll,guessR);guessR=Rp;
  bodyMatrix(B,roll,zF,zR);B.premultiply(BSET);place(P,Rp,B);
  carRoot.matrix.makeTranslation(0,0,a.drop);carRoot.matrixWorldNeedsUpdate=true;
  return {P,Rp,roll,zF,zR};
}

// ---------------- camera ----------------
let SH=0;
function camAt(t,s){
  const K=s.cam,u=t-s.t0;if(!K)return;
  const k=sm(u/SHOT),o=K[0].map((v,i)=>v+(K[1][i]-v)*k),[,az,el,d,tx,ty,tz]=o,A=az*Math.PI/180,E=el*Math.PI/180;
  cam.up.set(0,0,1);cam.position.set(tx+d*Math.cos(E)*Math.cos(A),ty+d*Math.cos(E)*Math.sin(A),tz+d*Math.sin(E));
  cam.lookAt(tx,ty,tz);cam.updateMatrixWorld(true);SH=s.sh||0;
}
const _v=new THREE.Vector3();
function scr(p,bm){_v.set(p[0],p[1],p[2]);if(bm)_v.applyMatrix4(bm);_v.applyMatrix4(world.matrixWorld);_v.project(cam);return [(_v.x+1)/2*W,(1-_v.y)/2*H-SH];}

// ---------------- type ----------------
function txt(c,s,x,y,font,color,align='left',sp=0){c.font=font;c.fontStretch='condensed';c.fillStyle=color;c.textAlign=align;c.letterSpacing=sp+'px';c.fillText(s,x,y);c.letterSpacing='0px';c.fontStretch='normal';}
function wOf(c,s,font,sp=0){c.font=font;c.fontStretch='condensed';c.letterSpacing=sp+'px';const w=c.measureText(s).width;c.letterSpacing='0px';c.fontStretch='normal';return w;}
const fitPx=(c,s,w,max,wt=700)=>Math.min(max,100*w/wOf(c,s,FONT(100,wt)));
function lean(c,s,x,y,px,color,align='left',w=700){c.save();c.translate(x,y);c.transform(1,0,-LEAN,1,0,0);txt(c,s,0,0,FONT(px,w),color,align);c.restore();}
function header(s,t){
  const u=out3((t-s.t0)/.3),px=fitPx(g,s.head,RIGHT-LEFT-40,150),y=330;
  g.save();g.beginPath();g.rect(0,y-px*1.05,(LEFT+40+(RIGHT-LEFT))*u+20,px*1.3);g.clip();
  lean(g,s.head,LEFT+12,y,px,BONE);g.restore();
  g.fillStyle=O;g.fillRect(LEFT,y+34,140*out3((t-s.t0-.1)/.3),10);
}
function tag(label,val,y=1500,a=1){
  if(a<=0)return;const h=92,font=FONT(h*.6,600),pad=h*.42;
  const w1=wOf(g,label,font,3)+2*pad,w2=wOf(g,val,FONT(h*.66,700),1)+2*pad;
  g.save();g.globalAlpha=a;g.fillStyle=INK;g.fillRect(LEFT,y,w1+w2,h);
  g.lineWidth=3;g.strokeStyle=LG;g.strokeRect(LEFT,y,w1,h);g.strokeRect(LEFT+w1,y,w2,h);
  txt(g,label,LEFT+w1/2,y+h*.7,font,BONE,'center',3);txt(g,val,LEFT+w1+w2/2,y+h*.72,FONT(h*.66,700),O,'center',1);
  g.restore();
}
const sgn=(x,n)=>(x>=0?'+':'−')+Math.abs(x).toFixed(n);
const tagIn=(s,t)=>sm((t-s.t0-.35)/.25);

// ---------------- drawn guides ----------------
function lineW(a,b,col,lw,dash){g.save();if(dash)g.setLineDash(dash);g.strokeStyle=col;g.lineWidth=lw;g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();g.restore();}
function ring(p,col=O){g.fillStyle=BONE;g.strokeStyle=INK;g.lineWidth=6;g.beginPath();g.arc(p[0],p[1],22,0,7);g.fill();g.stroke();g.fillStyle=col;g.beginPath();g.arc(p[0],p[1],8,0,7);g.fill();}
const frontRCpt=P=>{const rc=SC.frontRC(P);return rc?[P.tb.a[0],0,rc.z]:null;};
const rearRCpt=Rp=>{const ic=SC.ladderIC(Rp);return ic?[Rp.lad.aUp[0],ic.y,ic.z]:null;};

// a two-column comparison: the setup on the left against the one on the right, LR load the big number
function compare(t,s,cols,rowLab,rowVals,active){
  const y0=1180,cw=(RIGHT-LEFT-24)/2;
  cols.forEach((name,i)=>{
    const x=LEFT+i*(cw+24),on=i===active,a=tagIn(s,t);if(a<=0)return;
    g.save();g.globalAlpha=a*(on?1:.55);
    g.fillStyle='#16181b';g.fillRect(x,y0,cw,420);g.lineWidth=on?6:3;g.strokeStyle=on?O:TG;g.strokeRect(x,y0,cw,420);
    txt(g,name,x+28,y0+70,FONT(54,700),on?O:BONE,'left',2);
    txt(g,rowLab,x+28,y0+150,FONT(34,600),LG,'left',2);txt(g,rowVals[i][0],x+cw-28,y0+150,FONT(44,700),BONE,'right');
    txt(g,'LR LOAD',x+28,y0+240,FONT(34,600),LG,'left',2);
    txt(g,rowVals[i][1],x+cw-28,y0+370,FONT(150,700),on?BONE:LG,'right');
    txt(g,'LB',x+28,y0+370,FONT(40,600),LG);
    g.restore();
  });
}
function arrowUp(x,y,up,col){g.fillStyle=col;g.beginPath();if(up){g.moveTo(x,y-26);g.lineTo(x+22,y+10);g.lineTo(x-22,y+10);}else{g.moveTo(x,y+26);g.lineTo(x+22,y-10);g.lineTo(x-22,y-10);}g.closePath();g.fill();}

// ---------------- per-shot overlays ----------------
function fg(s,t,pz){
  const P=pz.P,Rp=pz.Rp,u=t-s.t0,a=tagIn(s,t);
  switch(s.k){
    case 'axis':{
      const F=frontRCpt(P),R=rearRCpt(Rp);
      if(F&&R&&a>0){const f=scr(F,B),r=scr(R,B),dx=f[0]-r[0],dy=f[1]-r[1];g.globalAlpha=a;
        lineW([r[0]-dx*.35,r[1]-dy*.35],[f[0]+dx*.35,f[1]+dy*.35],BONE,4,[22,14]);ring(f);ring(r);g.globalAlpha=1;}
      tag('FRONT RC',model.hf.toFixed(1)+' IN',1500,a);tag('REAR RC',model.hr.toFixed(1)+' IN',1610,a);break;}
    case 'tbar3d':{
      const F=frontRCpt(P);
      if(F&&a>0){const c=scr(F,B);g.globalAlpha=a;lineW(scr(P.tb.c,B),c,BONE,4,[16,12]);ring(c);g.globalAlpha=1;}
      tag('TRACK BAR',sgn(fadj.tbA,2)+' IN',1500,a);tag('FRONT RC',model.hf.toFixed(1)+' IN',1610,a);break;}
    case 'lad3d':{
      const R=rearRCpt(Rp);
      if(R&&a>0){const c=scr(R,B);g.globalAlpha=a;for(const e of [Rp.lad.aUp,Rp.lad.aLo])lineW(scr(e,B),c,BONE,4,[16,12]);ring(c);g.globalAlpha=1;}
      tag('CLEVIS',radj.clevis>0?'HIGH':radj.clevis<0?'LOW':'MID',1500,a);tag('REAR RC',model.hr.toFixed(1)+' IN',1610,a);break;}
    case 'tbarlr':compare(t,s,['LOW BAR','HIGH BAR'],'FRONT RC',CMP.tb.map(c=>[c.hf.toFixed(1)+' IN',Math.round(c.lr)]),u<2.5?0:1);break;
    case 'ladlr':compare(t,s,['LOW CLEVIS','HIGH CLEVIS'],'REAR RC',CMP.lad.map(c=>[c.hr.toFixed(1)+' IN',Math.round(c.lr)]),u<2.5?0:1);break;
    case 'sum':{
      const rows=[['FRONT RC',true,CMP.tb[1].lr-CMP.tb[0].lr],['REAR RC',false,CMP.lad[1].lr-CMP.lad[0].lr]];
      rows.forEach(([lab,front,d],i)=>{const y=1220+i*200,k=sm((u-.4-i*.5)/.3);if(k<=0)return;
        g.save();g.globalAlpha=k;g.fillStyle='#16181b';g.fillRect(LEFT,y,RIGHT-LEFT,160);g.lineWidth=3;g.strokeStyle=TG;g.strokeRect(LEFT,y,RIGHT-LEFT,160);
        txt(g,lab,LEFT+30,y+102,FONT(64,700),BONE,'left',2);arrowUp(LEFT+370,y+80,true,BONE);
        txt(g,'LR',LEFT+450,y+102,FONT(64,700),BONE,'left',2);arrowUp(LEFT+560,y+80,d>0,O);
        txt(g,sgn(d,0)+' LB',RIGHT-30,y+104,FONT(72,700),O,'right');g.restore();});
      break;}
  }
}

// ---------------- title and end ----------------
function openFG(s,t){
  const px=fitPx(g,'ROLL CENTERS',RIGHT-LEFT,210),w=k=>out3((t-.6-k*.18)/.35);
  g.save();g.beginPath();g.rect(0,430-px*1.05,(RIGHT+80)*w(0),px*1.3);g.clip();lean(g,'ROLL CENTERS',LEFT+12,430,px,BONE);g.restore();
  const a=sm((t-1.2)/.3);
  if(a>0){g.globalAlpha=a;txt(g,'SPRINT CAR SETUP LAB',LEFT,540,FONT(60,700),O,'left',4);g.globalAlpha=1;}
}
function endFG(s,t){
  const u=t-s.t0,lw=760,lh=lw*logo.height/logo.width,lx=(W-lw)/2,ly=560,a=out3(u/.5);
  g.save();g.beginPath();g.rect(lx-20,ly-20,(lw+40)*a,lh+40);g.clip();g.drawImage(logo,lx,ly,lw,lh);g.restore();
  const k=n=>sm((u-.5-n*.2)/.3);
  g.globalAlpha=k(0);txt(g,'SPRINT CAR SETUP LAB',W/2,ly+lh+150,FONT(84,700),BONE,'center',4);
  if(k(1)>0){const h=110,f=FONT(h*.66,700),lab='OUT NOW',ww=wOf(g,lab,f,8)+h*1.2;
    g.globalAlpha=k(1);g.fillStyle=O;g.fillRect((W-ww)/2,ly+lh+220,ww,h);txt(g,lab,W/2,ly+lh+220+h*.73,f,INK,'center',8);}
  g.globalAlpha=1;
}

// ---------------- filmed shots ----------------
const META={},TOP=[400,1290],CARD=[1330,1640];
function loadImg(src){return new Promise((r,j)=>{const im=new Image();im.onload=()=>r(im);im.onerror=j;im.src=src;});}
function cursor(x,y,press){
  if(press>0){g.save();g.globalAlpha=.55*press;g.fillStyle=O;g.beginPath();g.arc(x,y,30,0,7);g.fill();g.restore();}
  g.save();g.translate(x,y);g.scale(1.5,1.5);g.beginPath();
  g.moveTo(0,0);g.lineTo(0,24);g.lineTo(6,18.5);g.lineTo(10.5,28);g.lineTo(14.5,26.2);g.lineTo(10.2,17);g.lineTo(18,17);g.closePath();
  g.fillStyle='#fff';g.fill();g.lineWidth=1.6;g.strokeStyle='#000';g.stroke();g.restore();
}
async function drawCap(s,t){
  const M=META[s.k],n=Math.max(0,Math.min(M.frames.length-1,Math.round((t-s.t0)*FPS))),id=String(n).padStart(4,'0');
  const [st,pn]=await Promise.all([loadImg(`cap/${s.k}/s_${id}.jpg`),loadImg(`cap/${s.k}/p_${id}.jpg`)]);
  g.globalAlpha=1;g.drawImage(bg,0,0);
  const bw=W,bh=TOP[1]-TOP[0];let sw=st.width,sh=Math.min(st.height,sw*bh/bw);if(sh<sw*bh/bw)sw=sh*bw/bh;
  g.drawImage(st,(st.width-sw)/2,0,sw,sh,0,TOP[0],bw,bh);
  g.fillStyle='#2b3036';g.fillRect(0,TOP[0]-2,W,2);g.fillRect(0,TOP[1],W,2);
  const U=M.lay.union,rows=M.lay.rows,cw=RIGHT-LEFT+60,gap=6;
  let k=cw/U.w,tot=rows.reduce((a,r)=>a+r.h,0)+gap*(rows.length-1);if(tot*k>CARD[1]-CARD[0])k=(CARD[1]-CARD[0])/tot;
  const x0=LEFT-30+(cw-U.w*k)/2;let y=CARD[0];const place=[];
  g.fillStyle='#1d2329';g.fillRect(x0-18,y-18,U.w*k+36,tot*k+36);
  for(const r of rows){g.drawImage(pn,(r.x-U.x)*2,(r.y-U.y)*2,r.w*2,r.h*2,x0+(r.x-U.x)*k,y,r.w*k,r.h*k);place.push([r,y]);y+=(r.h+gap)*k;}
  g.strokeStyle=O;g.lineWidth=4;g.strokeRect(x0-18,CARD[0]-18,U.w*k+36,tot*k+36);
  const f=M.frames[n],c=f.cur,row=place.find(([r])=>c.y>=r.y-1&&c.y+c.h<=r.y+r.h+1);
  if(row){
    const [r,ry]=row,cx=f.frac!=null?c.x+8+f.frac*(c.w-16):c.x+c.w-26,cy=c.y+c.h/2;
    const prev=M.frames[Math.max(0,n-2)],moving=f.frac!=null?Math.abs(f.frac-prev.frac)>1e-4:JSON.stringify(f)!==JSON.stringify(prev);
    s._press=(s._press||0)+((moving?1:0)-(s._press||0))*.35;
    cursor(x0+(cx-U.x)*k,ry+(cy-r.y)*k,s._press);
  }
  header(s,t);
}

// ---------------- one frame ----------------
let bgSig='';
function paintBg(){
  b.fillStyle=INK;b.fillRect(0,0,W,H);b.strokeStyle='#17191c';b.lineWidth=2;
  for(let x=60;x<W;x+=120){b.beginPath();b.moveTo(x,0);b.lineTo(x,H);b.stroke();}
  for(let y=0;y<H;y+=120){b.beginPath();b.moveTo(0,y);b.lineTo(W,y);b.stroke();}
  bgTex.needsUpdate=true;
}
async function draw(t){
  const s=shotAt(t);
  if(!bgSig){bgSig='x';paintBg();}
  if(s.cap){await drawCap(s,t);fade(t);return;}
  if(s.k==='end'){g.globalAlpha=1;g.drawImage(bg,0,0);endFG(s,t);fade(t);return;}
  highlight(s);setup(t,s);
  discs.forEach((d,i)=>{d.visible=!!s.loads;const r=Math.sqrt(Math.max(model.loads[i],0))*.6;d.scale.set(r,r,1);});
  let pz;
  for(let i=0;i<SUB;i++){
    const tt=Math.max(s.t0,t+(i/SUB-.5)*SHUTTER/FPS);
    camAt(tt,s);pz=poseCar(attitude(tt,s));
    const ang=i*2.4,r=9*Math.sqrt((i+.5)/SUB);
    sun.position.set(110+r*Math.cos(ang)*2,-90+r*Math.sin(ang)*2,280);
    cam.setViewOffset(W,H,(i*.618%1)-.5,(i*.382%1)-.5+SH,W,H);
    renderer.render(scene,cam);
    g.globalAlpha=1/(i+1);g.drawImage(renderer.domElement,0,0);
  }
  g.globalAlpha=1;cam.clearViewOffset();
  camAt(t,s);pz=poseCar(attitude(t,s));
  if(s.k==='open')openFG(s,t);
  else{
    const gr=g.createLinearGradient(0,0,0,520);gr.addColorStop(0,INK);gr.addColorStop(.74,INK);gr.addColorStop(1,'rgba(15,16,18,0)');
    g.fillStyle=gr;g.fillRect(0,0,W,520);header(s,t);fg(s,t,pz);
  }
  fade(t);
}
function fade(t){if(t>DUR-.4){g.fillStyle=INK;g.globalAlpha=sm((t-(DUR-.4))/.4);g.fillRect(0,0,W,H);g.globalAlpha=1;}}

const yieldNow=()=>new Promise(r=>{const c=new MessageChannel();c.port1.onmessage=()=>r();c.port2.postMessage(0);});
const put=async(name,blob)=>{await fetch('out/'+name,{method:'PUT',body:blob});return blob.size;};
window.VID={cv,SHOTS,DUR,CMP,progress:0,
  async init(){
    const L=m=>document.body.dataset.log=(document.body.dataset.log||'')+m+' | ';
    await new Promise(r=>{const w=setInterval(()=>{if(loaded&&model){clearInterval(w);r();}},100);});L('loaded');
    await document.fonts.load(FONT(100));
    logo=new Image();await new Promise((r,j)=>{logo.onload=r;logo.onerror=j;logo.src='logo.png';});   // before look(): it stops the frame loop
    look();solveCompare();L('compare '+JSON.stringify(CMP));
    for(const s of SHOTS)if(s.cap){try{META[s.k]=await (await fetch(`cap/${s.k}/meta.json`,{cache:'no-store'})).json();}catch(e){L('no capture yet: '+s.k);}}
    return 'ready '+DUR+' s';},
  async still(t,name){await draw(t);return put(name,await new Promise(r=>cv.toBlob(r,'image/jpeg',.88)));},
  async render(){
    const m=new Mp4Muxer.Muxer({target:new Mp4Muxer.ArrayBufferTarget(),video:{codec:'avc',width:W,height:H},fastStart:'in-memory'});
    const e=new VideoEncoder({output:(c,meta)=>m.addVideoChunk(c,meta),error:x=>{VID.error=String(x);}});
    e.configure({codec:'avc1.640033',width:W,height:H,bitrate:22e6,framerate:FPS,latencyMode:'quality'});
    const N=Math.round(DUR*FPS);VID.done=false;
    for(let i=0;i<N;i++){
      await draw(i/FPS);const f=new VideoFrame(cv,{timestamp:Math.round(i*1e6/FPS),duration:Math.round(1e6/FPS)});
      e.encode(f,{keyFrame:i%60===0});f.close();VID.progress=(i+1)/N;
      while(e.encodeQueueSize>4)await yieldNow();
      if(i%10===0)await yieldNow();
    }
    await e.flush();m.finalize();
    await put('rollcenters.mp4',new Blob([m.target.buffer],{type:'video/mp4'}));VID.done=true;return N;
  },
};
})();
