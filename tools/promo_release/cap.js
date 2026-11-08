// Films the real app, frame by frame, for the three UI scenes. Writes web/cap/<scene>/NNNN.jpg.
const {chromium}=require('playwright');const fs=require('fs');
const only=process.argv[2];
(async()=>{
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const p=await b.newPage({viewport:{width:1600,height:1400},deviceScaleFactor:2,colorScheme:'dark'});
  await p.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
  p.on('pageerror',e=>console.log('E:',e.message));
  await p.goto('http://localhost:8765/index.html');
  await p.waitForFunction(()=>typeof loaded!=='undefined'&&loaded&&model,null,{timeout:180000});
  await p.addScriptTag({url:'tl.js'});
  await p.evaluate(()=>{showHelp(false);
    window.fold=(sel,names)=>[...document.querySelectorAll(sel+' fieldset')].forEach(f=>{
      if(names.some(x=>f.querySelector('legend').textContent.includes(x)))f.classList.add('shut');});
    fold('#k-front',['Spindles','Front radius rods','Front track bar']);
    fold('#k-rear',['Jacobs','Rear wheel']);
    $('t-kin').click();
  });
  const shots={
    kin:{t0:9,t1:16,clip:{x:0,y:0,width:1600,height:900}},
    drag:{t0:16,t1:24,clip:{x:1205,y:180,width:380,height:820}},
    rear:{t0:24,t1:32,clip:{x:1205,y:380,width:380,height:965}},
  };
  for(const [k,s] of Object.entries(shots)){
    if(only&&only!==k)continue;
    fs.mkdirSync('web/cap/'+k,{recursive:true});
    await p.evaluate(k=>{
      if(k==='rear')setEnd('rear');else setEnd('front');
      $('k-heave').value=0;$('k-roll').value=0;kOutputs();
      window._last=null;
    },k);
    const N=Math.round((s.t1-s.t0)*30);
    for(let i=0;i<N;i++){
      const t=s.t0+i/30;
      await p.evaluate(([k,t])=>{
        if(k==='kin'){
          $('k-heave').value=TL.kinHeave(t).toFixed(2);$('k-roll').value=TL.kinRoll(t).toFixed(2);kOutputs();
          const a=TL.kinAz(t)*Math.PI/180,P=[175-26,-115,62-14],c=Math.cos(a),s=Math.sin(a);
          view([26+P[0]*c-P[1]*s,P[0]*s+P[1]*c,62],[26,0,14]);
        }else if(k==='drag'){
          const v=TL.drag(t);if(v!==window._last){window._last=v;$('k-dragl').value=v;fadj.dragLen=v;kOutputs();rebuild();}
        }else{
          const v=TL.rod(t);if(v!==window._last){window._last=v;$('r-lt-l').value=v;radj.rodLen[0]=v;kOutputs();rebuild();}
        }
        frame(t*1000);
      },[k,t]);
      await p.screenshot({path:`web/cap/${k}/${String(i).padStart(4,'0')}.jpg`,type:'jpeg',quality:92,clip:s.clip});
      if(i%30===0)console.log(k,i,'/',N);
    }
  }
  await b.close();
})();
