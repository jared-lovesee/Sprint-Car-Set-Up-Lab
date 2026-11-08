// node render.js stills 2.5 6 ...     -> stills/t_<t>.jpg
// node render.js scenes [k ...]      -> out/<k>.mp4, one file per scene (temp name, renamed when ffmpeg exits 0)
const {chromium}=require('playwright');const fs=require('fs');const {spawn}=require('child_process');
const [mode,...args]=process.argv.slice(2);
(async()=>{
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const p=await b.newPage({viewport:{width:600,height:400}});
  p.on('pageerror',e=>console.log('E:',e.message));
  p.on('console',m=>{if(!/501|Failed to load/.test(m.text()))console.log('C:',m.text().slice(0,300));});
  await p.goto('http://localhost:8765/director.html');
  await p.waitForFunction(()=>window.VID,null,{timeout:60000});
  console.log(await p.evaluate(()=>VID.init()));
  const grab=async t=>Buffer.from((await p.evaluate(t=>VID.frame(t),t)).split(',')[1],'base64');
  if(mode==='stills'){
    fs.mkdirSync('stills',{recursive:true});
    for(const a of args){const t=+a,t0=Date.now();fs.writeFileSync(`stills/t_${a}.jpg`,await grab(t));console.log(a,Date.now()-t0,'ms');}
  }else{
    const S=await p.evaluate(()=>TL.SCENES);fs.mkdirSync('out',{recursive:true});
    for(const s of S){
      if(args.length&&!args.includes(s.k))continue;
      const tmp=`out/${s.k}.tmp.mp4`,fin=`out/${s.k}.mp4`;
      const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate','30','-c:v','mjpeg','-i','-',
        '-c:v','libx264','-preset','veryfast','-crf','16','-pix_fmt','yuv420p','-r','30','-g','60',tmp],{stdio:['pipe','inherit','inherit']});
      const N=Math.round((s.t1-s.t0)*30),t0=Date.now();
      for(let i=0;i<N;i++){
        const buf=await grab(s.t0+i/30);
        if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));
        if(i%30===0)console.log(s.k,i,'/',N,((Date.now()-t0)/(i+1)).toFixed(0),'ms/frame');
      }
      ff.stdin.end();
      const code=await new Promise(r=>ff.on('close',r));
      if(code===0)fs.renameSync(tmp,fin);else console.log('ffmpeg failed',s.k,code);
      console.log('done',s.k,((Date.now()-t0)/1000).toFixed(0),'s');
    }
  }
  await b.close();
})();
