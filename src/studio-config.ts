import approved from './visitor-scene.json'

export type SphereKind='glass'|'pink'|'amber'|'moss'|'pearl'|'gold'
export type SphereConfig={id:string;x:number;y:number;z:number;size:number;rotation:number;kind:SphereKind;color:string;hue:number;saturation:number;opacity:number;ior:number;roughness:number;metalness:number;reflection:number;glow:number;float:number;interaction:number;speed:number;damping:number;locked:boolean}
export type BrushKind='hue'|'saturation'|'brightness'|'warmth'|'glow'|'eraser'
export type BrushStroke={x:number;y:number;size:number;strength:number;softness:number;opacity:number;kind:Exclude<BrushKind,'eraser'>}
export type StudioConfig={
  version:2
  bottle:{x:number;y:number;z:number;scale:number;rotationX:number;rotationY:number;rotationZ:number;glassColor:string;glassTransmission:number;glassIor:number;glassRoughness:number;glassReflection:number;liquidColor:string;liquidAbsorption:number;liquidOpacity:number;liquidTransmission:number;capColor:string;capIor:number;capRoughness:number;goldColor:string;goldRoughness:number;highlight:number;rotationSensitivity:number;verticalSensitivity:number;verticalLimit:number;rotationSpeed:number;momentumSensitivity:number;inertia:number;damping:number;friction:number;maxRotationSpeed:number;autoRotate:boolean;autoSpeed:number}
  particles:{count:number;density:number;size:number;sizeVariation:number;color:string;secondaryColor:string;hue:number;saturation:number;brightness:number;opacity:number;glow:number;speed:number;turbulence:number;spread:number;depth:number;cluster:number;radius:number;repulsion:number;attraction:number;velocitySensitivity:number;momentum:number;damping:number;returnStrength:number;sphereStrength:number;ambientSpeed:number}
  spheres:SphereConfig[]
  lighting:{ambient:number;key:number;keyColor:string;keyX:number;keyY:number;keyZ:number;fill:number;fillColor:string;fillX:number;fillY:number;fillZ:number;rim:number;rimColor:string;rimX:number;rimY:number;rimZ:number;warm:number;warmColor:string;warmX:number;warmY:number;warmZ:number;temperature:number;exposure:number;reflection:number;bloom:number;bloomThreshold:number;highlight:number;shadow:number}
  atmosphere:{hue:number;saturation:number;contrast:number;brightness:number;temperature:number;warmth:number;fogColor:string;fogDensity:number;glow:number;background:string;depth:number}
  camera:{x:number;y:number;z:number;pitch:number;yaw:number;roll:number;fov:number;zoom:number;framing:number;sceneDepth:number;mobileScale:number;mobileFraming:number}
  brush:{size:number;strength:number;softness:number;opacity:number;strokes:BrushStroke[]}
}
const kinds:SphereKind[]=['glass','pink','amber','moss','pearl','gold']
const sphereColors=['#fff4e3','#b65e90','#f5c177','#263813','#d9c9b0','#b88b42']
export const defaultSpheres=():SphereConfig[]=>{
  let seed=34219;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296}
  const accents:[number,number,number,number,number][]=[[-.99,-.62,2.65,.23,4],[1.02,-.86,2.7,.24,4],[-.68,-.85,2.45,.16,1],[.84,-.61,1.8,.16,3],[-.49,.43,-.15,.13,0],[.62,.02,-.8,.10,4],[.35,-.37,.1,.10,4],[-.54,-.34,-.25,.09,4],[.87,.26,-.6,.10,1],[-.72,.28,-.6,.07,4]]
  return Array.from({length:57},(_,i)=>{
    const [x,y,z,size,index]=i<accents.length?accents[i]:[(random()*2.1-1.05),(random()*1.5-.65),(random()*4.2-3.6),(.022+random()*.05),i%6]
    const kind=kinds[index]
    return {id:`orb-${i+1}`,x,y,z,size,rotation:random()*360,kind,color:sphereColors[index],hue:0,saturation:1,opacity:1,ior:1.45,roughness:kind==='moss'?.82:kind==='pearl'?.42:.08,metalness:kind==='gold'?.94:0,reflection:1,glow:0,float:.006,interaction:1,speed:1,damping:3,locked:false}
  })
}
export const defaults=():StudioConfig=>({version:2,
  bottle:{x:0,y:0,z:0,scale:1,rotationX:0,rotationY:0,rotationZ:0,glassColor:'#ffefdb',glassTransmission:1,glassIor:1.52,glassRoughness:.022,glassReflection:1.15,liquidColor:'#e8bd77',liquidAbsorption:.32,liquidOpacity:1,liquidTransmission:1,capColor:'#ffefdb',capIor:1.52,capRoughness:.012,goldColor:'#eac07a',goldRoughness:.16,highlight:1,rotationSensitivity:.004,verticalSensitivity:.002,verticalLimit:25,rotationSpeed:1,momentumSensitivity:1,inertia:1,damping:7,friction:0,maxRotationSpeed:5,autoRotate:false,autoSpeed:.1},
  particles:{count:25600,density:1,size:1,sizeVariation:1,color:'#bc9248',secondaryColor:'#a75179',hue:0,saturation:1,brightness:1,opacity:.92,glow:1,speed:1,turbulence:1,spread:1,depth:1,cluster:1,radius:1,repulsion:.7,attraction:0,velocitySensitivity:1,momentum:1,damping:3.2,returnStrength:3.8,sphereStrength:.5,ambientSpeed:1},
  spheres:defaultSpheres(),
  lighting:{ambient:.25,key:2.5,keyColor:'#ffdfb0',keyX:-3,keyY:3,keyZ:4,fill:2.1,fillColor:'#ffb963',fillX:3,fillY:2,fillZ:-1,rim:.65,rimColor:'#90b6d5',rimX:-1,rimY:6,rimZ:-4,warm:2.2,warmColor:'#ffbf69',warmX:.15,warmY:.1,warmZ:-1.4,temperature:0,exposure:1,reflection:1,bloom:.065,bloomThreshold:.9,highlight:1,shadow:1},
  atmosphere:{hue:0,saturation:1,contrast:1,brightness:1,temperature:0,warmth:1,fogColor:'#0b1b20',fogDensity:1,glow:1,background:'#080c0c',depth:1},
  camera:{x:0,y:0,z:5,pitch:0,yaw:0,roll:0,fov:35,zoom:1,framing:0,sceneDepth:1,mobileScale:1,mobileFraming:0},
  brush:{size:.12,strength:.4,softness:.7,opacity:.7,strokes:[]},
})
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
const color=(v:unknown)=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)
function merge<T>(base:T,raw:unknown):T{
  if(Array.isArray(base))return (Array.isArray(raw)?raw:base).map((item,index)=>merge(base[Math.min(index,base.length-1)],item)) as T
  if(plain(base)){const source=plain(raw)?raw:{};return Object.fromEntries(Object.entries(base).map(([key,val])=>[key,merge(val,source[key])])) as T}
  if(typeof base==='number')return (typeof raw==='number'&&Number.isFinite(raw)?raw:base) as T
  if(typeof base==='boolean')return (typeof raw==='boolean'?raw:base) as T
  if(typeof base==='string')return ((base.startsWith('#')?color(raw):typeof raw==='string')?raw:base) as T
  return base
}
export function parseConfig(raw:unknown):StudioConfig{
  const base=defaults();const source=plain(raw)?raw:{};const result=merge(base,source)
  result.version=2
  if(Array.isArray(source.spheres))result.spheres=source.spheres.slice(0,200).map((v,i)=>{
    const sphere=merge(base.spheres[i%base.spheres.length],v);sphere.id=typeof v?.id==='string'?v.id:`orb-${i+1}`;sphere.kind=kinds.includes(sphere.kind)?sphere.kind:'glass';return sphere
  })
  if(plain(source.brush)&&Array.isArray(source.brush.strokes))result.brush.strokes=source.brush.strokes.slice(0,64).filter(plain).map(v=>merge({x:.5,y:.5,size:.12,strength:.4,softness:.7,opacity:.7,kind:'warmth' as const},v)).filter(v=>['hue','saturation','brightness','warmth','glow'].includes(v.kind))
  result.particles.count=Math.max(1024,Math.min(25600,Math.round(result.particles.count)))
  return result
}
export const approvedConfig=()=>parseConfig(approved)
export const creatorKey='nocturne.creator-studio.v2'
export function readDraft():StudioConfig{try{return parseConfig(JSON.parse(localStorage.getItem(creatorKey)||'null')||approved)}catch{return approvedConfig()}}
export function saveDraft(config:StudioConfig){localStorage.setItem(creatorKey,JSON.stringify(config))}
