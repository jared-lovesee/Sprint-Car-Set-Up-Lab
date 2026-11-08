// Shared timeline for the release promo. The UI capture (real app) and the director (3D + graphics)
// both read their adjustments from here, so the slider you see in the app and the car you see move agree.
(function(){
const ease=u=>{u=Math.max(0,Math.min(1,u));return u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2;};
// keyframes [[t,value],...]; holds between keys, eases across each gap
function key(t,list){
  if(t<=list[0][0])return list[0][1];
  for(let i=1;i<list.length;i++){const [t1,v1]=list[i],[t0,v0]=list[i-1];if(t<=t1)return v0+(v1-v0)*ease((t-t0)/(t1-t0));}
  return list[list.length-1][1];
}
const SCENES=[
  {k:'open',t0:0,t1:4,p:'k'},
  {k:'cad',t0:4,t1:9,p:'b'},
  {k:'kin',t0:9,t1:16,p:'k'},
  {k:'drag',t0:16,t1:24,p:'b'},
  {k:'rear',t0:24,t1:32,p:'k'},
  {k:'beta',t0:32,t1:36,p:'o'},
  {k:'end',t0:36,t1:40,p:'k'},
];
const TL={
  FPS:30,DUR:40,SCENES,key,ease,
  sceneAt:t=>SCENES.find(s=>t<s.t1)||SCENES[SCENES.length-1],
  // Drag link length trim, in (k-dragl)
  drag:t=>Math.round(32*key(t,[[16.9,0],[17.9,0.5],[19.4,0.5],[20.6,-0.5],[22.0,-0.5],[23.0,0]]))/32,
  // LR top radius rod length, in (r-lt-l)
  rod:t=>Math.round(16*key(t,[[24.9,0],[26.4,1],[28.8,1],[30.2,2]]))/16,
  // Kinematics page: the car worked through heave and roll while the page reads it out
  kinHeave:t=>{const u=t-9;return 2.0*Math.sin(2*Math.PI*u/3.2)*Math.min(1,u/.6);},
  kinRoll:t=>{const u=t-9;return 2.6*Math.sin(2*Math.PI*u/6.4)*Math.min(1,u/.6);},
  kinAz:t=>(t-9)/7*24,   // degrees the app's own camera orbits during the kinematics scene
};
window.TL=TL;
})();
