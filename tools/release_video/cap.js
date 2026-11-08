// Films the real Sprint Car Setup Lab, one shot at a time, frame by frame.
// Each frame: the slider is set and its own input/change event fired (the same path a mouse drag takes),
// the app draws one frame, and two clips are saved: the 3D stage and the panel rows for the card.
// node cap.js probe           -> probe/<shot>.jpg, one full-window still per shot (for framing)
// node cap.js run [shot ...]  -> ../release/cap/<shot>/s_NNNN.jpg, p_NNNN.jpg, meta.json
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const [mode,...only]=process.argv.slice(2);
const URL='http://localhost:8770/index.html',OUT=path.join(__dirname,'..','release','cap'),FPS=30,SHOT=5;

// the shots, in order; u is seconds into the shot
// tab: setup | front | rear | dyn; cam: [[az, el, dist, tx, ty, tz] at u=0, ... at u=5]
// set(u) -> {id: value}; rows: selectors whose .row / tr / table goes on the card; cur: control under the cursor
const SHOTS=[
  {k:'bars',tab:'setup',cam:[[-40,20,235,30,0,14],[-52,22,225,30,0,14]],
    set:u=>({dlf:q(.95+AB(u,.075,-.075),.005)}),rows:['#dlf','#rate-tab'],cur:'dlf'},
  {k:'caster',tab:'front',cam:[[84,6,150,42,27,22],[94,8,142,42,27,22]],
    set:u=>({'k-cas-l':q(AB(u,3,-3),.25)}),rows:['#k-cas-l','#k-cas-r','tr:Caster'],cur:'k-cas-l'},
  {k:'camber',tab:'front',cam:[[10,4,150,42,24,22],[0,5,144,42,24,22]],
    set:u=>({'k-cam-l':q(AB(u,2,-2),.25)}),rows:['#k-cam-l','#k-cam-r','tr:Camber to ground'],cur:'k-cam-l'},
  {k:'rods',tab:'rear',cam:[[176,74,244,-38,0,8],[186,76,237,-38,0,8]],
    set:u=>({'r-lt-l':q(AB(u,1.5,-1.5),1/16)}),rows:['#r-lt-l','#r-rt-l','tr:Rear steer'],cur:'r-lt-l'},
  {k:'holes',tab:'front',cam:[[-84,8,200,30,-18,24],[-96,10,192,30,-18,24]],
    set:u=>({'k-ru-c':q(AB(u,2,-2),1/16)}),rows:['#k-ru-c','#k-ru-a','tr:Caster'],cur:'k-ru-c'},
  {k:'clock',tab:'rear',cam:[[148,30,170,-44,22,22],[158,32,162,-44,22,22]],
    set:(u,b)=>({'r-clk-l':q(b.clk+AB(u,8-b.clk,-8-b.clk),.1)}),rows:['#r-clk-l','#r-clk-r','#r-lt-l'],cur:'r-clk-l'},
  {k:'ladder',tab:'rear',cam:[[186,10,144,-44,0,23],[178,12,139,-44,0,23]],
    set:u=>({'r-clev':u<1.4?'0':u<2.9?'0.625':'-0.625'}),rows:['#r-lad','#r-strap','#r-clev','tr:Rear RC height'],cur:'r-clev'},
  {k:'tbar',tab:'front',cam:[[-6,8,152,42,0,24],[6,9,147,42,0,24]],
    set:u=>({'k-tb-a':q(AB(u,3,-3),.125)}),rows:['#k-tb-a','#k-tb-c'],cur:'k-tb-a'},
  {k:'bump',tab:'front',cam:[[-30,26,222,30,-4,20],[-42,30,215,30,-4,20]],
    set:u=>({'k-phole':q(AB(u,2,-2),1/16),'k-heave':(1.6*Math.sin(2*Math.PI*u/1.6)*sm(u/.4)).toFixed(2)}),rows:['#k-phole','#k-heave'],cur:'k-phole'},
  {k:'stag',tab:'setup',cam:[[145,10,185,-42,0,16],[138,11,179,-42,0,16]],
    set:u=>({stg:q(4+AB(u,4,8),.25)}),rows:['#rad','#stg'],cur:'stg'},
  {k:'ride',tab:'setup',cam:[[-40,6,244,0,0,18],[-48,7,238,0,0,18]],
    set:u=>({rnrr:Math.round(AB(u,4,-4))}),rows:['#rnrr','#rh-now'],cur:'rnrr'},
  {k:'lat',tab:'setup',cam:[[-4,12,244,0,0,18],[4,13,238,0,0,18]],
    set:u=>({g:q(AB(u,.8,1.4),.01),gx:0,bank:0,wing:0}),rows:['#g','#gx','#bank'],cur:'g'},
  {k:'long',tab:'setup',cam:[[-88,8,252,0,0,18],[-94,9,246,0,0,18]],
    set:u=>({g:0,gx:q(AB(u,-1,.8),.01),bank:0,wing:0}),rows:['#g','#gx','#bank'],cur:'gx'},
  {k:'bank',tab:'setup',cam:[[-2,8,244,0,0,18],[2,9,238,0,0,18]],
    set:u=>({g:1.15,gx:0,bank:q(AB(u,10,20),.5),wing:0}),rows:['#g','#gx','#bank'],cur:'bank'},
  {k:'wing',tab:'setup',cam:[[-40,16,244,0,0,18],[-48,17,238,0,0,18]],
    set:u=>({g:1.15,gx:0,bank:0,wing:q(1200*sm((u-1)/1.6),25)}),rows:['#wing','#wingr'],cur:'wing'},
  {k:'kin',tab:'dyn',cam:[[-36,10,480,0,0,20],[-44,11,470,0,0,20]],
    set:u=>{const w=(a,t0,t1)=>a*sm((u-t0)/.2)*sm((t1-u)/.2)*Math.sin(2*Math.PI*(u-t0)/1.6);
      return {'d-x':u<1.65?'heave':u<3.25?'roll':'pitch','d-heave':w(2.4,0,1.8).toFixed(2),'d-roll':w(3.4,1.6,3.4).toFixed(2),'d-pitch':w(2.2,3.2,5).toFixed(2)};},
    rows:['#d-heave','#d-roll','#d-pitch'],cur:u=>u<1.65?'d-heave':u<3.25?'d-roll':'d-pitch',top:'#d-charts'},
];
const sm=u=>{u=Math.max(0,Math.min(1,u));return u*u*(3-2*u);};
const AB=(u,A,B)=>A*sm((u-.8)/.8)+(B-A)*sm((u-2.6)/.8);
const q=(x,st)=>+(Math.round(x/st)*st).toFixed(4);

(async()=>{
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const p=await b.newPage({viewport:{width:1500,height:1700},deviceScaleFactor:2,colorScheme:'dark'});
  await p.addInitScript(()=>{window.requestAnimationFrame=()=>0;});   // every frame is drawn from here
  p.on('pageerror',e=>console.log('E:',e.message));
  await p.goto(URL);
  await p.waitForFunction(()=>typeof loaded!=='undefined'&&loaded&&model,null,{timeout:180000,polling:500});   // timed polling: the page's requestAnimationFrame is switched off
  // helpers in the page: set a control the way the UI does, find the card rows, aim the app's camera
  await p.evaluate(()=>{
    showHelp(false);
    window.CAP={
      set(vals){for(const [id,v] of Object.entries(vals)){const e=$(id);if(String(e.value)===String(v))continue;
        e.value=v;e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));}},
      tab(t){if(t==='setup')$('t-setup').click();else if(t==='dyn')$('t-dyn').click();else{$('t-kin').click();setEnd(t);}},
      rowOf(sel){
        if(sel.startsWith('tr:')){const s=sel.slice(3);return [...document.querySelectorAll('aside tr')].find(r=>r.offsetParent&&r.cells[0]&&r.cells[0].textContent.trim().startsWith(s));}
        const e=document.querySelector(sel);return e.closest('.row')||e.closest('table')||e.closest('.chk')||e;
      },
      rect(e){const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};},
      cam(c){const [az,el,d,tx,ty,tz]=c,A=az*Math.PI/180,E=el*Math.PI/180;
        view([tx+d*Math.cos(E)*Math.cos(A),ty+d*Math.cos(E)*Math.sin(A),tz+d*Math.sin(E)],[tx,ty,tz]);},
    };
  });
  if(mode==='probe')fs.mkdirSync(path.join(__dirname,'probe'),{recursive:true});
  for(const s of SHOTS){
    if(only.length&&!only.includes(s.k))continue;
    // a clean car for every shot: reset, then this shot's tab
    await p.evaluate(()=>{$('reset-setup').click();$('k-reset')&&$('k-reset').click();});
    await p.evaluate(t=>CAP.tab(t),s.tab);
    if(s.k==='tbar')await p.evaluate(()=>{if(!$('k-tbtog').checked)$('k-tbtog').click();});
    const base=await p.evaluate(()=>({clk:+$('r-clk-l').value}));
    await p.evaluate(v=>{CAP.set(v);frame(0);},s.set(0,base));
    // scroll the card rows into view and measure them once
    const lay=await p.evaluate(([rows,top])=>{
      const els=rows.map(r=>CAP.rowOf(r)).filter(Boolean);els[0].scrollIntoView({block:'center'});
      const R=els.map(e=>CAP.rect(e)),x0=Math.min(...R.map(r=>r.x)),y0=Math.min(...R.map(r=>r.y)),x1=Math.max(...R.map(r=>r.x+r.w)),y1=Math.max(...R.map(r=>r.y+r.h));
      const st=CAP.rect(top?document.querySelector(top).closest('fieldset'):$('stage'));
      return {rows:R,union:{x:Math.floor(x0)-4,y:Math.floor(y0)-4,w:Math.ceil(x1-x0)+8,h:Math.ceil(y1-y0)+8},stage:st};
    },[s.rows,s.top||null]);
    const dir=path.join(OUT,s.k);fs.mkdirSync(dir,{recursive:true});
    const N=SHOT*FPS,frames=[];
    for(let i=0;i<(mode==='probe'?1:N);i++){
      const u=mode==='probe'?3.5:i/FPS,c0=s.cam[0],c1=s.cam[1],k=sm(u/SHOT),cam=c0.map((v,j)=>v+(c1[j]-v)*k);
      const cur=typeof s.cur==='function'?s.cur(u):s.cur;
      const info=await p.evaluate(([vals,cam,cur,t])=>{
        CAP.set(vals);if(cam)CAP.cam(cam);frame(t*1000);
        const e=$(cur),r=CAP.rect(e);
        return {cur:r,frac:e.type==='range'?(+e.value-+e.min)/(+e.max-+e.min):null,kind:e.tagName==='SELECT'?'select':e.type};
      },[s.set(u,base),s.top?null:cam,cur,i/FPS]);
      frames.push(info);
      if(mode==='probe'){await p.screenshot({path:path.join(__dirname,'probe',s.k+'.jpg'),type:'jpeg',quality:80});continue;}
      const n=String(i).padStart(4,'0'),st=lay.stage,un=lay.union;
      await p.screenshot({path:path.join(dir,'s_'+n+'.jpg'),type:'jpeg',quality:88,clip:{x:st.x,y:st.y,width:st.w,height:st.h}});
      await p.screenshot({path:path.join(dir,'p_'+n+'.jpg'),type:'jpeg',quality:92,clip:{x:un.x,y:un.y,width:un.w,height:un.h}});
      if(i%30===0)console.log(s.k,i,'/',N);
    }
    fs.writeFileSync(path.join(dir,'meta.json'),JSON.stringify({lay,frames}));
    console.log('done',s.k,JSON.stringify(lay.union),JSON.stringify(lay.stage));
  }
  await b.close();
})();
