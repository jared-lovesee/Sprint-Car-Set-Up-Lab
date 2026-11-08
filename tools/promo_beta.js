// Instagram promo: "Beta in less than a week", plus four story images.
// One unbroken camera orbit round the car, hard colour cuts on the half-second grid, every number
// from the live model. Same recipe as the Late Model videos (Video Series - Ideas and Status.md):
// runs inside a copy of the lab page and uses its globals (model, calc, buildAll, poseF, poseR, ...).
// VID.init(), VID.render(), VID.story(i,name); promo_sfx.py makes the sound from VID.CUES.
(function(){
const W=1080,H=1920,FPS=30,DUR=30,SUB=16,SHUTTER=0.5;
const O='#F2500F',BONE='#ECE6D8',INK='#0F1012';
const PAL={
  o:{bg:O,ink:INK,alt:BONE,frame:'#15171a',link:'#fff6e8',uns:'#23262b',tyre:'#060607',shadow:.40},
  b:{bg:BONE,ink:INK,alt:O,frame:'#15171a',link:O,uns:'#23262b',tyre:'#060607',shadow:.30},
  k:{bg:INK,ink:BONE,alt:O,frame:'#d5d7d8',link:O,uns:'#70757b',tyre:'#17181b',shadow:0},
};
const FONT=(px,w=700)=>`${w} ${px}px Bahnschrift, "Barlow Condensed", sans-serif`;
const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');
const bg=document.createElement('canvas');bg.width=W;bg.height=H;const b=bg.getContext('2d');
const SCENES=[{k:'open',t0:0,t1:4,p:'o'},{k:'links',t0:4,t1:10,p:'b'},{k:'rounds',t0:10,t1:15,p:'k'},
  {k:'ladder',t0:15,t1:19,p:'o'},{k:'stag',t0:19,t1:22,p:'b'},{k:'dyn',t0:22,t1:26,p:'k'},{k:'end',t0:26,t1:30,p:'o'}];
const sceneAt=t=>SCENES.find(s=>t<s.t1)||SCENES[SCENES.length-1];
const sm=u=>{u=Math.max(0,Math.min(1,u));return u*u*(3-2*u);};
const snap=u=>1-Math.pow(1-Math.max(0,Math.min(1,u)),3);
// value that holds, then moves over `d` seconds at each listed time: [[t,value],...]
function steps(t,list,d=.2){let v=list[0][1];for(let i=1;i<list.length;i++){const [t1,x]=list[i];v+=(x-list[i-1][1])*snap((t-t1)/d);}return v;}

// ---------------- look ----------------
let bgTex,floor,stage3,fill,hemi;
function look(){
  window.requestAnimationFrame=()=>0;              // stop the lab's own loop; every frame is drawn from here
  document.body.style.visibility='hidden';
  for(const id of ['stg','g','gx','rnrr'])$(id).step='any';
  $('g').value=0;$('gx').value=0;
  grid.visible=false;
  scene.children.forEach(o=>{if(o.isLine||o.isArrowHelper||(o.isMesh&&o!==floor))o.visible=false;});
  discs.forEach(d=>d.visible=false);
  renderer.setPixelRatio(1);renderer.setSize(W,H,false);cam.aspect=W/H;cam.fov=24;cam.updateProjectionMatrix();
  renderer.toneMapping=THREE.NoToneMapping;renderer.outputEncoding=THREE.sRGBEncoding;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  bgTex=new THREE.CanvasTexture(bg);bgTex.encoding=THREE.sRGBEncoding;scene.background=bgTex;
  floor=new THREE.Mesh(new THREE.PlaneGeometry(4000,4000),new THREE.ShadowMaterial({opacity:.35}));floor.receiveShadow=true;scene.add(floor);
  sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);sun.shadow.bias=-0.0006;sun.shadow.normalBias=.05;
  const c=sun.shadow.camera;c.left=-120;c.right=120;c.top=120;c.bottom=-120;c.near=10;c.far=800;c.updateProjectionMatrix();
  sun.intensity=.62;scene.add(sun.target);sun.target.position.set(0,0,10);
  hemi=scene.children.find(o=>o.isHemisphereLight);hemi.intensity=.60;
  const rg=document.createElement('canvas');rg.width=rg.height=256;const rc=rg.getContext('2d'),gr=rc.createRadialGradient(128,128,20,128,128,128);
  gr.addColorStop(0,'#fff');gr.addColorStop(.55,'#888');gr.addColorStop(1,'#000');rc.fillStyle=gr;rc.fillRect(0,0,256,256);
  stage3=new THREE.Mesh(new THREE.PlaneGeometry(290,290),new THREE.MeshLambertMaterial({color:'#26282c',transparent:true,alphaMap:new THREE.CanvasTexture(rg)}));
  stage3.receiveShadow=true;stage3.position.z=.02;scene.add(stage3);
  fill=new THREE.DirectionalLight(0xffffff,.22);fill.position.set(-200,160,120);scene.add(fill);
  carRoot.traverse(m=>{if(m.isMesh)m.castShadow=m.receiveShadow=true;});
}
function paint(p){
  for(const m of matCache.values()){const t=m.userData.tint;
    if(t==='--steel'){m.color.set(p.frame);m.metalness=.25;m.roughness=.45;}
    else if(t==='--link')m.color.set(p.link);
    else if(t==='--unsprung')m.color.set(p.uns);
    else if(t==='#17191b')m.color.set(p.tyre);
  }
  floor.material.opacity=p.shadow;floor.visible=p.shadow>0;stage3.visible=!floor.visible;
}

// ---------------- car state ----------------
let lastSig='';
function setup(t,s){
  const k=s.k;
  const rounds=k==='rounds'?steps(t,[[0,0],...[...Array(8)].map((_,i)=>[11+i*.25,i+1])],.16):0;
  const clev=k==='ladder'?steps(t,[[0,-.625],[16,.625]]):0;
  const strap=k==='ladder'?steps(t,[[0,7],[17,8]]):7;
  const stg=k==='stag'?steps(t,[[0,5],[19.5,12]],1.4):6.75;
  const sig=[clev,strap,stg].join();
  if(sig!==lastSig){lastSig=sig;radj.clevis=clev;radj.strap=strap;$('stg').value=stg;buildAll();}
  $('rnrr').value=rounds;model=calc();
  return {rounds,clev,strap,stg};
}
const wave=(t,per,ph=0)=>Math.sin(2*Math.PI*(t/per+ph));
function attitude(t,s){
  const o={h:0,roll:0,pitch:0,steer:0,drop:0},e=sm((t-s.t0)/.4)*sm((s.t1-t)/.4);
  if(s.k==='open'){
    if(t<.5){o.drop=125*(1-(t/.5)*(t/.5));o.h=2.2;}
    else{const u=t-.5;o.h=2.2*Math.exp(-2.6*u)*Math.cos(11*u);o.pitch=.9*Math.exp(-2.2*u)*Math.sin(11*u);}
    o.steer=steps(t,[[0,0],[2,16],[3,-16]],.3)*sm((4-t)/.3);
  }else if(s.k==='links'){
    o.h=1.5*e*wave(t,2);o.roll=3.2*e*wave(t,4);o.pitch=1.1*e*wave(t,4,.25);o.steer=15*e*wave(t,4);
  }else if(s.k==='dyn'){
    const u=t-22;
    o.h=2.6*sm(u/.2)*sm((1.5-u)/.2)*wave(u,1.3);
    o.roll=3.6*sm((u-1.3)/.2)*sm((2.8-u)/.2)*wave(u-1.3,1.3);
    o.pitch=2.3*sm((u-2.6)/.2)*sm((4-u)/.2)*wave(u-2.6,1.3);
  }else if(s.k==='end'){
    const u=t-26;o.h=1.5*Math.exp(-2.4*u)*Math.cos(11*u);o.steer=steps(t,[[0,0],[27,-20]],.35);
  }
  return o;
}
function poseCar(a){
  const q=dynAttitude(a.h,a.roll,a.pitch),r=model.rest,roll=r.phi+q.roll,zF=r.dzF+q.zF,zR=r.dzR+q.zR;
  const P=poseF(-zF,-roll,a.steer,guessF);guessF=P;
  const Rp=poseR(-zR,-roll,guessR);guessR=Rp;
  bodyMatrix(B,roll,zF,zR);B.premultiply(BSET);place(P,Rp,B);
  carRoot.matrix.makeTranslation(0,0,a.drop);carRoot.matrixWorldNeedsUpdate=true;
  return {P,Rp};
}

// ---------------- camera: one orbit, [t, azimuth, elevation, distance, target x, y, z] ----------------
const CAM=[[0,-28,5,500,0,0,30],[4,-36,8,480,6,0,28],[6.2,-62,10,500,4,0,28],[8,-162,12,470,-14,0,28],[10,-170,12,470,-14,0,26],
  [10.6,-174,15,580,-8,0,-3],[14.9,-182,16,580,-8,0,-3],[15.5,-188,7,380,-42,0,34],[17,-196,6,365,-46,0,37],[19,-212,8,430,-30,0,34],
  [22,-238,9,450,-14,0,34],[22.6,-262,10,610,0,0,0],[25.8,-312,10,610,0,0,0],[26.4,-338,6,520,0,0,24],[30,-386,5,500,0,0,30]];
function camAt(t){
  let i=CAM.findIndex(k=>k[0]>t);if(i<1)i=i<0?CAM.length-1:1;
  const K=j=>CAM[Math.max(0,Math.min(CAM.length-1,j))],p0=K(i-2),p1=K(i-1),p2=K(i),p3=K(i+1),u=(t-p1[0])/(p2[0]-p1[0]),o=[];
  const d1=p2[0]-p1[0];
  for(let n=1;n<7;n++){
    const m1=(p2[n]-p0[n])/((p2[0]-p0[0])||1)*d1,m2=(p3[n]-p1[n])/((p3[0]-p1[0])||1)*d1,u2=u*u,u3=u2*u;
    o.push((2*u3-3*u2+1)*p1[n]+(u3-2*u2+u)*m1+(-2*u3+3*u2)*p2[n]+(u3-u2)*m2);
  }
  const [az,el,d,tx,ty,tz]=o,A=az*Math.PI/180,E=el*Math.PI/180;
  cam.up.set(0,0,1);cam.position.set(tx+d*Math.cos(E)*Math.cos(A),ty+d*Math.cos(E)*Math.sin(A),tz+d*Math.sin(E));
  cam.lookAt(tx,ty,tz);cam.updateMatrixWorld(true);
}
const _v=new THREE.Vector3();
function scr(p,bm){_v.set(p[0],p[1],p[2]);if(bm)_v.applyMatrix4(bm);_v.project(cam);return [(_v.x+1)/2*W,(1-_v.y)/2*H];}

// ---------------- type ----------------
function txt(c,s,x,y,font,color,align='left',sp=0){c.font=font;c.fontStretch='condensed';c.fillStyle=color;c.textAlign=align;c.letterSpacing=sp+'px';c.fillText(s,x,y);c.letterSpacing='0px';c.fontStretch='normal';}
function fit(c,s,x,y,w,color,weight=700){c.font=FONT(100,weight);c.fontStretch='condensed';const m=c.measureText(s).width,px=100*w/m;txt(c,s,x,y,FONT(px,weight),color);return px;}
const LEFT=64,RIGHT=W-124;                                 // Reels keeps the right edge for its buttons
function head(c,p,line1,sub){
  fit(c,line1,LEFT,380,RIGHT-LEFT,p.ink);
  if(sub)txt(c,sub,LEFT,448,FONT(52,400),p.ink);
}
function paintBg(s,t){
  const p=PAL[s.p];b.fillStyle=p.bg;b.fillRect(0,0,W,H);
  if(s.k==='open'){
    fit(b,'SPRINT CAR',LEFT,470,W-2*LEFT,INK);fit(b,'SETUP LAB',LEFT,720,W-2*LEFT,BONE);
    if(t>=1.5)fit(b,'BETA IN LESS THAN A WEEK',LEFT,1520,RIGHT-LEFT,INK);
  }else if(s.k==='links')head(b,p,'EVERY LINK SOLVED','The whole car, built from full CAD.');
  else if(s.k==='rounds')head(b,p,'COUNT THE ROUNDS','Ride heights and corner weights, live.');
  else if(s.k==='ladder')head(b,p,'MOVE THE LADDER','The rear roll center goes with it.');
  else if(s.k==='stag')head(b,p,'SIZE THE STAGGER','Change a tire. The rear end answers.');
  else if(s.k==='dyn')head(b,p,'HEAVE ROLL PITCH','Watch the whole car respond.');
  else{
    fit(b,'BETA',LEFT,640,W-2*LEFT,INK);
    if(t>=27){fit(b,'IN LESS THAN A WEEK',LEFT,1490,W-2*LEFT,BONE);}
    if(t>=27.5)txt(b,'SPRINT CAR SETUP LAB',LEFT,1566,FONT(58,600),INK,'left',1);
  }
  bgTex.needsUpdate=true;
}

// ---------------- overlays ----------------
// a part callout: dot on the real hardpoint, a line out to a label pinned in the margin
function callout(p,pt,label,lx,ly,a){
  if(a<=0)return;
  const [x,y]=pt,right=lx>W/2,ex=lx+(right?-110:110),dr=snap(a*2.2);
  g.strokeStyle=p.ink;g.lineWidth=3;g.beginPath();g.moveTo(x,y);g.lineTo(x+(ex-x)*dr,y+(ly-56-y)*dr);g.stroke();
  g.fillStyle=O;g.beginPath();g.arc(x,y,9,0,7);g.fill();g.lineWidth=3;g.strokeStyle=p.ink;g.stroke();
  if(a>.3)txt(g,label,lx,ly,FONT(52),p.ink,right?'right':'left',1);
}
function linksFG(p,t,q){
  const f=HP.front,P=q.P,Rp=q.Rp;
  const list=[[4.5,5.75,V.mid(P.T(f.kingpin.L.p),P.T(f.kingpin.R.p)),'BEAM AXLE',LEFT,1470],
    [5,7,V.mid(P.links[0].a,P.links[0].c),'RADIUS RODS',RIGHT,1470],
    [5.75,7,P.shock.R.chassis,'SHOCKS',LEFT,1470],
    [7.25,8.25,Rp.cage[0].barArm,'TORSION ARMS',LEFT,1470],
    [8.25,10,Rp.cage[0].rodA,'BIRDCAGES',LEFT,1470],
    [8.5,10,Rp.lad.pin,'JACOBS LADDER',RIGHT,1470]];
  for(const [t0,t1,pt,lab,lx,ly] of list)callout(p,scr(pt,B),lab,lx,ly,Math.min((t-t0)/.33,1)*(t<t1?1:0));
}
function statBlock(p,x,y,label,val,unit){
  txt(g,label,x,y,FONT(44,600),p.ink,'left',1);
  txt(g,val,x,y+128,FONT(136),p.ink);
  g.font=FONT(136);g.fontStretch='condensed';const w=g.measureText(val).width;g.fontStretch='normal';
  if(unit)txt(g,unit,x+w+14,y+128,FONT(48,500),p.ink);
}
function roundsFG(p,t,st){
  const y0=1090,cw=(W-2*LEFT)/2,ch=210,n=['LF','RF','LR','RR'],h=model.rest.hNow,L=model.corner;
  txt(g,'RR',LEFT,y0-30,FONT(60),O);txt(g,Math.round(st.rounds)+' ROUNDS IN',LEFT+74,y0-30,FONT(60),p.ink);
  n.forEach((c,i)=>{const x=LEFT+(i%2)*cw,y=y0+(i>>1)*ch,hot=c==='RR'&&st.rounds>.01;
    if(hot){g.fillStyle=O;g.fillRect(x,y,cw,ch);}
    const ink=hot?INK:p.ink;
    txt(g,c,x+22,y+56,FONT(46,600),ink);
    txt(g,h[i].toFixed(2),x+22,y+172,FONT(118),ink);
    txt(g,Math.round(L[i])+' lb',x+cw-22,y+172,FONT(52,500),ink,'right');
  });
  g.strokeStyle=p.ink;g.lineWidth=3;g.beginPath();g.moveTo(LEFT,y0);g.lineTo(LEFT+2*cw,y0);g.moveTo(LEFT,y0+ch);g.lineTo(LEFT+2*cw,y0+ch);g.moveTo(LEFT,y0+2*ch);g.lineTo(LEFT+2*cw,y0+2*ch);g.moveTo(LEFT+cw,y0);g.lineTo(LEFT+cw,y0+2*ch);g.stroke();
}
function ladderFG(p,t,q){
  const Rp=q.Rp,ic=SC.ladderIC(Rp);if(!ic)return;
  const x=Rp.lad.aUp[0],c=scr([x,ic.y,ic.z],B),a=scr(Rp.lad.aUp,B),l=scr(Rp.lad.aLo,B);
  g.setLineDash([16,12]);g.strokeStyle=INK;g.lineWidth=4;
  for(const e of [a,l]){g.beginPath();g.moveTo(e[0],e[1]);g.lineTo(c[0],c[1]);g.stroke();}
  g.setLineDash([]);
  g.fillStyle=BONE;g.strokeStyle=INK;g.lineWidth=6;g.beginPath();g.arc(c[0],c[1],24,0,7);g.fill();g.stroke();
  g.fillStyle=INK;g.beginPath();g.arc(c[0],c[1],7,0,7);g.fill();
  const y=1470,cpR=(SC.angles(Rp.wheel.L,1).CP[2]+SC.angles(Rp.wheel.R,-1).CP[2])/2;
  statBlock(p,LEFT,y,'ROLL CENTER HEIGHT',(ic.z-cpR).toFixed(1),'in');
  statBlock(p,LEFT+470,y,'FROM CENTERLINE',Math.abs(ic.y).toFixed(1),'in '+(ic.y>=0?'left':'right'));
}
function stagFG(p,t,st){
  const rr=HP.rear.wheel.R.r,lr=HP.rear.wheel.L.r,y=1470;
  statBlock(p,LEFT,y,'STAGGER',st.stg.toFixed(1),'in');
  statBlock(p,LEFT+470,y,'LR ROLLOUT',(2*Math.PI*lr).toFixed(1),'in');
}
// the sweep is computed up front: real kinematic outputs against time
const STRIP=[['CAMBER LF','camL'],['CAMBER RF','camR'],['TOE LF','toeL'],['REAR STEER','rst'],['RC HEIGHT REAR','hr'],['CLOCKING RR','clkR']];
let strip=null;
function buildStrip(){
  strip={t:[],o:[]};let gs=null;
  $('rnrr').value=0;radj.clevis=0;radj.strap=7;$('stg').value=6.75;buildAll();model=calc();lastSig='';
  const s=SCENES[5];
  for(let t=22;t<26.001;t+=1/FPS){const a=attitude(t,s);gs=dynPoint(a.h,a.roll,a.pitch,gs);strip.t.push(t);strip.o.push(gs);}
  strip.r={};for(const [,k] of STRIP){const v=strip.o.map(o=>o[k]).filter(isFinite),lo=Math.min(...v),hi=Math.max(...v),m=Math.max((hi-lo)*.12,.05);strip.r[k]=[lo-m,hi+m];}
}
function dynFG(p,t){
  const x0=LEFT,y0=1010,cw=(W-2*LEFT-30)/2,ch=172,gapY=18,n=Math.floor((t-22)*FPS);
  STRIP.forEach(([lab,k],i)=>{
    const x=x0+(i%2)*(cw+30),y=y0+(i>>1)*(ch+gapY),[lo,hi]=strip.r[k],last=strip.o[Math.max(0,Math.min(n,strip.o.length-1))][k];
    g.strokeStyle='#3a3d42';g.lineWidth=2;g.beginPath();g.moveTo(x,y+ch);g.lineTo(x+cw,y+ch);g.stroke();
    txt(g,lab,x,y+36,FONT(38,600),p.ink,'left',.5);
    txt(g,(last>=0?'+':'−')+Math.abs(last).toFixed(2),x+cw,y+36,FONT(44),O,'right');
    g.strokeStyle=O;g.lineWidth=5;g.lineJoin='round';g.beginPath();
    const X=j=>x+j/(strip.t.length-1)*cw,Y=q=>y+ch-8-(q-lo)/(hi-lo)*(ch-58);
    for(let j=0;j<=Math.min(n,strip.o.length-1);j++){const q=strip.o[j][k];if(!isFinite(q))continue;j?g.lineTo(X(j),Y(q)):g.moveTo(X(j),Y(q));}
    g.stroke();
  });
}

// ---------------- one frame ----------------
let bgSig='';
function draw(t){
  const s=sceneAt(t),p=PAL[s.p],st=setup(t,s);
  paint(p);
  const sig=s.k+(s.k==='open'?(t>=1.5):'')+(s.k==='end'?(t>=27)+''+(t>=27.5):'');
  if(sig!==bgSig){bgSig=sig;paintBg(s,t);}
  let q;
  for(let i=0;i<SUB;i++){
    const tt=Math.max(s.t0,t+(i/SUB-.5)*SHUTTER/FPS);
    camAt(tt);q=poseCar(attitude(tt,s));
    const ang=i*2.4,r=9*Math.sqrt((i+.5)/SUB);
    sun.position.set(110+r*Math.cos(ang)*2,-90+r*Math.sin(ang)*2,280);
    cam.setViewOffset(W,H,(i*.618%1)-.5,(i*.382%1)-.5,W,H);
    renderer.render(scene,cam);
    g.globalAlpha=1/(i+1);g.drawImage(renderer.domElement,0,0);
  }
  g.globalAlpha=1;cam.clearViewOffset();
  camAt(t);q=poseCar(attitude(t,s));
  if(s.k==='links')linksFG(p,t,q);
  else if(s.k==='rounds'){if(t>=10.5)roundsFG(p,t,st);}
  else if(s.k==='ladder')ladderFG(p,t,q);
  else if(s.k==='stag')stagFG(p,t,st);
  else if(s.k==='dyn'){if(t>=22.5)dynFG(p,t);}
}

// ---------------- sound cues, on the same clock as the pictures ----------------
const CUES=[['land',.5],['tick',1],['tick',1.25],['clack',1.5],['steer',2],['steer',3],
  ...SCENES.slice(1).map(s=>['cut',s.t0]),
  ...[4.5,5,5.75,7.25,8.25,8.5].map(t=>['tick',t]),
  ...[...Array(8)].map((_,i)=>['ratchet',11+i*.25]),['clunk',16],['clunk',17],
  ['hiss',19.5],['tick',20.9],['bump',22.33],['bump',22.98],['bump',23.63],['bump',24.3],['bump',24.95],
  ['gun',26],['tick',27],['tick',27.5],['steer',27]];

// ---------------- stories ----------------
// The Late Model, from its own lab's car.glb copied in beside this page as lm.glb. It parks on the same floor
// as the sprint car, as one rigid piece in its CAD pose, painted through paint() like every other part.
let lm=null;
async function addLM(){
  const gltf=await new Promise(async(r,e)=>new THREE.GLTFLoader().parse(await(await fetch('lm.glb')).arrayBuffer(),'',r,e));
  const tint={steel:'--steel',link:'--link',uns:'--unsprung',tyre:'#17191b'},mats={};
  for(const k in tint){const m=new THREE.MeshStandardMaterial({metalness:.2,roughness:.55});m.userData.tint=tint[k];matCache.set('lm-'+k,m);mats[k]=m;}
  const kind=n=>/wheels/.test(n)?'tyre'
    :/chassis|sleevebearing|steeringbox|pitmanarm|centerlink|idlerarm|temp/.test(n)||/swaybar(?!end)/.test(n)?'steel'
    :/controlarm|truckarm|trackbar|swaybarend|balljoint|slug|9in|tierod|com12|aarmbar/.test(n)?'link':'uns';
  gltf.scene.traverse(o=>{if(!o.isMesh)return;
    let n=o.name,q=o.parent;while(!n&&q){n=q.name;q=q.parent;}
    o.geometry.computeVertexNormals();o.material=mats[kind(n.toLowerCase().replace(/[^a-z0-9]/g,''))];o.castShadow=o.receiveShadow=true;});
  lm=gltf.scene;lm.visible=false;scene.add(lm);
}
function story(i){
  const base={roll:0,h:0,pitch:0,drop:0},aim=(az,el,d,tz,tx=0,ty=0)=>{const A=az*Math.PI/180,E=el*Math.PI/180;cam.up.set(0,0,1);cam.position.set(tx+d*Math.cos(E)*Math.cos(A),ty+d*Math.cos(E)*Math.sin(A),tz+d*Math.sin(E));cam.lookAt(tx,ty,tz);cam.updateMatrixWorld(true);};
  const s=SCENES[0];lastSig='';$('rnrr').value=0;radj.clevis=0;radj.strap=7;$('stg').value=6.75;buildAll();model=calc();
  const p=PAL[['o','b','k','o'][i]];paint(p);b.fillStyle=p.bg;b.fillRect(0,0,W,H);
  const L=70,w=W-2*L;
  const sc=sun.shadow.camera,e=i===3?340:120;sc.left=sc.bottom=-e;sc.right=sc.top=e;sc.updateProjectionMatrix();
  if(lm)lm.visible=i===3;
  if(i===3){
    fit(b,'NOW ON',L,540,w,INK);fit(b,'TIKTOK FACEBOOK YOUTUBE',L,1500,w,BONE);txt(b,'SHORT TRACK CAD',L,1590,FONT(62,600),INK,'left',1);
    txt(b,'Late Model and Sprint Car Setup Labs',L,1660,FONT(54,400),INK);
    lm.position.set(-203,145,0);aim(-30,12,700,17,-99.5,58);}
  if(i===0){fit(b,'BETA',L,700,w,INK);fit(b,'IN LESS THAN A WEEK',L,1500,w,BONE);txt(b,'SPRINT CAR SETUP LAB',L,1590,FONT(62,600),INK,'left',1);aim(-34,5,500,28);}
  if(i===1){fit(b,'EVERY LINK',L,500,w,INK);fit(b,'SOLVED.',L,790,w,O);txt(b,'SPRINT CAR SETUP LAB',L,1590,FONT(62,600),INK,'left',1);txt(b,'Beta in less than a week',L,1660,FONT(54,400),INK);aim(-145,10,470,38);}
  if(i===2){fit(b,'WHO WANTS IN?',L,430,w,BONE);txt(b,'Sprint Car Setup Lab. Beta in less than a week.',L,506,FONT(52,400),BONE);aim(150,8,540,6);}
  bgTex.needsUpdate=true;
  const a=Object.assign({},base,{steer:i===0?-18:i===1?12:0}),n=16;
  for(let k=0;k<n;k++){
    poseCar(a);const ang=k*2.4,r=18*Math.sqrt((k+.5)/n);sun.position.set(110+r*Math.cos(ang),-90+r*Math.sin(ang),280);
    cam.setViewOffset(W,H,(k*.618%1)-.5,(k*.382%1)-.5,W,H);renderer.render(scene,cam);
    g.globalAlpha=1/(k+1);g.drawImage(renderer.domElement,0,0);
  }
  g.globalAlpha=1;cam.clearViewOffset();
}
const put=async(name,blob)=>{await fetch('out/'+name,{method:'PUT',body:blob});return blob.size;};

window.VID={cv,CUES,progress:0,
  async init(){await new Promise(r=>{const w=setInterval(()=>{if(loaded&&model){clearInterval(w);r();}},100);});
    await document.fonts.load(FONT(100));look();buildStrip();await addLM();return 'ready';},
  async still(t,name){draw(t);return put(name,await new Promise(r=>cv.toBlob(r,'image/jpeg',.9)));},
  async story(i,name){story(i);return put(name,await new Promise(r=>cv.toBlob(r,'image/png')));},
  async render(){
    const m=new Mp4Muxer.Muxer({target:new Mp4Muxer.ArrayBufferTarget(),video:{codec:'avc',width:W,height:H},fastStart:'in-memory'});
    const e=new VideoEncoder({output:(c,meta)=>m.addVideoChunk(c,meta),error:x=>{VID.error=String(x);}});
    e.configure({codec:'avc1.640033',width:W,height:H,bitrate:22e6,framerate:FPS,latencyMode:'quality'});
    const N=DUR*FPS;
    for(let i=0;i<N;i++){
      draw(i/FPS);const f=new VideoFrame(cv,{timestamp:Math.round(i*1e6/FPS),duration:Math.round(1e6/FPS)});
      e.encode(f,{keyFrame:i%60===0});f.close();VID.progress=(i+1)/N;
      while(e.encodeQueueSize>4)await new Promise(r=>setTimeout(r,4));
      if(i%10===0)await new Promise(r=>setTimeout(r,0));
    }
    await e.flush();m.finalize();
    await put('video.mp4',new Blob([m.target.buffer],{type:'video/mp4'}));VID.done=true;return N;
  },
};
})();
