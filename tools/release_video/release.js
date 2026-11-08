// Release video, 9:16, short form: "Sprint Car Setup Lab: Out Now", then one feature per shot.
// Every shot is 5 s, opens on a hard cut with a header naming what is on screen, and moves one
// real adjustment through the live model. No sound: the voice-over goes on top.
// Runs inside a copy of the lab page and uses its globals (model, calc, buildAll, poseF, ...).
// VID.init(), VID.still(t, name), VID.render().
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
// the move every adjustment makes: hold, ease to A, hold, ease to B, hold to the cut
const AB=(u,A,B)=>A*sm((u-.8)/.8)+(B-A)*sm((u-2.6)/.8);
const step3=(u,a,b,c)=>u<1.4?a:u<2.9?b:c;

// ---------------- shots ----------------
// cam: [u, azimuth, elevation, distance, target x, y, z], sh: px the picture is pushed up
const SHOTS=[
  {k:'open',cam:[[0,-28,5,520,0,0,30],[5,-44,9,480,4,0,26]],sh:-60},
  {k:'bars',head:'TORSION BARS',hl:['fbarL','fbarR'],cam:[[0,-36,18,300,38,0,14],[5,-50,22,285,38,0,14]],sh:-60},
  {k:'caster',head:'CASTER',hl:[],cam:[[0,82,6,250,42,27,17],[5,94,8,238,42,27,17]],sh:-80},
  {k:'camber',head:'CAMBER',hl:['fknL'],cam:[[0,10,4,215,42,24,15],[5,0,5,205,42,24,15]],sh:-110},
  {k:'rods',head:'RADIUS RODS',hl:['rrodL'],cam:[[0,172,72,420,-38,0,8],[5,186,76,410,-38,0,8]],sh:-150},
  {k:'holes',head:'MOUNTING HOLES',hl:['frodRU'],cam:[[0,-82,8,270,30,-18,16],[5,-96,10,255,30,-18,16]],sh:0},
  {k:'clock',head:'BIRDCAGE CLOCKING',hl:['rcageL'],ghost:['rtyreL'],cam:[[0,92,4,265,-44,24,15],[5,98,6,252,-44,24,15]],sh:-90},
  {k:'ladder',head:"JACOB'S LADDER",hl:['ladT','ladU','ladL'],cam:[[0,194,8,350,-44,0,15],[5,184,10,335,-44,0,15]],sh:-130},
  {k:'tbar',head:'TRACK BAR',hl:['ftb'],cam:[[0,-8,6,345,42,0,16],[5,6,8,330,42,0,16]],sh:0},
  {k:'bump',head:'BUMP STEER',hl:['drag','pitman'],cam:[[0,-28,24,470,30,-4,14],[5,-40,28,455,30,-4,14]],sh:-90},
  {k:'stag',head:'STAGGER',hl:['rtyreL'],cam:[[0,150,8,400,-42,0,16],[5,140,10,385,-42,0,16]],sh:0},
  {k:'ride',head:'RIDE HEIGHTS',hl:['rbarR'],cam:[[0,-34,5,560,0,0,22],[5,-44,7,545,0,0,22]],sh:200},
  {k:'lat',head:'LATERAL G',hl:[],cam:[[0,-4,12,600,0,0,22],[5,4,14,585,0,0,22]],sh:200,loads:1},
  {k:'long',head:'LONGITUDINAL G',hl:[],cam:[[0,-86,8,620,0,0,22],[5,-94,9,605,0,0,22]],sh:200,loads:1},
  {k:'bank',head:'BANKING',hl:[],cam:[[0,-2,8,600,0,0,22],[5,2,9,590,0,0,22]],sh:200,loads:1},
  {k:'wing',head:'WING VS NO WING',hl:[],cam:[[0,-36,16,600,0,0,22],[5,-46,18,585,0,0,22]],sh:200,loads:1},
  {k:'kin',head:'KINEMATIC CHARTS',hl:[],cam:[[0,-30,8,640,0,0,26],[5,-40,10,625,0,0,26]],sh:290},
  {k:'end'},
];
SHOTS.forEach((s,i)=>{s.t0=i*SHOT;s.t1=s.t0+SHOT;s.cap=s.k!=='open'&&s.k!=='end';});
SHOTS[SHOTS.length-1].t1+=1;   // the end card holds a beat longer
const DUR=SHOTS[SHOTS.length-1].t1;
const shotAt=t=>SHOTS.find(s=>t<s.t1)||SHOTS[SHOTS.length-1];

// ---------------- look ----------------
let bgTex,floor,stage3,fill,hemi,HL,GHOST,logo;
function look(){
  window.requestAnimationFrame=()=>0;              // stop the lab's own loop; every frame is drawn from here
  document.body.style.visibility='hidden';
  for(const id of ['stg','g','gx','bank','wing','dlf','rnrr'])$(id).step='any';
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
  stage3.receiveShadow=true;stage3.position.z=.02;world.add(stage3);    // in the banked group, so it tilts with the track
  fill=new THREE.DirectionalLight(0xffffff,.22);fill.position.set(-200,160,120);scene.add(fill);
  carRoot.traverse(m=>{if(m.isMesh){m.castShadow=m.receiveShadow=true;m.userData.base=m.material;}});
  for(const m of matCache.values()){const t=m.userData.tint;
    if(t==='--steel'){m.color.set('#d5d7d8');m.metalness=.25;m.roughness=.45;}
    else if(t==='--unsprung')m.color.set('#70757b');
    else if(t==='#17191b')m.color.set('#17181b');
  }
  HL=new THREE.MeshStandardMaterial({color:O,metalness:.2,roughness:.42});
  GHOST=new THREE.MeshStandardMaterial({color:'#3a3d42',transparent:true,opacity:.14,depthWrite:false});
  discs.forEach(d=>{d.material.color.set(O);d.material.opacity=.55;});
}
// links read grey so the one part being adjusted is the only orange on screen
let hlSig=null;
function highlight(s){
  const sig=s.k;if(sig===hlSig)return;hlSig=sig;
  const on=new Set(s.hl||[]),gh=new Set(s.ghost||[]),brand=!s.hl;
  for(const m of matCache.values())if(m.userData.tint==='--link')m.color.set(brand?O:'#8f949b');
  for(const [name,list] of Object.entries(G))for(const o of list)o.traverse(m=>{if(m.isMesh&&m.userData.base)m.material=on.has(name)?HL:gh.has(name)?GHOST:m.userData.base;});
}

// ---------------- the setup, per shot ----------------
const BASE={g:0,gx:0,bank:0,wing:0,stg:6.75,dlf:.95,rnrr:0};
let lastSig='',rest0=null;
function setup(t,s){
  const u=t-s.t0,inp=Object.assign({},BASE),f=JSON.parse(JSON.stringify(FADJ0)),r=JSON.parse(JSON.stringify(RADJ0));
  let clk=null;
  switch(s.k){
    case 'bars':inp.dlf=q(.95+AB(u,.075,-.075),.005);break;
    case 'caster':f.caster[0]=q(AB(u,3,-3),.25);break;
    case 'camber':f.camber[0]=q(AB(u,2,-2),.25);break;
    case 'rods':r.rodLen[0]=q(AB(u,1.5,-1.5),1/16);break;
    case 'holes':f.rodCz[0]=q(AB(u,2,-2),1/16);break;
    case 'clock':clk=q(rest0.clock+AB(u,8-rest0.clock,-8-rest0.clock),.1);break;
    case 'ladder':r.clevis=step3(u,0,.625,-.625);break;
    case 'tbar':f.tbA=f.tbC=q(AB(u,3,-3),.125);break;
    case 'bump':f.pitmanHole=q(AB(u,2,-2),1/16);break;
    case 'stag':inp.stg=q(4+AB(u,4,8),.25);break;
    case 'ride':inp.rnrr=Math.round(AB(u,4,-4));break;
    case 'lat':inp.g=q(AB(u,.8,1.4),.01);break;
    case 'long':inp.g=0;inp.gx=q(AB(u,-1,.8),.01);break;
    case 'bank':inp.g=1.15;inp.bank=q(AB(u,10,20),.5);break;
    case 'wing':inp.g=1.15;inp.wing=u<2.4?0:1200;break;
  }
  const sig=JSON.stringify([f,r,inp.stg,clk]);
  if(sig!==lastSig){
    lastSig=sig;fadj=f;radj=r;$('stg').value=inp.stg;buildAll();
    if(clk!=null){clockTo(0,clk);buildAll();}
  }
  for(const id of ['g','gx','bank','wing','dlf','rnrr'])$(id).value=inp[id];
  model=calc();
  world.rotation.x=-model.bank;world.updateMatrixWorld(true);
  return inp;
}

// ---------------- motion ----------------
const wave=(t,per,ph=0)=>Math.sin(2*Math.PI*(t/per+ph));
function attitude(t,s){
  const o={h:0,roll:0,pitch:0,steer:0,drop:0,model:!!s.loads},u=t-s.t0;
  if(s.k==='open'){
    if(u<.5){o.drop=125*(1-(u/.5)*(u/.5));o.h=2.2;}
    else{const v=u-.5;o.h=2.2*Math.exp(-2.6*v)*Math.cos(11*v);o.pitch=.9*Math.exp(-2.2*v)*Math.sin(11*v);}
    o.steer=-14*sm((u-2.2)/.5)*sm((4.6-u)/.5);
  }else if(s.k==='bump'){
    o.h=1.6*wave(u,1.6)*sm(u/.4);
  }else if(s.k==='kin'){
    o.h=2.4*sm(u/.2)*sm((1.8-u)/.2)*wave(u,1.6);
    o.roll=3.4*sm((u-1.6)/.2)*sm((3.4-u)/.2)*wave(u-1.6,1.6);
    o.pitch=2.2*sm((u-3.2)/.2)*sm((5-u)/.2)*wave(u-3.2,1.6);
  }
  return o;
}
let B2=null;
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
// screen point of a chassis-frame point, through the body matrix and the banked group
function scr(p,bm){_v.set(p[0],p[1],p[2]);if(bm)_v.applyMatrix4(bm);_v.applyMatrix4(world.matrixWorld);_v.project(cam);return [(_v.x+1)/2*W,(1-_v.y)/2*H-SH];}
const wpt=(p,bm)=>{const v=new THREE.Vector3(p[0],p[1],p[2]);if(bm)v.applyMatrix4(bm);return v;};
function scrW(v){_v.copy(v).applyMatrix4(world.matrixWorld).project(cam);return [(_v.x+1)/2*W,(1-_v.y)/2*H-SH];}

// ---------------- type ----------------
function txt(c,s,x,y,font,color,align='left',sp=0){c.font=font;c.fontStretch='condensed';c.fillStyle=color;c.textAlign=align;c.letterSpacing=sp+'px';c.fillText(s,x,y);c.letterSpacing='0px';c.fontStretch='normal';}
function wOf(c,s,font,sp=0){c.font=font;c.fontStretch='condensed';c.letterSpacing=sp+'px';const w=c.measureText(s).width;c.letterSpacing='0px';c.fontStretch='normal';return w;}
const fitPx=(c,s,w,max,wt=700)=>Math.min(max,100*w/wOf(c,s,FONT(100,wt)));
function lean(c,s,x,y,px,color,align='left',w=700){c.save();c.translate(x,y);c.transform(1,0,-LEAN,1,0,0);txt(c,s,0,0,FONT(px,w),color,align);c.restore();}
// the shot's header: the name of what is on screen, nothing else
function header(s,t){
  const u=out3((t-s.t0)/.3),px=fitPx(g,s.head,RIGHT-LEFT-40,150),y=330;
  g.save();g.beginPath();g.rect(0,y-px*1.05,(LEFT+40+(RIGHT-LEFT))*u+20,px*1.3);g.clip();
  lean(g,s.head,LEFT+12,y,px,BONE);g.restore();
  g.fillStyle=O;g.fillRect(LEFT,y+34,140*out3((t-s.t0-.1)/.3),10);
}
// a value readout in the logo's tolerance-frame style: [ LABEL | VALUE ]
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
function dot(p,r=11,col=O){g.fillStyle=col;g.beginPath();g.arc(p[0],p[1],r,0,7);g.fill();g.lineWidth=4;g.strokeStyle=INK;g.stroke();}
function ring(p){g.fillStyle=BONE;g.strokeStyle=INK;g.lineWidth=6;g.beginPath();g.arc(p[0],p[1],22,0,7);g.fill();g.stroke();g.fillStyle=O;g.beginPath();g.arc(p[0],p[1],8,0,7);g.fill();}
const gnd=pz=>toGnd(pz.zF,pz.zR,pz.roll);

// setup-sheet layout, looking down at the car: LF top left, RF top right, LR bottom left, RR bottom right
function card(vals,fmt,unit,y0=1330,hot=-1){
  const cw=(RIGHT-LEFT)/2,ch=150,n=['LF','RF','LR','RR'];
  n.forEach((c,i)=>{const x=LEFT+(i%2)*cw,y=y0+(i>>1)*ch;
    if(i===hot){g.fillStyle=O;g.fillRect(x,y,cw,ch);}
    const ink=i===hot?INK:BONE;
    txt(g,c,x+22,y+50,FONT(40,600),i===hot?INK:LG,'left',2);
    txt(g,fmt(vals[i]),x+cw-24,y+124,FONT(96),ink,'right');
    if(unit)txt(g,unit,x+22,y+124,FONT(40,500),i===hot?INK:LG);
  });
  g.strokeStyle=TG;g.lineWidth=3;g.beginPath();
  g.moveTo(LEFT,y0+ch);g.lineTo(LEFT+2*cw,y0+ch);g.moveTo(LEFT+cw,y0);g.lineTo(LEFT+cw,y0+2*ch);g.stroke();
}

// ---------------- per-shot overlays ----------------
function fg(s,t,pz,inp){
  const P=pz.P,Rp=pz.Rp,u=t-s.t0,a=tagIn(s,t);
  switch(s.k){
    case 'bars':{
      tag('LF BAR',inp.dlf.toFixed(3)+' IN',1500,a);
      tag('LF RATE',Math.round(model.k.LF)+' LB/IN',1610,a);break;}
    case 'caster':{
      const k=P.kp.L,c=SC.angles(P.wheel.L,1,k).caster-gnd(pz).pitch;
      if(a>0){g.globalAlpha=a;lineW(scr(V.add(k.p,V.mul(k.dir,-16)),B),scr(V.add(k.p,V.mul(k.dir,10)),B),O,6);g.globalAlpha=1;}
      tag('LF CASTER',c.toFixed(1)+'°',1500,a);break;}
    case 'camber':{
      const A=SC.angles(P.wheel.L,1),c=A.camber-gnd(pz).roll,cp=wpt(A.CP,B),wc=wpt(P.wheel.L.c,B);
      const d=wc.clone().sub(cp).multiplyScalar(2.1);
      if(a>0){g.globalAlpha=a;
        lineW(scrW(cp),scrW(cp.clone().add(new THREE.Vector3(0,0,d.length()))),LG,3,[14,10]);
        lineW(scrW(cp),scrW(cp.clone().add(d)),O,6);g.globalAlpha=1;}
      tag('LF CAMBER',sgn(c,2)+'°',1500,a);break;}
    case 'rods':{
      const L=Rp.wheel.L.c,R=Rp.wheel.R.c,m=V.mid(L,R),dx=R[0]-L[0],dy=R[1]-L[1],n=Math.hypot(dx,dy),k=1.25;
      if(a>0){g.globalAlpha=a;
        lineW(scr([m[0],m[1]+n*k/2,m[2]],B),scr([m[0],m[1]-n*k/2,m[2]],B),LG,3,[14,10]);
        lineW(scr([m[0]-dx*k/2,m[1]-dy*k/2,m[2]],B),scr([m[0]+dx*k/2,m[1]+dy*k/2,m[2]],B),O,6);g.globalAlpha=1;}
      tag('LR ROD',sgn(radj.rodLen[0],3)+' IN',1500,a);
      tag('REAR STEER',sgn(SC.rearSteer(Rp),2)+'°',1610,a);break;}
    case 'holes':{
      if(a>0){g.globalAlpha=a;dot(scr(P.links[0].c,B),13);g.globalAlpha=1;}
      const c=SC.angles(P.wheel.R,-1,P.kp.R).caster-gnd(pz).pitch;
      tag('RU ROD',sgn(fadj.rodCz[0],3)+' IN',1500,a);
      tag('RF CASTER',c.toFixed(1)+'°',1610,a);break;}
    case 'clock':{
      const c=Rp.cage[0],A=scr(c.barArm,B),R_=scr(c.rodA,B),len=Math.hypot(R_[0]-A[0],R_[1]-A[1])*1.25,ang=Math.atan2(R_[0]-A[0],A[1]-R_[1]);
      if(a>0){g.save();g.globalAlpha=a;
        lineW(A,[A[0],A[1]-len],LG,3,[14,10]);
        lineW(A,[A[0]+Math.sin(ang)*len,A[1]-Math.cos(ang)*len],O,7);
        g.strokeStyle=O;g.lineWidth=3;g.beginPath();g.arc(A[0],A[1],len*.6,-Math.PI/2,-Math.PI/2+ang,ang<0);g.stroke();
        dot(A,10);dot(R_,10);g.restore();}
      tag('LR CLOCKING',sgn(c.clock,1)+'°',1500,a);break;}
    case 'ladder':{
      const ic=SC.ladderIC(Rp);
      if(ic&&a>0){const c=scr([Rp.lad.aUp[0],ic.y,ic.z],B);g.globalAlpha=a;
        for(const e of [Rp.lad.aUp,Rp.lad.aLo])lineW(scr(e,B),c,BONE,4,[16,12]);ring(c);g.globalAlpha=1;}
      tag('CLEVIS',radj.clevis>0?'HIGH':radj.clevis<0?'LOW':'MID',1500,a);
      tag('REAR RC',model.hr.toFixed(2)+' IN',1610,a);break;}
    case 'tbar':{
      const rc=SC.frontRC(P);
      if(rc&&a>0){const c=scr([P.tb.a[0],0,rc.z],B);g.globalAlpha=a;lineW(scr(P.tb.c,B),c,BONE,4,[16,12]);ring(c);g.globalAlpha=1;}
      tag('TRACK BAR',sgn(fadj.tbA,3)+' IN',1500,a);
      tag('FRONT RC',model.hf.toFixed(2)+' IN',1610,a);break;}
    case 'bump':{
      const h=-model.rest.dzF,ps=-model.rest.phi,tL=hh=>SC.angles(poseF(h+hh,ps,0).wheel.L,1).toe,bs=(tL(1)-tL(-1))/2;
      tag('PITMAN HOLE',sgn(fadj.pitmanHole,3)+' IN',1500,a);
      tag('LF BUMP STEER',sgn(bs,2)+' °/IN',1610,a);break;}
    case 'stag':tag('STAGGER',inp.stg.toFixed(2)+' IN',1500,a);break;
    case 'ride':{
      tag('RR ROUNDS',inp.rnrr>0?inp.rnrr+' IN':inp.rnrr<0?-inp.rnrr+' OUT':'0',1180,a);   // + = in
      if(a>0){g.globalAlpha=a;card(model.rest.hNow,x=>x.toFixed(2),'IN',1330,3);g.globalAlpha=1;}break;}
    case 'lat':case 'long':case 'bank':case 'wing':{
      const lab={lat:['LATERAL',inp.g.toFixed(2)+' G'],long:['LONGITUDINAL',sgn(inp.gx,2)+' G'],bank:['BANKING',inp.bank.toFixed(1)+'°'],
        wing:['TOP WING',inp.wing?inp.wing.toLocaleString('en-US')+' LB':'NONE']}[s.k];
      tag(lab[0],lab[1],1180,a);
      if(a>0){g.globalAlpha=a;card(model.loads,x=>Math.round(Math.max(x,0)).toLocaleString('en-US'),'LB',1330);g.globalAlpha=1;}break;}
    case 'kin':if(a>0){g.globalAlpha=a;charts(t);g.globalAlpha=1;}break;
  }
}

// ---------------- kinematic charts: the real outputs, swept up front ----------------
const STRIP=[['LF CAMBER','camL'],['RF CAMBER','camR'],['LF TOE','toeL'],['REAR STEER','rst'],['REAR RC','hr'],['RR CLOCKING','clkR']];
let strip=null;
function buildStrip(){
  const s=SHOTS.find(x=>x.k==='kin');setup(s.t0,s);strip={o:[]};let gs=null;
  for(let t=s.t0;t<s.t1+1e-6;t+=1/FPS){const a=attitude(t,s);gs=dynPoint(a.h,a.roll,a.pitch,gs);strip.o.push(gs);}
  strip.r={};for(const [,k] of STRIP){const v=strip.o.map(o=>o[k]).filter(isFinite),lo=Math.min(...v),hi=Math.max(...v),m=Math.max((hi-lo)*.12,.05);strip.r[k]=[lo-m,hi+m];}
  strip.t0=s.t0;lastSig='';
}
function charts(t){
  const y0=1080,cw=(RIGHT-LEFT-30)/2,ch=150,gapY=20,n=Math.round((t-strip.t0)*FPS);
  STRIP.forEach(([lab,k],i)=>{
    const x=LEFT+(i%2)*(cw+30),y=y0+(i>>1)*(ch+gapY),[lo,hi]=strip.r[k],j1=Math.max(0,Math.min(n,strip.o.length-1)),last=strip.o[j1][k];
    g.strokeStyle=TG;g.lineWidth=2;g.beginPath();g.moveTo(x,y+ch);g.lineTo(x+cw,y+ch);g.stroke();
    txt(g,lab,x,y+34,FONT(34,600),LG,'left',2);
    txt(g,sgn(last,2),x+cw,y+36,FONT(42),O,'right');
    g.strokeStyle=O;g.lineWidth=5;g.lineJoin='round';g.beginPath();
    const X=j=>x+j/(strip.o.length-1)*cw,Y=v=>y+ch-8-(v-lo)/(hi-lo)*(ch-56);
    for(let j=0;j<=j1;j++){const v=strip.o[j][k];if(!isFinite(v))continue;j?g.lineTo(X(j),Y(v)):g.moveTo(X(j),Y(v));}
    g.stroke();
  });
}

// ---------------- title and end ----------------
function openFG(s,t){
  const px=fitPx(g,'SPRINT CAR',RIGHT-LEFT,230);
  const w=k=>out3((t-.6-k*.18)/.35);
  for(const [k,line,y,col] of [[0,'SPRINT CAR',430,BONE],[1,'SETUP LAB',650,O]]){
    g.save();g.beginPath();g.rect(0,y-px*1.05,(RIGHT+80)*w(k),px*1.3);g.clip();lean(g,line,LEFT+12,y,px,col);g.restore();
  }
  const a=sm((t-1.4)/.3);
  if(a>0){const h=118,f=FONT(h*.66,700),lab='OUT NOW',ww=wOf(g,lab,f,8)+h*1.2;
    g.save();g.globalAlpha=a;g.fillStyle=O;g.fillRect(LEFT,1480,ww,h);txt(g,lab,LEFT+ww/2,1480+h*.73,f,INK,'center',8);g.restore();}
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


// ---------------- filmed shots: the real app (cap.js), stage on top, its panel rows on a card below ----------------
const META={},TOP=[400,1290],CARD=[1330,1640];
function loadImg(src){return new Promise((r,j)=>{const im=new Image();im.onload=()=>r(im);im.onerror=j;im.src=src;});}
function arrow(x,y,press){
  if(press>0){g.save();g.globalAlpha=.55*press;g.fillStyle=O;g.beginPath();g.arc(x,y,30,0,7);g.fill();g.restore();}
  g.save();g.translate(x,y);g.scale(1.5,1.5);g.beginPath();
  g.moveTo(0,0);g.lineTo(0,24);g.lineTo(6,18.5);g.lineTo(10.5,28);g.lineTo(14.5,26.2);g.lineTo(10.2,17);g.lineTo(18,17);g.closePath();
  g.fillStyle='#fff';g.fill();g.lineWidth=1.6;g.strokeStyle='#000';g.stroke();g.restore();
}
async function drawCap(s,t){
  const M=META[s.k],n=Math.max(0,Math.min(M.frames.length-1,Math.round((t-s.t0)*FPS))),id=String(n).padStart(4,'0');
  const [st,pn]=await Promise.all([loadImg(`cap/${s.k}/s_${id}.jpg`),loadImg(`cap/${s.k}/p_${id}.jpg`)]);
  g.globalAlpha=1;g.drawImage(bg,0,0);
  // top: the app as it looks, cropped to the box from the top (the charts) or whole (the stage)
  const bw=W,bh=TOP[1]-TOP[0];let sw=st.width,sh=Math.min(st.height,sw*bh/bw);if(sh<sw*bh/bw)sw=sh*bw/bh;
  g.drawImage(st,(st.width-sw)/2,0,sw,sh,0,TOP[0],bw,bh);
  g.fillStyle='#2b3036';g.fillRect(0,TOP[0]-2,W,2);g.fillRect(0,TOP[1],W,2);
  // card: the shot's rows from the panel, stacked, with the app's own panel colour behind
  const U=M.lay.union,rows=M.lay.rows,cw=RIGHT-LEFT+60,gap=6;
  let k=cw/U.w,tot=rows.reduce((a,r)=>a+r.h,0)+gap*(rows.length-1);if(tot*k>CARD[1]-CARD[0])k=(CARD[1]-CARD[0])/tot;
  const x0=LEFT-30+(cw-U.w*k)/2;let y=CARD[0];const place=[];
  g.fillStyle='#1d2329';g.fillRect(x0-18,y-18,U.w*k+36,tot*k+36);
  for(const r of rows){const sx=(r.x-U.x)*2,sy=(r.y-U.y)*2;g.drawImage(pn,sx,sy,r.w*2,r.h*2,x0+(r.x-U.x)*k,y,r.w*k,r.h*k);place.push([r,y]);y+=(r.h+gap)*k;}
  g.strokeStyle=O;g.lineWidth=4;g.strokeRect(x0-18,CARD[0]-18,U.w*k+36,tot*k+36);
  // the cursor on the control that is moving
  const f=M.frames[n],c=f.cur,row=place.find(([r])=>c.y>=r.y-1&&c.y+c.h<=r.y+r.h+1);
  if(row){
    const [r,ry]=row,cx=f.frac!=null?c.x+8+f.frac*(c.w-16):c.x+c.w-26,cy=c.y+c.h/2;
    const prev=M.frames[Math.max(0,n-2)],moving=f.frac!=null?Math.abs(f.frac-prev.frac)>1e-4:JSON.stringify(f)!==JSON.stringify(prev);
    s._press=(s._press||0)+((moving?1:0)-(s._press||0))*.35;
    arrow(x0+(cx-U.x)*k,ry+(cy-r.y)*k,s._press);
  }
  header(s,t);
}

// ---------------- one frame ----------------
let bgSig='';
function paintBg(s){
  b.fillStyle=INK;b.fillRect(0,0,W,H);
  b.strokeStyle='#17191c';b.lineWidth=2;
  for(let x=60;x<W;x+=120){b.beginPath();b.moveTo(x,0);b.lineTo(x,H);b.stroke();}
  for(let y=0;y<H;y+=120){b.beginPath();b.moveTo(0,y);b.lineTo(W,y);b.stroke();}
  bgTex.needsUpdate=true;
}
async function draw(t){
  const s=shotAt(t);
  if(s.cap){if(s.k!==bgSig){bgSig=s.k;paintBg(s);}await drawCap(s,t);fade(t);return;}
  if(s.k!==bgSig){bgSig=s.k;paintBg(s);}
  if(s.k==='end'){g.globalAlpha=1;g.drawImage(bg,0,0);endFG(s,t);fade(t);return;}
  highlight(s);
  const inp=setup(t,s);
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
    g.fillStyle=gr;g.fillRect(0,0,W,520);header(s,t);fg(s,t,pz,inp);
  }
  fade(t);
}
function fade(t){if(t>DUR-.4){g.fillStyle=INK;g.globalAlpha=sm((t-(DUR-.4))/.4);g.fillRect(0,0,W,H);g.globalAlpha=1;}}

// a message-channel yield: unlike setTimeout it is not slowed to 1 s when the tab is in the background
const yieldNow=()=>new Promise(r=>{const c=new MessageChannel();c.port1.onmessage=()=>r();c.port2.postMessage(0);});
const put=async(name,blob)=>{await fetch('out/'+name,{method:'PUT',body:blob});return blob.size;};
window.VID={cv,SHOTS,DUR,progress:0,
  async init(){
    const L=m=>document.body.dataset.log=(document.body.dataset.log||'')+m+' | ';
    await new Promise(r=>{const w=setInterval(()=>{if(loaded&&model){clearInterval(w);r();}},100);});L('loaded');
    await document.fonts.load(FONT(100));L('fonts');
    logo=new Image();await new Promise((r,j)=>{logo.onload=r;logo.onerror=j;logo.src='logo.png';});L('logo');   // before look(): it stops the frame loop
    look();L('look');
    const R0=poseR(-Z.dzR,-Z.phi);rest0={clock:R0.cage[0].clock};
    for(const s of SHOTS)if(s.cap)META[s.k]=await (await fetch(`cap/${s.k}/meta.json`,{cache:'no-store'})).json();
    L('meta');return 'ready '+DUR+' s';},
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
    await put('release.mp4',new Blob([m.target.buffer],{type:'video/mp4'}));VID.done=true;return N;
  },
};
})();
