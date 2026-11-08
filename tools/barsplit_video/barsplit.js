// Rear bar split, 9:16, 39 s: the same two rear torsion bars, 0.875 and 0.975, swapped side to side,
// and what that does to the tire loads at 0.8 g on throttle, 0 lateral, no wing. The torque tube lifts the
// rear on throttle, both bars unwind, and the stiffer one sheds more load - so the stiff side decides which
// rear tire gains. Built on rollcenter_video/rc.js and run the same way (README.md beside this file):
// it uses the lab's globals, every number is solved live. VID.init(), VID.still(t, name), VID.render().
(function(){
const W=1080,H=1920,FPS=30,SUB=8,SHUTTER=0.5;
const O='#F2500F',BONE='#ECE6D8',INK='#0F1012',LG='#7A7D82',TG='#4A4C52';
const FONT=(px,w=700)=>`${w} ${px}px Bahnschrift, "Barlow Condensed", sans-serif`;
const LEAN=Math.tan(12*Math.PI/180);
const LEFT=64,RIGHT=W-124;   // Reels keeps the right edge for its buttons
const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');
const bg=document.createElement('canvas');bg.width=W;bg.height=H;const b=bg.getContext('2d');
const cl=u=>Math.max(0,Math.min(1,u)),sm=u=>{u=cl(u);return u*u*(3-2*u);},out3=u=>1-Math.pow(1-cl(u),3);
const GAS={g:0,gx:.8},STILL={g:0,gx:0};
const SOFT=.875,STIFF=.975;
const A={l:SOFT,r:STIFF},Bs={l:STIFF,r:SOFT};    // setup A: stiff bar on the RR; B: swapped

// ---------------- shots ----------------
// cam: [u, azimuth, elevation, distance, target x, y, z] at the start and end; sh: px the picture is pushed up
// ghost: see-through chassis (c) and tyres (t); k: how far on throttle (0..1)
const SHOTS=[
  {k:'open',d:3.5,cam:[[0,147,6,520,0,0,24],[3.5,137,8,470,-4,0,22]],sh:-150,set:A,gas:1},
  {k:'bars',d:4.5,head:'REAR TORSION BARS',cam:[[0,158,34,340,-50,0,12],[5,170,38,320,-50,0,12]],sh:-40,set:A,ghost:'ct'},
  {k:'setA',d:5,head:'BITE ON THROTTLE',cam:[[0,180,88,430,2,0,10],[5,180,88,415,2,0,10]],sh:-60,set:A,ghost:'ct',loads:1,gas:1},
  {k:'swap',d:6,head:'SWAP SIDES',cam:[[0,180,88,415,2,0,10],[6,180,88,405,2,0,10]],sh:-60,ghost:'ct',loads:1,gas:1},
  // the why: the torque tube lifts the rear, and each bar lets go of rate x droop
  {k:'gas',d:6,head:'ON THROTTLE',cam:[[0,96,3,290,-25,0,17],[6,88,5,280,-25,0,17]],sh:-120,set:A,ghost:'ct',tube:1},
  {k:'shed',d:7,head:'LOAD LOSS TO TRAVEL',set:A,plots:1},     // no car: just the two plots, stacked
  {k:'sum',d:5.5,head:'STIFF RR = MORE LR',cam:[[0,145,24,560,0,0,18],[5.5,135,26,540,0,0,18]],sh:330,set:A,loads:1,gas:1},
  {k:'end',d:3.5},
];
{let t=0;for(const s of SHOTS){s.t0=t;t+=s.d;s.t1=t;}}
const DUR=SHOTS[SHOTS.length-1].t1;
const shotAt=t=>SHOTS.find(s=>t<s.t1)||SHOTS[SHOTS.length-1];
const SWAP_AT=1.6;     // s into the swap shot

// ---------------- look ----------------
let bgTex,stage3,fill,hemi,logo,HLO,HLB,GHC,GHT,BAR={},CHASSIS=[],TYRES=[];
function look(){
  window.requestAnimationFrame=()=>0;              // stop the lab's own loop; every frame is drawn from here
  document.body.style.visibility='hidden';
  for(const id of ['g','gx','bank','wing','fwing','dlr','drr'])$(id).step='any';
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
  carRoot.traverse(m=>{if(m.isMesh){m.castShadow=m.receiveShadow=true;m.userData.base=m.material;
    const n=m.name||'',bar=n.match(/Torsion_Bar-(\d)/);
    if(bar&&bar[1]==='4')BAR.L=m;if(bar&&bar[1]==='3')BAR.R=m;      // the rear bars: -4 runs the LR arm, -3 the RR
    if(/Chassis/.test(n))CHASSIS.push(m);if(/Tire/.test(n))TYRES.push(m);}});
  for(const m of matCache.values()){const t=m.userData.tint;
    if(t==='--steel'){m.color.set('#d5d7d8');m.metalness=.25;m.roughness=.45;}
    else if(t==='--unsprung')m.color.set('#70757b');
    else if(t==='--link')m.color.set('#8f949b');
    else if(t==='#17191b')m.color.set('#17181b');
  }
  HLO=new THREE.MeshStandardMaterial({color:O,emissive:O,emissiveIntensity:.35,metalness:.2,roughness:.42});
  HLB=new THREE.MeshStandardMaterial({color:BONE,emissive:BONE,emissiveIntensity:.25,metalness:.2,roughness:.42});
  GHC=new THREE.MeshStandardMaterial({color:'#d5d7d8',transparent:true,opacity:.13,depthWrite:false,metalness:.2,roughness:.5});
  GHT=new THREE.MeshStandardMaterial({color:'#17181b',transparent:true,opacity:.22,depthWrite:false});
  discs.forEach(d=>{d.material.color.set(O);d.material.opacity=.6;});
}
// colour follows the bar: the 0.975 is orange wherever it goes, the 0.875 bone
function looks(s,set){
  const gh=s.ghost||'';
  carRoot.traverse(m=>{if(m.isMesh&&m.userData.base)m.material=m.userData.base;});
  if(gh.includes('c'))CHASSIS.forEach(m=>m.material=GHC);
  if(gh.includes('t'))TYRES.forEach(m=>m.material=GHT);
  if(s.k!=='open'&&s.k!=='sum'){BAR.L.material=set.l===STIFF?HLO:HLB;BAR.R.material=set.r===STIFF?HLO:HLB;}
  if(s.tube)for(const n of ['tt1','tt2'])(G[n]||[]).forEach(m=>m.material=HLO);
  CHASSIS.forEach(m=>m.castShadow=!gh.includes('c'));
}

// ---------------- the setup ----------------
let lastBars='';
function apply(set,inp){
  if(!lastBars){fadj=JSON.parse(JSON.stringify(FADJ0));radj=JSON.parse(JSON.stringify(RADJ0));buildAll();}
  $('dlr').value=set.l;$('drr').value=set.r;lastBars=set.l+'/'+set.r;
  for(const id of ['g','gx'])$(id).value=inp[id];
  $('bank').value=0;$('wing').value=0;$('fwing').value=0;$('ttm').value=0;
  model=calc();world.rotation.x=0;world.updateMatrixWorld(true);
}
const CMP={};
function solveCompare(){
  for(const [k,set] of [['A',A],['B',Bs]]){apply(set,GAS);const m=model;
    const kk=[m.k.LF,m.k.RF,m.k.LR,m.k.RR];
    CMP[k]={loads:m.loads.slice(),lift:m.zJR,F:m.tt.F,L:m.tt.L,roll:m.phi*DEG,k:[m.k.LR,m.k.RR],
      drop:m.travel.slice(),spring:m.travel.map((x,i)=>x*kk[i])};}   // spring: load each bar lets go, lb (- = less)
}
function setupFor(s,u){return s.k==='swap'?(u<SWAP_AT?A:Bs):s.set;}

// ---------------- motion ----------------
// how far on throttle: the car's pose is the ride-height pose plus this share of the 0.8 g solve
function gasK(s,u){
  if(s.gas)return 1;
  if(s.k==='gas')return sm((u-1.2)/1.1);
  if(s.k==='shed')return sm((u-.8)/2.6);     // slow, so the dots can be followed up the lines
  return 0;
}
function poseCar(k){
  const r=model.rest,roll=r.phi+model.phi*k,zF=r.dzF+model.zJF*k,zR=r.dzR+model.zJR*k;
  const P=poseF(-zF,-roll,0,guessF);guessF=P;
  const Rp=poseR(-zR,-roll,guessR);guessR=Rp;
  bodyMatrix(B,roll,zF,zR);B.premultiply(BSET);place(P,Rp,B);
  carRoot.matrix.identity();carRoot.matrixWorldNeedsUpdate=true;
  return {P,Rp};
}

// ---------------- camera ----------------
let SH=0;
function camAt(t,s){
  const K=s.cam,u=t-s.t0;if(!K)return;
  const k=sm(u/s.d),o=K[0].map((v,i)=>v+(K[1][i]-v)*k),[,az,el,d,tx,ty,tz]=o,A_=az*Math.PI/180,E=el*Math.PI/180;
  cam.up.set(0,0,1);cam.position.set(tx+d*Math.cos(E)*Math.cos(A_),ty+d*Math.cos(E)*Math.sin(A_),tz+d*Math.sin(E));
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
function tag(label,val,y,a=1,col=O){
  if(a<=0)return;const h=92,font=FONT(h*.6,600),pad=h*.42;
  const w1=wOf(g,label,font,3)+2*pad,w2=val?wOf(g,val,FONT(h*.66,700),1)+2*pad:0;
  g.save();g.globalAlpha=a;g.fillStyle=INK;g.fillRect(LEFT,y,w1+w2,h);
  g.lineWidth=3;g.strokeStyle=LG;g.strokeRect(LEFT,y,w1,h);if(val)g.strokeRect(LEFT+w1,y,w2,h);
  txt(g,label,LEFT+w1/2,y+h*.7,font,BONE,'center',3);txt(g,val,LEFT+w1+w2/2,y+h*.72,FONT(h*.66,700),col,'center',1);
  g.restore();
}
const sgn=(x,n)=>(x>=0?'+':'−')+Math.abs(x).toFixed(n);
const tagIn=(s,t,d=.35)=>sm((t-s.t0-d)/.25);
const barCol=x=>x===STIFF?O:BONE;
const rate=(set,side)=>Math.round(CMP[set===A?'A':'B'].k[side==='L'?0:1]);
function arrowUp(x,y,up,col,sz=1){g.fillStyle=col;g.beginPath();if(up){g.moveTo(x,y-26*sz);g.lineTo(x+22*sz,y+10*sz);g.lineTo(x-22*sz,y+10*sz);}else{g.moveTo(x,y+26*sz);g.lineTo(x+22*sz,y-10*sz);g.lineTo(x-22*sz,y-10*sz);}g.closePath();g.fill();}
function lineW(a,b,col,lw){g.strokeStyle=col;g.lineWidth=lw;g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();}

// tire loads at each contact patch, the way the setup sheet reads: LF top left, RF top right
const TIREPT=[[42.77,29.7],[42.52,-28.38],[-42.92,27.35],[-42.37,-28.67]];
function loadNums(L,a){
  if(a<=0)return;g.save();g.globalAlpha=a;
  TIREPT.forEach((p,i)=>{const c=scr([p[0],p[1],0]),v=String(Math.round(L[i])),f=FONT(i>=2?96:78,700);
    g.lineWidth=12;g.strokeStyle=INK;g.lineJoin='round';g.font=f;g.fontStretch='condensed';g.textAlign='center';g.strokeText(v,c[0],c[1]+30);g.fontStretch='normal';
    txt(g,v,c[0],c[1]+30,f,BONE,'center');
    txt(g,['LF','RF','LR','RR'][i],c[0],c[1]+(i>=2?92:80),FONT(40,600),LG,'center',3);});
  g.restore();
}
const lerpL=(a,b,k)=>a.map((x,i)=>x+(b[i]-x)*k);

// load each bar lets go against how far its corner comes up: a straight line, as steep as the bar's rate.
// A dot rides each line as the rear lifts. The stiff bar's line is steep, so its dot climbs fast but stops
// early - that corner runs out of push and comes up less; the soft bar keeps pushing, its corner comes up further.
function ratePlot(s,t,k){
  const a=tagIn(s,t,.2);if(a<=0)return;
  const w=RIGHT-LEFT+30,h=690;
  onePlot(LEFT-10,w,440,h,CMP.A,A,'SPRING SPLIT',k,a);
  onePlot(LEFT-10,w,440+h+30,h,CMP.B,Bs,'REVERSE SPLIT',k,tagIn(s,t,.5));
}
// one setup: c = its solve, set = its bars (colour follows the bar: stiff orange, soft bone)
function onePlot(x0,w,top,h,c,set,title,k,a){
  if(a<=0)return;
  const X0=x0+100,X1=x0+w-36,Y0=top+h-125,Y1=top+200,XM=2.5,YM=300;
  const px=x=>X0+(X1-X0)*x/XM,py=y=>Y0-(Y0-Y1)*y/YM;
  g.save();g.globalAlpha=a;
  g.fillStyle='#16181b';g.fillRect(x0,top,w,h);g.lineWidth=3;g.strokeStyle=TG;g.strokeRect(x0,top,w,h);
  txt(g,title,x0+26,top+62,FONT(50,700),BONE,'left',2);
  // legend: the line's steepness is the bar's rate
  [['LR',set.l,c.k[0]],['RR',set.r,c.k[1]]].forEach(([lab,dia,kr],j)=>{const col=barCol(dia),y=top+118+j*50;
    lineW([x0+26,y-11],[x0+70,y-11],col,9);txt(g,lab+' '+dia.toFixed(3)+' · '+Math.round(kr)+' LB/IN',x0+84,y,FONT(38,700),col,'left',1);});
  g.lineWidth=2;g.strokeStyle='#26292e';
  for(let x=0;x<=XM+1e-9;x+=.5){g.beginPath();g.moveTo(px(x),Y0);g.lineTo(px(x),Y1);g.stroke();txt(g,x.toFixed(1),px(x),Y0+42,FONT(32,600),LG,'center');}
  for(let y=0;y<=YM;y+=100){g.beginPath();g.moveTo(X0,py(y));g.lineTo(X1,py(y));g.stroke();txt(g,String(y),X0-12,py(y)+10,FONT(30,600),LG,'right');}
  txt(g,'CORNER RISE, IN',(X0+X1)/2,Y0+94,FONT(36,600),LG,'center',3);
  g.save();g.translate(x0+34,(Y0+Y1)/2);g.rotate(-Math.PI/2);txt(g,'LBS',0,0,FONT(38,700),LG,'center',3);g.restore();
  const pts=[[2,set.l,c.k[0]],[3,set.r,c.k[1]]].map(([i,dia,kr])=>{const rise=Math.abs(c.drop[i])*k;return {col:barCol(dia),kr,rise,lost:kr*rise};});
  g.save();g.beginPath();g.rect(X0,Y1-40,X1-X0+30,Y0-Y1+40);g.clip();
  for(const q of pts){
    const xe=Math.min(XM,YM/q.kr);
    g.save();g.globalAlpha=a*.35;g.setLineDash([12,10]);lineW([px(0),py(0)],[px(xe),py(q.kr*xe)],q.col,4);g.restore();   // the bar's rate
    if(k>0)lineW([px(0),py(0)],[px(q.rise),py(q.lost)],q.col,8);                                                          // where it has got to
    g.fillStyle=q.col;g.beginPath();g.arc(px(q.rise),py(q.lost),13,0,7);g.fill();g.lineWidth=4;g.strokeStyle=INK;g.stroke();
  }
  g.restore();
  // values outside the clip: the steeper line's above-left of its dot, the shallower one's below-right
  const steep=pts[0].kr>pts[1].kr?0:1;
  pts.forEach((q,j)=>{const up=j===steep;g.save();g.globalAlpha=a*sm((k-.45)/.15);
    txt(g,'−'+Math.round(q.lost)+' LB',px(q.rise)+(up?-22:60),py(q.lost)+(up?-22:84),FONT(58,700),q.col,'right');g.restore();});
  g.restore();
}

// ---------------- per-shot overlays ----------------
function fg(s,t,pz){
  const u=t-s.t0,a=tagIn(s,t);
  switch(s.k){
    case 'bars':
      tag('LR BAR',SOFT.toFixed(3)+' IN',1440,a,BONE);tag('RR BAR',STIFF.toFixed(3)+' IN',1550,tagIn(s,t,.6));
      tag('AT THE WHEEL',rate(A,'L')+' / '+rate(A,'R')+' LB/IN',1660,tagIn(s,t,1.4),BONE);break;
    case 'gas':{
      const k=gasK(s,u),tb=SC.torqueTube(pz.Rp,R,0);
      if(tb&&k>0){const p=scr(tb.ball,B),len=260*k;g.save();g.globalAlpha=sm(k*3);
        lineW([p[0],p[1]-30],[p[0],p[1]-30-len],O,10);arrowUp(p[0],p[1]-30-len,true,O,1.6);
        txt(g,Math.round(CMP.A.F*k)+' LB',p[0]+40,p[1]-60-len,FONT(70,700),BONE,'left');g.restore();}
      tag('TORQUE TUBE',CMP.A.L.toFixed(1)+' IN LEVER',1440,a,BONE);
      tag('LONG G',(.8*k).toFixed(2),1550,tagIn(s,t,1.1));
      tag('REAR LIFTS',sgn(CMP.A.lift*k,1)+' IN',1660,tagIn(s,t,1.6));break;}
    case 'shed':{
      ratePlot(s,t,gasK(s,u));break;}
    case 'setA':
      loadNums(CMP.A.loads,a);
      tag('LR / RR BAR',SOFT.toFixed(3)+' / '+STIFF.toFixed(3),1700,tagIn(s,t,.8),BONE);break;
    case 'swap':{
      const k=sm((u-SWAP_AT-.1)/.8),L=lerpL(CMP.A.loads,CMP.B.loads,k),set=setupFor(s,u);
      loadNums(L,1);
      tag('LR / RR BAR',set.l.toFixed(3)+' / '+set.r.toFixed(3),1700,1,BONE);
      if(k>.95){const c=scr([TIREPT[2][0],TIREPT[2][1],0]),d=Math.round(CMP.B.loads[2])-Math.round(CMP.A.loads[2]),a2=sm((u-SWAP_AT-1)/.3);
        g.save();g.globalAlpha=a2;txt(g,sgn(d,0),c[0],c[1]-70,FONT(84,700),O,'center');g.restore();}
      break;}
    case 'sum':{
      const y0=1180,cw=(RIGHT-LEFT-24)/2,cols=[['RR STIFF',CMP.A,A],['LR STIFF',CMP.B,Bs]];
      cols.forEach(([name,c,set],i)=>{const x=LEFT+i*(cw+24),on=i===0,al=tagIn(s,t,.35+i*.35);if(al<=0)return;
        g.save();g.globalAlpha=al*(on?1:.6);
        g.fillStyle='#16181b';g.fillRect(x,y0,cw,430);g.lineWidth=on?6:3;g.strokeStyle=on?O:TG;g.strokeRect(x,y0,cw,430);
        txt(g,name,x+28,y0+70,FONT(54,700),on?O:BONE,'left',2);
        txt(g,'LR / RR',x+28,y0+150,FONT(34,600),LG,'left',2);txt(g,set.l.toFixed(3).slice(1)+' / '+set.r.toFixed(3).slice(1),x+cw-28,y0+150,FONT(44,700),BONE,'right');
        txt(g,'LR LOAD',x+28,y0+240,FONT(34,600),LG,'left',2);
        txt(g,String(Math.round(c.loads[2])),x+cw-28,y0+380,FONT(150,700),on?BONE:LG,'right');
        txt(g,'LB',x+28,y0+380,FONT(40,600),LG);g.restore();});
      const R_=x=>Math.round(x),a3=tagIn(s,t,1.6),d=R_(CMP.A.loads[2])-R_(CMP.B.loads[2]),dlf=R_(CMP.A.loads[0])-R_(CMP.B.loads[0]);
      tag('LR',sgn(d,0)+' LB',1650,a3);tag('LF',sgn(dlf,0)+' LB',1760,tagIn(s,t,2.2),BONE);
      break;}
  }
}

// ---------------- title and end ----------------
function openFG(s,t){
  const T='REAR BAR SPLIT',px=fitPx(g,T,RIGHT-LEFT,200),w=out3((t-.4)/.35);
  g.save();g.beginPath();g.rect(0,430-px*1.05,(RIGHT+80)*w,px*1.3);g.clip();lean(g,T,LEFT+12,430,px,BONE);g.restore();
  const a=sm((t-1.0)/.3);
  if(a>0){g.globalAlpha=a;txt(g,'SPRINT CAR SETUP LAB',LEFT,540,FONT(60,700),O,'left',4);g.globalAlpha=1;}
  tag('SPRING SPLIT / REVERSE SPLIT','',1560,sm((t-1.6)/.25),BONE);
  tag('LR LOAD ON THROTTLE',sgn(Math.round(CMP.A.loads[2])-Math.round(CMP.B.loads[2]),0)+' LB',1670,sm((t-2.1)/.25));
}
function endFG(s,t){
  const u=t-s.t0,lw=760,lh=lw*logo.height/logo.width,lx=(W-lw)/2,ly=600,a=out3(u/.5);
  g.save();g.beginPath();g.rect(lx-20,ly-20,(lw+40)*a,lh+40);g.clip();g.drawImage(logo,lx,ly,lw,lh);g.restore();
  g.globalAlpha=sm((u-.5)/.3);txt(g,'SPRINT CAR SETUP LAB',W/2,ly+lh+150,FONT(84,700),BONE,'center',4);g.globalAlpha=1;
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
  const s=shotAt(t),u=t-s.t0;
  if(!bgSig){bgSig='x';paintBg();}
  if(s.k==='end'){g.globalAlpha=1;g.drawImage(bg,0,0);endFG(s,t);fade(t);return;}
  if(s.plots){g.globalAlpha=1;g.drawImage(bg,0,0);apply(s.set,GAS);header(s,t);fg(s,t,null);fade(t);return;}
  const set=setupFor(s,u);
  apply(set,GAS);looks(s,set);
  const swapK=s.k==='swap'?sm((u-SWAP_AT-.1)/.8):0;
  const L=s.k==='swap'?lerpL(CMP.A.loads,CMP.B.loads,swapK):model.loads;
  discs.forEach((d,i)=>{d.visible=!!s.loads;const r=Math.sqrt(Math.max(L[i],0))*.6;d.scale.set(r,r,1);});
  let pz;
  for(let i=0;i<SUB;i++){
    const tt=Math.max(s.t0,t+(i/SUB-.5)*SHUTTER/FPS);
    camAt(tt,s);pz=poseCar(gasK(s,tt-s.t0));
    const ang=i*2.4,r=9*Math.sqrt((i+.5)/SUB);
    sun.position.set(110+r*Math.cos(ang)*2,-90+r*Math.sin(ang)*2,280);
    cam.setViewOffset(W,H,(i*.618%1)-.5,(i*.382%1)-.5+SH,W,H);
    renderer.render(scene,cam);
    g.globalAlpha=1/(i+1);g.drawImage(renderer.domElement,0,0);
  }
  g.globalAlpha=1;cam.clearViewOffset();
  camAt(t,s);pz=poseCar(gasK(s,u));
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
    await new Promise(r=>{const w=setInterval(()=>{if(loaded&&model){clearInterval(w);r();}},100);});
    await document.fonts.load(FONT(100));
    logo=new Image();await new Promise((r,j)=>{logo.onload=r;logo.onerror=j;logo.src='logo.png';});   // before look(): it stops the frame loop
    look();solveCompare();
    return {dur:DUR,A:CMP.A.loads.map(Math.round),B:CMP.B.loads.map(Math.round),lift:+CMP.A.lift.toFixed(2),F:Math.round(CMP.A.F),L:+CMP.A.L.toFixed(2),rates:[CMP.A.k.map(Math.round),CMP.B.k.map(Math.round)]};},
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
    await put('barsplit.mp4',new Blob([m.target.buffer],{type:'video/mp4'}));VID.done=true;return N;
  },
};
})();
