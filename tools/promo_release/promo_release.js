// Release promo, 9:16, 40 s: "Sprint Car Setup Lab - beta release".
// Runs inside a copy of the lab page (director.html) and uses its globals, like promo_beta.js.
// Every number on screen comes from the live model or from frames of the real app (web/cap/, made by cap.js).
// VID.init(), then VID.frame(t) -> JPEG data URL. Sound cues: VID.CUES.
(function(){
const W=1080,H=1920,FPS=30,SUB=1,SHUTTER=0.5;
const BAND=[420,1040];   // the 3D viewport in the split scenes
const O='#F2500F',O2='#D9430A',BONE='#ECE6D8',INK='#0F1012',LG='#7A7D82',TG='#4A4C52';
const PAL={
  k:{bg:INK,ink:BONE,acc:O,dim:LG,frame:'#d5d7d8',link:O,uns:'#70757b',tyre:'#17181b',shadow:0},
  b:{bg:BONE,ink:INK,acc:O2,dim:LG,frame:'#15171a',link:O,uns:'#23262b',tyre:'#060607',shadow:.30},
  o:{bg:O,ink:INK,acc:BONE,dim:INK,frame:'#15171a',link:'#fff6e8',uns:'#23262b',tyre:'#060607',shadow:.40},
};
const F_=(px,w=700)=>`${w} ${px}px BC`;
const LEAN=Math.tan(12*Math.PI/180);
const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');
const bgc=document.createElement('canvas');bgc.width=W;bgc.height=H;const b=bgc.getContext('2d');
const {SCENES,key,ease}=TL;
const cl=(u)=>Math.max(0,Math.min(1,u));
const sm=u=>{u=cl(u);return u*u*(3-2*u);};
const out3=u=>1-Math.pow(1-cl(u),3);
const lerp=(a,b,u)=>a+(b-a)*u;
const LEFT=64,RIGHT=W-64,SAFE_R=W-140;   // Reels keeps the right edge for its buttons

// ---------------- type ----------------
function setF(c,font,sp=0){c.font=font;c.letterSpacing=sp+'px';}
function txt(c,s,x,y,font,color,align='left',sp=0){setF(c,font,sp);c.fillStyle=color;c.textAlign=align;c.fillText(s,x,y);c.letterSpacing='0px';}
function wOf(c,s,font,sp=0){setF(c,font,sp);const m=c.measureText(s).width;c.letterSpacing='0px';return m;}
// Bahnschrift-style headline: bold, all caps, leaning 12 degrees (only the lettering leans)
function lean(c,s,x,y,px,color,align='left',w=700){
  c.save();c.translate(x,y);c.transform(1,0,-LEAN,1,0,0);txt(c,s,0,0,F_(px,w),color,align);c.restore();
}
const fitPx=(c,s,w,max=400,wt=700)=>Math.min(max,100*w/wOf(c,s,F_(100,wt)));
// numbers that tick without jittering: fixed cells for digits, right aligned at x
function num(c,s,x,y,px,color,w=600){
  setF(c,F_(px,w));c.fillStyle=color;c.textAlign='right';const d=c.measureText('0').width;
  for(let i=s.length-1;i>=0;i--){const ch=s[i],cw=/[0-9]/.test(ch)?d:c.measureText(ch).width;c.fillText(ch,x,y);x-=cw;}
  return x;
}
const sgn=(v,n)=>(v>=0?'+':'−')+Math.abs(v).toFixed(n);
// a feature-control frame like the one in the logo: cells of text, first cell may hold the arc symbol
function fcfW(c,h,cells){const font=F_(h*.62,600);return cells.reduce((s,cel)=>s+(cel.icon?h*1.25:wOf(c,cel.t,font,h*.04)+2*h*.42),0);}
function fcf(c,x,y,h,cells,p,a=1){
  if(a<=0)return;
  c.save();c.globalAlpha=a;const pad=h*.42,font=F_(h*.62,600);let xx=x;
  const ws=cells.map(cel=>cel.icon?h*1.25:wOf(c,cel.t,font,h*.04)+2*pad);
  const tot=ws.reduce((s,v)=>s+v,0);
  c.lineWidth=Math.max(2,h*.045);c.strokeStyle=p.dim===INK?INK:LG;
  cells.forEach((cel,i)=>{
    const w=ws[i];
    if(cel.fill){c.fillStyle=cel.fill;c.fillRect(xx,y,w,h);}
    c.strokeRect(xx,y,w,h);
    if(cel.icon){c.strokeStyle=cel.color||p.ink;c.beginPath();c.arc(xx+w/2,y+h*.66,h*.28,Math.PI,0);c.closePath();c.stroke();c.strokeStyle=p.dim===INK?INK:LG;}
    else txt(c,cel.t,xx+w/2,y+h*.73,font,cel.color||p.ink,'center',h*.04);
    xx+=w;
  });
  c.restore();return tot;
}
// dimension line with arrowheads and extension lines, label in a gap
function dimLine(c,x0,x1,y,label,col,ink,u,font){
  if(u<=0)return;const cx=(x0+x1)/2,hw=(x1-x0)/2*out3(u);
  c.strokeStyle=col;c.fillStyle=col;c.lineWidth=3;
  const a=cx-hw,bb=cx+hw;
  c.beginPath();c.moveTo(x0,y-46);c.lineTo(x0,y+14);c.moveTo(x1,y-46);c.lineTo(x1,y+14);c.globalAlpha=sm(u*2);c.stroke();c.globalAlpha=1;
  const lw=label?wOf(c,label,font,4)+40:0;
  c.beginPath();c.moveTo(a,y);c.lineTo(Math.min(bb,cx-lw/2),y);c.moveTo(Math.max(a,cx+lw/2),y);c.lineTo(bb,y);c.stroke();
  for(const [px,dir] of [[a,1],[bb,-1]]){c.beginPath();c.moveTo(px,y);c.lineTo(px+dir*22,y-8);c.lineTo(px+dir*22,y+8);c.closePath();c.fill();}
  if(label&&u>.5){c.globalAlpha=sm((u-.5)*3);txt(c,label,cx,y+12,font,ink,'center',4);c.globalAlpha=1;}
}
function gridLines(c,p,a){
  if(a<=0)return;c.save();c.globalAlpha=a;c.strokeStyle=p.bg===INK?'#1c1e22':'#dcd5c4';c.lineWidth=2;
  for(let x=60;x<W;x+=120){c.beginPath();c.moveTo(x,0);c.lineTo(x,H);c.stroke();}
  for(let y=0;y<H;y+=120){c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke();}
  c.restore();
}
function dashDot(c,x0,y0,x1,y1,col,lw=2){c.save();c.setLineDash([36,10,6,10]);c.strokeStyle=col;c.lineWidth=lw;c.beginPath();c.moveTo(x0,y0);c.lineTo(x1,y1);c.stroke();c.restore();}
function brackets(c,x,y,w,h,col,len=34,lw=5){
  c.strokeStyle=col;c.lineWidth=lw;c.beginPath();
  for(const [px,py,dx,dy] of [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]]){c.moveTo(px+dx*len,py);c.lineTo(px,py);c.lineTo(px,py+dy*len);}
  c.stroke();
}
// a header block: headline that wipes on, one line under it
function head(c,p,t,t0,line,sub,y=318,px=null,col=null){
  const s=px||fitPx(c,line,RIGHT-LEFT-30,170);
  const u=out3((t-t0)/.45);
  c.save();c.beginPath();c.rect(0,y-s,LEFT+(RIGHT-LEFT+80)*u,s*1.25);c.clip();
  lean(c,line,LEFT+10,y,s,col||p.ink);c.restore();
  if(sub&&t>t0+.25){c.globalAlpha=sm((t-t0-.25)/.3);txt(c,sub,LEFT,y+64,F_(42,500),p.ink);c.globalAlpha=1;}
}

// ---------------- look ----------------
let bgTex,floor,stage3,fill,hemi;
function look(){
  window.requestAnimationFrame=()=>0;
  document.body.style.visibility='hidden';
  grid.visible=false;
  scene.children.forEach(o=>{if(o.isLine||o.isArrowHelper||(o.isMesh&&o!==floor))o.visible=false;});
  discs.forEach(d=>d.visible=false);
  renderer.setPixelRatio(1);renderer.setSize(W,H,false);cam.aspect=W/H;cam.fov=24;cam.updateProjectionMatrix();
  renderer.toneMapping=THREE.NoToneMapping;renderer.outputEncoding=THREE.sRGBEncoding;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  bgTex=new THREE.CanvasTexture(bgc);bgTex.encoding=THREE.sRGBEncoding;scene.background=bgTex;
  floor=new THREE.Mesh(new THREE.PlaneGeometry(4000,4000),new THREE.ShadowMaterial({opacity:.35}));floor.receiveShadow=true;scene.add(floor);
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-0.0006;sun.shadow.normalBias=.05;
  const c=sun.shadow.camera;c.left=-120;c.right=120;c.top=120;c.bottom=-120;c.near=10;c.far=800;c.updateProjectionMatrix();
  sun.intensity=.62;scene.add(sun.target);sun.target.position.set(0,0,10);
  hemi=scene.children.find(o=>o.isHemisphereLight);if(hemi)hemi.intensity=.60;
  const rg=document.createElement('canvas');rg.width=rg.height=256;const rc=rg.getContext('2d'),gr=rc.createRadialGradient(128,128,20,128,128,128);
  gr.addColorStop(0,'#fff');gr.addColorStop(.55,'#888');gr.addColorStop(1,'#000');rc.fillStyle=gr;rc.fillRect(0,0,256,256);
  stage3=new THREE.Mesh(new THREE.PlaneGeometry(290,290),new THREE.MeshLambertMaterial({color:'#24262a',transparent:true,alphaMap:new THREE.CanvasTexture(rg)}));
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
const bandBg=new THREE.Color();
let ghostM=null;
function ghost(a){   // a = 1: LR tyre see-through (cutaway), 0: solid
  if(!ghostM){ghostM=new Map();for(const o of G.rtyreL||[])o.traverse(m=>{if(m.isMesh){if(!ghostM.has(m.material)){const c=m.material.clone();c.transparent=true;matCache.set('ghost'+ghostM.size,c);ghostM.set(m.material,c);}m.material=ghostM.get(m.material);}});}
  for(const m of ghostM.values()){m.opacity=1-.88*a;m.depthWrite=a<.5;}
}
let lastSig='';
function setup(t){
  const d=TL.drag(t),r=TL.rod(t),sig=d+'|'+r;
  if(sig!==lastSig){lastSig=sig;fadj.dragLen=d;radj.rodLen=[r,0];buildAll();model=calc();}
  return {d,r};
}
const wave=(t,per,ph=0)=>Math.sin(2*Math.PI*(t/per+ph));
function attitude(t,s){
  const o={h:0,roll:0,pitch:0,steer:0,drop:0},e=sm((t-s.t0)/.4)*sm((s.t1-t)/.4);
  if(s.k==='open'){
    const u=t-.3;
    if(u<.5){o.drop=u<0?400:120*(1-(u/.5)*(u/.5));o.h=2.2;}
    else{const v=u-.5;o.h=2.2*Math.exp(-2.6*v)*Math.cos(11*v);o.pitch=.9*Math.exp(-2.2*v)*Math.sin(11*v);}
    o.steer=key(t,[[1.8,0],[2.3,-14],[3.1,-14],[3.7,0]]);
  }else if(s.k==='cad'){
    o.h=1.2*e*wave(t,2);o.roll=2.6*e*wave(t,4);o.pitch=.8*e*wave(t,4,.25);o.steer=12*e*wave(t,4);
  }else if(s.k==='beta'){
    const u=t-32;o.h=1.3*Math.exp(-2.4*u)*Math.cos(11*u);o.steer=key(t,[[32.8,0],[33.5,16]]);
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

// ---------------- cameras: per scene, [t, azimuth, elevation, distance, tx, ty, tz, screen shift px] ----------------
const CAMS={
  open:[[0,-24,5,560,-2,0,24,-120],[4,-40,9,530,-2,0,24,-120]],
  cad:[[4,-34,8,500,6,0,28,-60],[6.1,-58,10,500,4,0,28,-60],[7.5,-150,12,470,-12,0,28,-60],[9,-166,12,470,-14,0,26,-60]],
  drag:[[16,26,30,400,36,4,10,230],[24,40,34,370,36,4,10,230]],
  rear:[[24,92,4,230,-44,22,15,230],[27.6,98,6,220,-44,22,15,230],[28.6,174,70,440,-40,0,6,230],[32,180,74,420,-40,0,6,230]],
  beta:[[32,-200,7,540,0,0,24,30],[36,-232,9,520,0,0,24,30]],
};
let SHIFT=0;
function camAt(t,K){
  let i=K.findIndex(k=>k[0]>t);if(i<1)i=i<0?K.length-1:1;
  const Q=j=>K[Math.max(0,Math.min(K.length-1,j))],p0=Q(i-2),p1=Q(i-1),p2=Q(i),p3=Q(i+1);
  const d1=p2[0]-p1[0],u=cl((t-p1[0])/(d1||1)),o=[];
  for(let n=1;n<8;n++){
    const m1=(p2[n]-p0[n])/((p2[0]-p0[0])||1)*d1,m2=(p3[n]-p1[n])/((p3[0]-p1[0])||1)*d1,u2=u*u,u3=u2*u;
    o.push((2*u3-3*u2+1)*p1[n]+(u3-2*u2+u)*m1+(-2*u3+3*u2)*p2[n]+(u3-u2)*m2);
  }
  const [az,el,d,tx,ty,tz,sh]=o,A=az*Math.PI/180,E=el*Math.PI/180;
  cam.up.set(0,0,1);cam.position.set(tx+d*Math.cos(E)*Math.cos(A),ty+d*Math.cos(E)*Math.sin(A),tz+d*Math.sin(E));
  cam.lookAt(tx,ty,tz);SHIFT=sh;cam.updateMatrixWorld(true);
}
const _v=new THREE.Vector3();
// screen point of a chassis-frame point (with the body matrix) or a world point
function scr(p,bm){_v.set(p[0],p[1],p[2]);if(bm)_v.applyMatrix4(bm);_v.project(cam);return [(_v.x+1)/2*W,(1-_v.y)/2*H-SHIFT];}

// ---------------- overlays ----------------
function callout(p,pt,label,lx,ly,a,val){
  if(a<=0)return;
  const [x,y]=pt,right=lx>W/2,dr=out3(a*2.2),ex=right?lx-24:lx+24;
  g.save();g.globalAlpha=Math.min(1,a*3);
  g.strokeStyle=p.ink;g.lineWidth=3;g.beginPath();g.moveTo(x,y);
  const mx=x+(ex-x)*dr,my=y+(ly-y)*dr;g.lineTo(mx,my);g.stroke();
  g.fillStyle=p.acc===BONE?INK:O;g.beginPath();g.arc(x,y,10,0,7);g.fill();g.lineWidth=4;g.strokeStyle=p.bg;g.stroke();
  if(a>.3){
    const cells=[{t:label}];if(val)cells.push({t:val,color:p.acc});
    const h=58,font=F_(h*.62,600);let w=cells.reduce((s,c)=>s+wOf(g,c.t,font,h*.04)+2*h*.42,0);
    const bx=right?lx-w:lx;g.fillStyle=p.bg;g.fillRect(bx,ly-h/2,w,h);
    fcf(g,bx,ly-h/2,h,cells,p,sm((a-.3)*4));
  }
  g.restore();
}
function cadFG(p,t,q){
  const f=HP.front,P=q.P,Rp=q.Rp;
  const list=[[4.5,6.4,V.mid(P.T(f.kingpin.L.p),P.T(f.kingpin.R.p)),'BEAM AXLE',LEFT,1330],
    [4.9,6.4,V.mid(P.links[0].a,P.links[0].c),'RADIUS RODS',SAFE_R,1250],
    [5.4,6.4,V.mid(P.drag.i,P.drag.o),'DRAG LINK',SAFE_R,1420],
    [7.4,9,Rp.cage[1].barArm,'TORSION ARMS',LEFT,1330],
    [7.8,9,Rp.cage[1].rodA,'BIRDCAGES',SAFE_R,1250],
    [8.1,9,Rp.lad.pin,'JACOBS LADDER',SAFE_R,1420]];
  for(const [t0,t1,pt,lab,lx,ly] of list)callout(p,scr(pt,B),lab,lx,ly,Math.min((t-t0)/.33,1)*(t<t1?1:0));
}

// ---- real-app frames (cap.js) ----
const capCache={};
async function capImg(k,t,t0){
  const n=Math.max(0,Math.round((t-t0)*FPS)),name=`cap/${k}/${String(n).padStart(4,'0')}.jpg`;
  if(capCache.k!==name){const im=new Image();im.src=name;await im.decode();capCache.k=name;capCache.im=im;}
  return capCache.im;
}
// draw strips of a capture (css px of the clip; the image is at 2x) into a card, stacked
function strips(img,list,x,y,w,p,gap=14){
  const sc=w/list[0][2];let yy=y;const rects=[];
  for(const [sx,sy,sw,sh,hl] of list){
    const dh=sh*sc;g.drawImage(img,sx*2,sy*2,sw*2,sh*2,x,yy,w,dh);rects.push([x,yy,w,dh,hl]);yy+=dh+gap;
  }
  return {rects,h:yy-gap-y};
}
function cardFrame(x,y,w,h,p){
  g.fillStyle='#1d2329';g.fillRect(x-18,y-18,w+36,h+36);
  brackets(g,x-30,y-30,w+60,h+60,O,40,5);
}
function hlRect(r,a,col=O){if(a<=0)return;g.save();g.globalAlpha=a;g.strokeStyle=col;g.lineWidth=5;g.strokeRect(r[0]-6,r[1]-2,r[2]+12,r[3]+4);g.restore();}

// ---- kinematics page: the real app, pushed into ----
// source rect in app css px [x, y, w]; screen box [x, y, w, h]
const KCAM=[[9,0,0,1600,900, 64,724,952,536],[10.7,0,0,1600,900, 64,724,952,536],
  [11.5,20,250,600,640, 64,520,952,1015],[12.9,20,250,600,640, 64,520,952,1015],
  [13.7,1212,556,370,330, 64,520,952,849],[16,1212,556,370,330, 64,520,952,849]];
function kcam(t){
  let i=KCAM.findIndex(k=>k[0]>t);if(i<1)i=i<0?KCAM.length-1:1;
  const a=KCAM[i-1],c=KCAM[i],u=ease(cl((t-a[0])/(c[0]-a[0])));return a.map((v,j)=>lerp(v,c[j],u));
}
async function kinFG(p,t){
  const s=SCENES[2];
  head(g,p,t,s.t0+.05,'THE KINEMATICS PAGE','Heave it. Roll it. Every number answers.',318);
  const img=await capImg('kin',t,s.t0),[,sx,sy,sw,sh,bx,by,bw,bh]=kcam(t);
  // keep the source rect the same shape as the box
  const ar=bh/bw;let w=sw,h=sw*ar;if(h<sh){h=sh;w=sh/ar;}
  const cx=sx+sw/2,cy=sy+sh/2;let x0=Math.max(0,Math.min(1600-w,cx-w/2)),y0=Math.max(0,Math.min(900-h,cy-h/2));
  if(w>1600){w=1600;h=w*ar;x0=0;y0=Math.max(0,(900-h)/2);}
  const u=out3((t-s.t0-.15)/.5);
  g.save();g.globalAlpha=u;
  g.fillStyle='#15191d';g.fillRect(bx,by,bw,bh);
  g.drawImage(img,x0*2,y0*2,w*2,h*2,bx,by,bw,bh);
  brackets(g,bx-16,by-16,bw+32,bh+32,O,44,5);
  g.restore();
  const sc=bw/w,map=(rx,ry,rw,rh)=>[bx+(rx-x0)*sc,by+(ry-y0)*sc,rw*sc,rh*sc];
  // what to look at: the stats bar, then the toe and camber rows
  hlRect(map(24,818,590,60),sm((t-11.6)/.3)*sm((12.9-t)/.2));
  hlRect(map(1216,648,352,50),sm((t-13.9)/.3));
  hlRect(map(1216,792,352,48),sm((t-14.4)/.3));
  // label under the box
  txt(g,'KINEMATICS  →  FRONT',bx,by+bh+70,F_(34,600),LG,'left',3);
}

// ---- drag link scene ----
// clip origin css (1205,180); rows measured off the capture
const DRAG_STRIPS=[[8,122,364,26,0],[8,148,364,26,1],[8,174,364,26,0],[8,592,364,46,0],[8,708,364,48,1]];
async function dragFG(p,t,q,st){
  const s=SCENES[3];
  head(g,p,t,s.t0+.05,'TRIM THE DRAG LINK','Aim the front end. The table reads it back.',318);
  // the drag link itself: a dimension along it with its live length
  const P=q.P,a=scr(P.drag.i,B),o=scr(P.drag.o,B),u=sm((t-s.t0-.5)/.4);
  if(u>0){
    const L=F.Ldrag,mid=[(a[0]+o[0])/2,(a[1]+o[1])/2];
    callout(p,mid,'DRAG LINK',SAFE_R,BAND[1]-50,u,L.toFixed(3)+' IN');
  }
  // the wheels' aim, from the solved pose
  const toe=s2=>SC.angles(P.wheel[s2],s2==='L'?1:-1).toe,aim=(toe('L')-toe('R'))/2;
  const sy=BAND[1]+86;
  if(t>s.t0+.6){
    g.globalAlpha=sm((t-s.t0-.6)/.3);
    txt(g,'FRONT WHEELS AIM',LEFT,sy-6,F_(38,600),p.ink,'left',3);
    const v=Math.abs(aim)<.05?'STRAIGHT':Math.abs(aim).toFixed(1)+'° '+(aim>0?'LEFT':'RIGHT');
    txt(g,v,RIGHT,sy,F_(74,700),p.acc,'right');
    g.globalAlpha=1;
  }
  const img=await capImg('drag',t,s.t0),x=LEFT+70,w=RIGHT-LEFT-140,y=1170;
  const ua=out3((t-s.t0-.35)/.45);g.save();g.globalAlpha=ua;
  g.fillStyle='#1d2329';const r=strips(img,DRAG_STRIPS,x,y,w,p,0);
  cardFrame(x,y,w,r.h,p);strips(img,DRAG_STRIPS,x,y,w,p,0);
  r.rects.forEach((rr,i)=>{if(rr[4])hlRect(rr,sm((t-s.t0-.9-i*.25)/.3));});
  g.restore();
}

// ---- rear radius rod scene ----
const REAR_STRIPS=[[8,200,364,52,1],[8,569,364,50,1],[8,881,364,50,1]];
async function rearFG(p,t,q,st){
  const s=SCENES[4],Rp=q.Rp;
  head(g,p,t,s.t0+.05,'SET THE REAR RADIUS RODS','Turn the LR rod end. The cage clocks, the rear steers.',318);
  const side=sm((27.9-t)/.4),top=sm((t-28.7)/.4);
  g.save();g.beginPath();g.rect(0,BAND[0],W,BAND[1]-BAND[0]);g.clip();
  if(side>0){
    // birdcage clocking: torsion arm mount up to the rod mount, against vertical
    const c=Rp.cage[0],A=scr(c.barArm,B),R_=scr(c.rodA,B),len=Math.hypot(R_[0]-A[0],R_[1]-A[1])*1.25;
    g.save();g.globalAlpha=side*sm((t-s.t0-.5)/.3);
    g.setLineDash([14,10]);g.strokeStyle=LG;g.lineWidth=3;g.beginPath();g.moveTo(A[0],A[1]);g.lineTo(A[0],A[1]-len);g.stroke();g.setLineDash([]);
    const ang=Math.atan2(R_[0]-A[0],A[1]-R_[1]);
    g.strokeStyle=O;g.lineWidth=7;g.beginPath();g.moveTo(A[0],A[1]);g.lineTo(A[0]+Math.sin(ang)*len,A[1]-Math.cos(ang)*len);g.stroke();
    g.lineWidth=3;g.beginPath();g.arc(A[0],A[1],len*.62,-Math.PI/2,-Math.PI/2+ang,ang<0);g.stroke();
    for(const P_ of [A,R_]){g.fillStyle=O;g.beginPath();g.arc(P_[0],P_[1],9,0,7);g.fill();}
    g.restore();
    callout(p,[A[0]+Math.sin(ang)*len*.62,A[1]-Math.cos(ang)*len*.62],'LR CLOCKING',LEFT,BAND[1]-50,side*sm((t-s.t0-.7)/.3),sgn(c.clock,1)+'°');
  }
  if(top>0){
    // rear steer: the axle line against square to the chassis centreline
    const L=Rp.wheel.L.c,Rr=Rp.wheel.R.c,m=V.mid(L,Rr),dx=Rr[0]-L[0],dy=Rr[1]-L[1],n=Math.hypot(dx,dy),k=1.9;
    const a0=scr([m[0]-dx/n*n*k/2,m[1]-dy/n*n*k/2,m[2]],B),a1=scr([m[0]+dx/n*n*k/2,m[1]+dy/n*n*k/2,m[2]],B);
    const s0=scr([m[0],m[1]+n*k/2,m[2]],B),s1=scr([m[0],m[1]-n*k/2,m[2]],B),c0=scr([m[0]+60,0,m[2]],B),c1=scr([m[0]-40,0,m[2]],B);
    g.save();g.globalAlpha=top;
    dashDot(g,c0[0],c0[1],c1[0],c1[1],LG,3);
    g.setLineDash([14,10]);g.strokeStyle=LG;g.lineWidth=3;g.beginPath();g.moveTo(s0[0],s0[1]);g.lineTo(s1[0],s1[1]);g.stroke();g.setLineDash([]);
    g.strokeStyle=O;g.lineWidth=6;g.beginPath();g.moveTo(a0[0],a0[1]);g.lineTo(a1[0],a1[1]);g.stroke();
    g.restore();
    callout(p,a0,'REAR STEER',LEFT,BAND[1]-50,top,sgn(SC.rearSteer(Rp),2)+'°');
  }
  g.restore();
  const img=await capImg('rear',t,s.t0),x=LEFT+70,w=RIGHT-LEFT-140,y=1170;
  const ua=out3((t-s.t0-.35)/.45);g.save();g.globalAlpha=ua;
  g.fillStyle='#1d2329';const r=strips(img,REAR_STRIPS,x,y,w,p,0);
  cardFrame(x,y,w,r.h,p);strips(img,REAR_STRIPS,x,y,w,p,0);
  r.rects.forEach((rr,i)=>{if(rr[4])hlRect(rr,sm((t-s.t0-.9-i*.25)/.3));});
  g.restore();
}

// ---- opening, beta, end ----
function openFG(p,t){
  head(g,p,t,.9,'SPRINT CAR',null,420,fitPx(g,'SPRINT CAR',RIGHT-LEFT-30,240),BONE);
  head(g,p,t,1.15,'SETUP LAB',null,640,fitPx(g,'SPRINT CAR',RIGHT-LEFT-30,240),O);
  dimLine(g,150,930,1330,'SHORT TRACK CAD',O,BONE,(t-.5)/.7,F_(40,600));
  const a=sm((t-2.0)/.3);
  if(a>0){const cells=[{icon:1,color:O},{t:'BETA RELEASE',color:O},{t:'NOV 06 2026'}],h=72;
    fcf(g,(W-fcfW(g,h,cells))/2,1420,h,cells,p,a);}
}
function betaFG(p,t){
  const s=SCENES[5];
  head(g,p,t,s.t0+.05,'BETA RELEASE',null,400,null,INK);
  const lines=['Sprint Car Setup Lab is still in beta.','Some things are subject to change','in future updates.'];
  lines.forEach((l,i)=>{const a=sm((t-s.t0-.5-i*.12)/.3);if(a>0){g.globalAlpha=a;txt(g,l,LEFT,1300+i*64,F_(54,500),INK);g.globalAlpha=1;}});
  const a=sm((t-s.t0-.9)/.3);
  if(a>0)fcf(g,LEFT,1500,64,[{icon:1,color:INK},{t:'BETA',fill:INK,color:O},{t:'SUBJECT TO CHANGE',color:INK}],p,a);
}
let logo=null;
function endFG(p,t){
  const s=SCENES[6];gridLines(g,p,.5);
  const lw=900,lh=lw*logo.height/logo.width,lx=(W-lw)/2,ly=420,u=out3((t-s.t0-.05)/.6);
  g.save();g.beginPath();g.rect(lx-20,ly-20,(lw+40)*u,lh+40);g.clip();g.drawImage(logo,lx,ly,lw,lh);g.restore();
  const a=k=>sm((t-s.t0-.55-k*.15)/.3);
  g.globalAlpha=a(0);txt(g,'SPRINT CAR SETUP LAB',W/2,ly+lh+150,F_(78,700),BONE,'center',6);
  g.globalAlpha=a(1);txt(g,'BETA RELEASE  ·  FRIDAY, NOV 6',W/2,ly+lh+240,F_(52,600),O,'center',3);
  g.globalAlpha=a(2);txt(g,'LINK IN BIO',W/2,ly+lh+330,F_(38,600),LG,'center',8);
  g.globalAlpha=1;
}
// corner tag, so the beta never goes unsaid
function tag(p,t){
  const s=TL.sceneAt(t);if(s.k==='end'||s.k==='beta'||t<.6)return;
  fcf(g,LEFT,150,46,[{t:'SPRINT CAR SETUP LAB',color:p.ink},{t:'BETA',fill:O,color:INK}],p,sm((t-.6)/.3));
}
// a leaning panel that sweeps across each cut
function wipe(t){
  for(const s of SCENES.slice(1)){
    const u=(t-(s.t0-.22))/.44;if(u<=0||u>=1)continue;
    const into=s.p==='o'||TL.sceneAt(s.t0-.01).p==='o',col=into?INK:O,x=lerp(-W*1.6,W*1.3,ease(u)),sk=H*LEAN;
    g.fillStyle=col;g.beginPath();g.moveTo(x,H);g.lineTo(x+sk,0);g.lineTo(x+sk+W*1.1,0);g.lineTo(x+W*1.1,H);g.closePath();g.fill();
  }
}

// ---------------- one frame ----------------
const THREED=new Set(['open','cad','drag','rear','beta']);
async function draw(t){
  const s=TL.sceneAt(t),p=PAL[s.p],st=setup(t);
  g.globalAlpha=1;g.setLineDash([]);
  let q=null;
  if(THREED.has(s.k)){
    paint(p);
    const band=s.k==='drag'||s.k==='rear';
    if(band){
      g.fillStyle=p.bg;g.fillRect(0,0,W,H);gridLines(g,p,.6);
      scene.background=bandBg.set(p.bg==='#ECE6D8'?'#e4ddcc':'#16181b');
    }else{
      b.fillStyle=p.bg;b.fillRect(0,0,W,H);gridLines(b,p,s.k==='open'?sm(t/.6)*.8:.6);
      if(s.k==='open'){const u=sm((t-.2)/.6);b.globalAlpha=u;dashDot(b,W/2,560,W/2,1500,TG,2);b.globalAlpha=1;}
      bgTex.needsUpdate=true;scene.background=bgTex;
    }
    ghost(s.k==='rear'?1-sm((t-27.7)/.6):0);
    const K=CAMS[s.k],y0=band?BAND[0]:0,h=band?BAND[1]-BAND[0]:H;
    if(renderer.domElement.height!==h)renderer.setSize(W,h,false);
    camAt(t,K);q=poseCar(attitude(t,s));
    sun.position.set(110,-90,280);
    cam.setViewOffset(W,H,0,y0+SHIFT,W,h);
    renderer.render(scene,cam);
    g.drawImage(renderer.domElement,0,y0);
    cam.clearViewOffset();
    if(band){g.strokeStyle=p.bg===INK?'#2a2d32':'#cfc7b4';g.lineWidth=2;g.strokeRect(1,y0,W-2,h);brackets(g,LEFT-24,y0+18,W-2*LEFT+48,h-36,O,40,5);}
  }else{
    g.fillStyle=p.bg;g.fillRect(0,0,W,H);
  }
  if(s.k==='open')openFG(p,t);
  else if(s.k==='cad'){head(g,p,t,s.t0+.05,'EVERY LINK SOLVED','A full 3D sprint car, built from CAD.',318);cadFG(p,t,q);}
  else if(s.k==='kin'){gridLines(g,p,.6);await kinFG(p,t);}
  else if(s.k==='drag')await dragFG(p,t,q,st);
  else if(s.k==='rear')await rearFG(p,t,q,st);
  else if(s.k==='beta')betaFG(p,t);
  else endFG(p,t);
  tag(p,t);
  wipe(t);
  if(t>TL.DUR-.35){g.fillStyle=INK;g.globalAlpha=sm((t-(TL.DUR-.35))/.35);g.fillRect(0,0,W,H);g.globalAlpha=1;}
}

// ---------------- sound cues, on the same clock ----------------
const CUES=[['land',.8],['tick',1.6],['tick',2.0],['steer',1.9],
  ...SCENES.slice(1).map(s=>['whoosh',s.t0-.22]),
  ...[4.5,4.9,5.4,7.4,7.8,8.1].map(t=>['tick',t]),
  ['tick',11.6],['tick',13.9],
  ['ratchet',16.9],['ratchet',19.4],['ratchet',22.0],
  ['ratchet',24.9],['ratchet',28.8],
  ['clunk',32.0],['hit',36.05]];

window.VID={cv,CUES,W,H,
  async init(){
    await new Promise(r=>{const w=setInterval(()=>{if(loaded&&model){clearInterval(w);r();}},100);});
    await Promise.all([500,600,700].map(w=>document.fonts.load(F_(100,w))));
    logo=new Image();logo.src='brand/primary.png';await logo.decode();
    look();return 'ready';
  },
  async frame(t,q=.92){await draw(t);return cv.toDataURL('image/jpeg',q);},
};
})();
