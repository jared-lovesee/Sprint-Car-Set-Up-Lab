// Four 9:16 story posts from the lab's own 3D: roll center adjustments, wheel offset, radius rod adjustments,
// front steering geometry. Title, short part callouts, logo + LINK IN BIO. Grounds alternate black / bone / orange.
// STORY.init(), STORY.render(i, name) -> out/<name>.png
(function(){
const W=1080,H=1920,SUB=24;
const O='#F2500F',BONE='#ECE6D8',INK='#0F1012',LG='#7A7D82',TG='#4A4C52';
const FONT=(px,w=700)=>`${w} ${px}px Bahnschrift, "Barlow Condensed", sans-serif`;
const LEAN=Math.tan(12*Math.PI/180),LEFT=64,RIGHT=W-64;
const PAL={
  k:{bg:INK,ink:BONE,hl:O,frame:'#d5d7d8',link:'#8f949b',uns:'#70757b',tyre:'#17181b',shadow:0,logo:'dark',grid:'#17191c'},
  b:{bg:BONE,ink:INK,hl:O,frame:'#15171a',link:'#6b6f75',uns:'#2a2d32',tyre:'#0b0b0c',shadow:.30,logo:'black',grid:'#e1dacb'},
  o:{bg:O,ink:INK,hl:BONE,frame:'#15171a',link:'#3a3d42',uns:'#23262b',tyre:'#060607',shadow:.40,logo:'black',grid:'#e8480c'},
};
const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');
const bg=document.createElement('canvas');bg.width=W;bg.height=H;const b=bg.getContext('2d');

// ---------------- type ----------------
function txt(c,s,x,y,font,color,align='left',sp=0){c.font=font;c.fontStretch='condensed';c.fillStyle=color;c.textAlign=align;c.letterSpacing=sp+'px';c.fillText(s,x,y);c.letterSpacing='0px';c.fontStretch='normal';}
function wOf(c,s,font,sp=0){c.font=font;c.fontStretch='condensed';c.letterSpacing=sp+'px';const w=c.measureText(s).width;c.letterSpacing='0px';c.fontStretch='normal';return w;}
const fitPx=(c,s,w,max,wt=700)=>Math.min(max,100*w/wOf(c,s,FONT(100,wt)));
function lean(c,s,x,y,px,color){c.save();c.translate(x,y);c.transform(1,0,-LEAN,1,0,0);txt(c,s,0,0,FONT(px),color);c.restore();}

// ---------------- the posts ----------------
// cam [az, el, dist, tx, ty, tz]; sh: px the picture is pushed up; title lines; hl: groups shown in the accent colour
const POSTS=[
  {name:'story_roll_centers',p:'k',title:['ROLL CENTER','ADJUSTMENTS'],hl:['ftb','ladT','ladU','ladL'],cam:[-58,14,520,0,0,18],sh:-40,
    set:()=>{},calls:'rc'},
  {name:'story_wheel_offset',p:'b',title:['WHEEL','OFFSET'],hl:['rtyreL','rtyreR'],cam:[200,9,330,-42,0,15],sh:-60,
    set:r=>{r.wheelL=-1;r.wheelR=1;},calls:'offset'},
  {name:'story_radius_rods',p:'o',title:['RADIUS ROD','ADJUSTMENTS'],hl:['frodRU','frodRL','frodLL','rrodL','rrodR'],cam:[-80,12,470,2,0,18],sh:-40,
    set:()=>{},calls:'rods'},
  {name:'story_steering',p:'k',title:['FRONT STEERING','GEOMETRY'],hl:['drag','tie','pitman'],cam:[28,30,380,34,4,14],sh:-60,steer:12,
    set:()=>{},calls:'steer'},
];

// ---------------- look ----------------
let bgTex,floor,stage3,fill,hemi,HLM,logos={};
function look(){
  window.requestAnimationFrame=()=>0;document.body.style.visibility='hidden';
  world.children.forEach(o=>{if(o.isLine||o.isArrowHelper||o.isMesh)o.visible=false;});grid.visible=false;
  renderer.setPixelRatio(1);renderer.setSize(W,H,false);cam.aspect=W/H;cam.fov=24;cam.updateProjectionMatrix();
  renderer.toneMapping=THREE.NoToneMapping;renderer.outputEncoding=THREE.sRGBEncoding;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  bgTex=new THREE.CanvasTexture(bg);bgTex.encoding=THREE.sRGBEncoding;scene.background=bgTex;
  floor=new THREE.Mesh(new THREE.PlaneGeometry(4000,4000),new THREE.ShadowMaterial({opacity:.35}));floor.receiveShadow=true;world.add(floor);
  sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);sun.shadow.bias=-0.0006;sun.shadow.normalBias=.05;
  const c=sun.shadow.camera;c.left=-120;c.right=120;c.top=120;c.bottom=-120;c.near=10;c.far=800;c.updateProjectionMatrix();
  sun.intensity=.62;scene.add(sun.target);sun.target.position.set(0,0,10);
  hemi=scene.children.find(o=>o.isHemisphereLight);hemi.intensity=.60;
  const rg=document.createElement('canvas');rg.width=rg.height=256;const rc=rg.getContext('2d'),gr=rc.createRadialGradient(128,128,20,128,128,128);
  gr.addColorStop(0,'#fff');gr.addColorStop(.55,'#888');gr.addColorStop(1,'#000');rc.fillStyle=gr;rc.fillRect(0,0,256,256);
  stage3=new THREE.Mesh(new THREE.PlaneGeometry(300,300),new THREE.MeshLambertMaterial({color:'#26282c',transparent:true,alphaMap:new THREE.CanvasTexture(rg)}));
  stage3.receiveShadow=true;stage3.position.z=.02;world.add(stage3);
  fill=new THREE.DirectionalLight(0xffffff,.22);fill.position.set(-200,160,120);scene.add(fill);
  carRoot.traverse(m=>{if(m.isMesh){m.castShadow=m.receiveShadow=true;if(!m.userData.base0)m.userData.base0=m.material;}});
  HLM=new THREE.MeshStandardMaterial({metalness:.2,roughness:.42});
  if(typeof wingDot!=='undefined')wingDot.visible=fwingDot.visible=false;
}
function paint(post){
  const p=PAL[post.p],on=new Set(post.hl);
  for(const m of matCache.values()){const t=m.userData.tint;
    if(t==='--steel'){m.color.set(p.frame);m.metalness=.25;m.roughness=.45;}
    else if(t==='--link')m.color.set(p.link);
    else if(t==='--unsprung')m.color.set(p.uns);
    else if(t==='#17191b')m.color.set(p.tyre);
  }
  HLM.color.set(p.hl);
  for(const [name,list] of Object.entries(G))for(const o of list)o.traverse(m=>{if(m.isMesh&&m.userData.base0)m.material=on.has(name)?HLM:m.userData.base0;});
  floor.material.opacity=p.shadow;floor.visible=p.shadow>0;stage3.visible=!floor.visible;
}

// ---------------- pose and camera ----------------
function build(post){
  const f=JSON.parse(JSON.stringify(FADJ0)),r=JSON.parse(JSON.stringify(RADJ0));post.set(r,f);
  fadj=f;radj=r;for(const id of ['g','gx','bank','wing','fwing'])$(id).value=0;buildAll();model=calc();
  world.rotation.x=0;world.updateMatrixWorld(true);
  const rr=model.rest,P=poseF(-rr.dzF,-rr.phi,post.steer||0),Rp=poseR(-rr.dzR,-rr.phi);
  bodyMatrix(B,rr.phi,rr.dzF,rr.dzR);B.premultiply(BSET);
  $('k-steer').value=post.steer||0;      // the pitman arm reads it when the parts are placed
  place(P,Rp,B);carRoot.matrix.identity();carRoot.matrixWorldNeedsUpdate=true;
  return {P,Rp};
}
let SH=0;
function aim(c,sh){const [az,el,d,tx,ty,tz]=c,A=az*Math.PI/180,E=el*Math.PI/180;
  cam.up.set(0,0,1);cam.position.set(tx+d*Math.cos(E)*Math.cos(A),ty+d*Math.cos(E)*Math.sin(A),tz+d*Math.sin(E));cam.lookAt(tx,ty,tz);cam.updateMatrixWorld(true);SH=sh;}
const _v=new THREE.Vector3();
function scr(p,bm){_v.set(p[0],p[1],p[2]);if(bm)_v.applyMatrix4(bm);_v.applyMatrix4(world.matrixWorld);_v.project(cam);return [(_v.x+1)/2*W,(1-_v.y)/2*H-SH];}

// ---------------- overlays ----------------
// a part callout: a dot on the real point, a line out to a label boxed like the logo's tolerance frame
function callout(p,pt,label,lx,ly){
  const [x,y]=pt,right=lx>W/2,h=72,font=FONT(h*.6,700),w=wOf(g,label,font,3)+2*h*.42,bx=right?lx-w:lx,ex=right?bx+w:bx;
  g.strokeStyle=p.ink;g.lineWidth=4;g.beginPath();g.moveTo(x,y);g.lineTo(right?bx+w/2:bx+w/2,ly+h/2);g.stroke();
  g.fillStyle=p.bg;g.fillRect(bx,ly,w,h);g.lineWidth=4;g.strokeStyle=p.ink;g.strokeRect(bx,ly,w,h);
  txt(g,label,bx+w/2,ly+h*.7,font,p.ink,'center',3);
  g.fillStyle=p.hl===BONE?INK:O;g.beginPath();g.arc(x,y,12,0,7);g.fill();g.lineWidth=5;g.strokeStyle=p.bg;g.stroke();
}
// each label goes as close under its own point as it can: same row first (centred, or beside a label already
// placed), then lower rows. A spot only counts if the label overlaps nothing, its leader runs through no other
// label, and no leader already drawn runs through it.
function segHitsBox(a,b,r){   // segment a-b against rect r=[x,y,w,h], with a little margin
  const [x,y,w,h]=[r[0]-6,r[1]-6,r[2]+12,r[3]+12],inside=p=>p[0]>x&&p[0]<x+w&&p[1]>y&&p[1]<y+h;
  if(inside(a)||inside(b))return true;
  const X=(p,q,c,d)=>{const o=(u,v,t)=>Math.sign((v[0]-u[0])*(t[1]-u[1])-(v[1]-u[1])*(t[0]-u[0]));return o(p,q,c)!==o(p,q,d)&&o(c,d,p)!==o(c,d,q);};
  const c=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];return [0,1,2,3].some(k=>X(a,b,c[k],c[(k+1)%4]));
}
window.PTS=[];
// one row of labels under the car, in the same left-to-right order as their points, each as close under its
// point as the row allows; the type shrinks only if they will not all fit. Leaders end on the box tops.
function labels(p,list){
  const items=list.map(([pt,label])=>({pt,label})).sort((a,b)=>a.pt[0]-b.pt[0]),gap=18,y=1250;
  let h=66,wd=()=>items.map(q=>wOf(g,q.label,FONT(h*.6,700),2)+2*h*.36);
  while(wd().reduce((s,w)=>s+w,0)+gap*(items.length-1)>RIGHT-LEFT&&h>44)h-=2;
  const ws=wd();items.forEach((q,i)=>{q.w=ws[i];q.x=q.pt[0]-q.w/2;});
  for(let i=0;i<items.length;i++)items[i].x=Math.max(items[i].x,LEFT,i?items[i-1].x+items[i-1].w+gap:LEFT);
  for(let i=items.length-1;i>=0;i--)items[i].x=Math.min(items[i].x,RIGHT-items[i].w,i<items.length-1?items[i+1].x-gap-items[i].w:RIGHT);
  for(const q of items){const ax=Math.max(q.x+16,Math.min(q.x+q.w-16,q.pt[0]));g.strokeStyle=p.ink;g.lineWidth=4;g.beginPath();g.moveTo(q.pt[0],q.pt[1]);g.lineTo(ax,y);g.stroke();}
  for(const q of items){g.fillStyle=p.bg;g.fillRect(q.x,y,q.w,h);g.strokeStyle=p.ink;g.lineWidth=4;g.strokeRect(q.x,y,q.w,h);txt(g,q.label,q.x+q.w/2,y+h*.7,FONT(h*.6,700),p.ink,'center',2);}
  for(const q of items){g.fillStyle=p.hl===BONE?INK:O;g.beginPath();g.arc(q.pt[0],q.pt[1],12,0,7);g.fill();g.lineWidth=5;g.strokeStyle=p.bg;g.stroke();}
}
function callouts(p,list,y0=1240,step=96){
  window.PTS.push(list.map(c=>[c[1],Math.round(c[0][0]),Math.round(c[0][1])]));
  const h=72,placed=[];
  for(const [pt,label] of list.slice().sort((a,b)=>a[0][1]-b[0][1])){
    const w=wOf(g,label,FONT(h*.6,700),3)+2*h*.42,clampX=x=>Math.max(LEFT,Math.min(RIGHT-w,x));
    let best=null;
    for(let row=0;row<6&&!best;row++){
      const by=Math.max(y0,pt[1]+110)+row*step,xs=[clampX(pt[0]-w/2)];
      for(const q of placed)xs.push(clampX(q.x-w-22),clampX(q.x+q.w+22));
      xs.sort((a,b)=>Math.abs(a+w/2-pt[0])-Math.abs(b+w/2-pt[0]));
      for(const bx of xs){
        const box=[bx,by,w,h],ax=Math.max(bx+18,Math.min(bx+w-18,pt[0])),lead=[pt,[ax,by]];
        if(placed.some(q=>bx<q.x+q.w+16&&bx+w+16>q.x&&by<q.y+h+14&&by+h+14>q.y))continue;
        if(placed.some(q=>segHitsBox(lead[0],lead[1],[q.x,q.y,q.w,h])))continue;
        if(placed.some(q=>segHitsBox(q.lead[0],q.lead[1],box)))continue;
        best={x:bx,y:by,w,pt,label,lead};break;
      }
    }
    if(!best){const bx=clampX(pt[0]-w/2),by=Math.max(y0,pt[1]+110)+6*step;best={x:bx,y:by,w,pt,label,lead:[pt,[bx+w/2,by]]};}
    placed.push(best);
  }
  for(const q of placed){
    g.strokeStyle=p.ink;g.lineWidth=4;g.beginPath();g.moveTo(q.lead[0][0],q.lead[0][1]);g.lineTo(q.lead[1][0],q.lead[1][1]);g.stroke();
    g.fillStyle=p.bg;g.fillRect(q.x,q.y,q.w,h);g.strokeRect(q.x,q.y,q.w,h);txt(g,q.label,q.x+q.w/2,q.y+h*.7,FONT(h*.6,700),p.ink,'center',3);
  }
  for(const q of placed){g.fillStyle=p.hl===BONE?INK:O;g.beginPath();g.arc(q.pt[0],q.pt[1],12,0,7);g.fill();g.lineWidth=5;g.strokeStyle=p.bg;g.stroke();}
}
function ring(p,pt){g.fillStyle=p.bg;g.strokeStyle=p.ink;g.lineWidth=6;g.beginPath();g.arc(pt[0],pt[1],24,0,7);g.fill();g.stroke();g.fillStyle=O;g.beginPath();g.arc(pt[0],pt[1],9,0,7);g.fill();}
function dash(a,c,col,lw=4,d=[18,12]){g.save();g.setLineDash(d);g.strokeStyle=col;g.lineWidth=lw;g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(c[0],c[1]);g.stroke();g.restore();}

function calls(post,p,q){
  const P=q.P,Rp=q.Rp,f=HP.front;
  if(post.calls==='rc'){
    const rc=SC.frontRC(P),ic=SC.ladderIC(Rp),F=scr([P.tb.a[0],0,rc.z],B),R=scr([Rp.lad.aUp[0],ic.y,ic.z],B),dx=F[0]-R[0],dy=F[1]-R[1];
    dash([R[0]-dx*.3,R[1]-dy*.3],[F[0]+dx*.3,F[1]+dy*.3],p.ink,4,[24,14]);
    const tb=scr(V.add(P.tb.a,V.mul(V.sub(P.tb.c,P.tb.a),.8)),B);   // well along the bar, clear of the front RC ring
    labels(p,[[scr(Rp.lad.pin,B),"JACOB'S LADDER",LEFT,0],[R,'REAR RC',440,0],[F,'FRONT RC',-1,0],[tb,'TRACK BAR',tb[0]<760?Math.max(LEFT,tb[0]-120):560,1]]);
    ring(p,F);ring(p,R);
  }else if(post.calls==='offset'){
    for(const [s,lab,lx] of [['L','LR OFFSET',LEFT],['R','RR OFFSET',RIGHT]]){
      const w=Rp.wheel[s].c,hub=HP.rear.wheel[s].c,face=[w[0],w[1]-(s==='L'?1:-1)*6,w[2]];
      callout(p,scr(face,B),lab,lx,1380);
    }
    const L=Rp.wheel.L.c,R=Rp.wheel.R.c,a=scr([L[0],L[1],1],B),c=scr([R[0],R[1],1],B),y=Math.max(a[1],c[1])+70;
    g.strokeStyle=p.ink;g.fillStyle=p.ink;g.lineWidth=4;g.beginPath();g.moveTo(a[0],y);g.lineTo(c[0],y);g.moveTo(a[0],y-26);g.lineTo(a[0],y+26);g.moveTo(c[0],y-26);g.lineTo(c[0],y+26);g.stroke();
    for(const [px,d] of [[a[0],1],[c[0],-1]]){g.beginPath();g.moveTo(px,y);g.lineTo(px+d*26,y-9);g.lineTo(px+d*26,y+9);g.closePath();g.fill();}
    const lab='REAR TRACK',fw=wOf(g,lab,FONT(40,700),4)+30;g.fillStyle=p.bg;g.fillRect((a[0]+c[0])/2-fw/2,y-28,fw,56);txt(g,lab,(a[0]+c[0])/2,y+14,FONT(40,700),p.ink,'center',4);
  }else if(post.calls==='rods'){
    const rod=n=>P.links[f.rods.findIndex(r=>r.name===n)];
    labels(p,[[scr(Rp.cage[1].rodA,B),'BIRDCAGE',LEFT,0],[scr(V.mid(Rp.cage[1].rodC,Rp.cage[1].rodA),B),'REAR TOP ROD',330,0],
      [scr(rod('RL').c,B),'LOWER ROD'],[scr(rod('RU').c,B),'UPPER ROD']]);
  }else if(post.calls==='steer'){
    for(const s of ['L','R']){const kp=P.kp[s];dash(scr(V.add(kp.p,V.mul(kp.dir,-14)),B),scr(V.add(kp.p,V.mul(kp.dir,10)),B),O,5,[16,10]);}
    const pts=[[scr(P.drag.i,B),'PITMAN ARM'],[scr(V.mid(P.drag.i,P.drag.o),B),'DRAG LINK'],[scr(V.mid(P.tie.L,P.tie.R),B),'TIE ROD'],
      [scr(V.add(P.kp.L.p,V.mul(P.kp.L.dir,8)),B),'KINGPIN']];
    labels(p,[[pts[2][0],'TIE ROD',300,0],[pts[3][0],'KINGPIN',520,0],[pts[0][0],'PITMAN ARM',-1,0],[pts[1][0],'DRAG LINK',560,1]]);
  }
}
function brand(p){
  const lg=logos[p.logo],lw=300,lh=lw*lg.height/lg.width,y=1600;
  g.drawImage(lg,LEFT,y,lw,lh);
  txt(g,'SPRINT CAR SETUP LAB',RIGHT,y+lh*.48,FONT(46,700),p.ink,'right',3);
  const lab='LINK IN BIO',h=58,f=FONT(h*.62,700),w=wOf(g,lab,f,6)+h*.9,col=p.bg===O?INK:O;
  g.fillStyle=col;g.fillRect(RIGHT-w,y+lh*.48+22,w,h);txt(g,lab,RIGHT-w/2,y+lh*.48+22+h*.72,f,p.bg===O?O:INK,'center',6);
}

// ---------------- one post ----------------
function render(i){
  const post=POSTS[i],p=PAL[post.p];paint(post);
  b.fillStyle=p.bg;b.fillRect(0,0,W,H);b.strokeStyle=p.grid;b.lineWidth=2;
  for(let x=60;x<W;x+=120){b.beginPath();b.moveTo(x,0);b.lineTo(x,H);b.stroke();}
  for(let y=0;y<H;y+=120){b.beginPath();b.moveTo(0,y);b.lineTo(W,y);b.stroke();}
  bgTex.needsUpdate=true;
  const q=build(post);aim(post.cam,post.sh);
  for(let k=0;k<SUB;k++){
    const ang=k*2.4,r=14*Math.sqrt((k+.5)/SUB);sun.position.set(110+r*Math.cos(ang),-90+r*Math.sin(ang),280);
    cam.setViewOffset(W,H,(k*.618%1)-.5,(k*.382%1)-.5+SH,W,H);renderer.render(scene,cam);
    g.globalAlpha=1/(k+1);g.drawImage(renderer.domElement,0,0);
  }
  g.globalAlpha=1;cam.clearViewOffset();
  // title over a band of the ground, so the cage can run up behind it
  const gr=g.createLinearGradient(0,0,0,640),c0=p.bg;gr.addColorStop(0,c0);gr.addColorStop(.78,c0);gr.addColorStop(1,c0+'00');g.fillStyle=gr;g.fillRect(0,0,W,640);
  const px=Math.min(...post.title.map(s=>fitPx(g,s,RIGHT-LEFT-30,190)));
  post.title.forEach((s,j)=>lean(g,s,LEFT+12,330+j*px*.98,px,j?(p.bg===O?BONE:O):p.ink));
  g.fillStyle=p.bg===O?INK:O;g.fillRect(LEFT,330+(post.title.length-1)*px*.98+36,160,12);
  calls(post,p,q);brand(p);
}
const put=async(name,blob)=>{await fetch('out/'+name,{method:'PUT',body:blob});return blob.size;};
const img=src=>new Promise((r,j)=>{const im=new Image();im.onload=()=>r(im);im.onerror=j;im.src=src;});
window.STORY={POSTS,
  async init(){await new Promise(r=>{const w=setInterval(()=>{if(loaded&&model){clearInterval(w);r();}},100);});
    await document.fonts.load(FONT(100));logos.dark=await img('logo_dark.png');logos.black=await img('logo_black.png');look();return 'ready';},
  async render(i,name){render(i);return put(name||POSTS[i].name+'.png',await new Promise(r=>cv.toBlob(r,'image/png')));},
};
})();
