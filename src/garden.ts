import * as THREE from 'three'
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { WORLD } from './optical-stage'
import type { SphereConfig, StudioConfig } from './studio-config'

export function seeded(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15,1 | seed);
    t = t + Math.imul(t ^ t >>> 7,61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
}
type Stage = { backdrop: THREE.Texture }
const palette = ['#bc9248','#e6d7b1','#a75179','#683d72','#40522c','#d9aa71']

/** One deterministic 3D garden. Screen-space anchors are recomposed for portrait;
 * depth, real geometry and camera projection provide perspective and parallax. */
export function createGarden(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, stage: Stage, compact: boolean, config: StudioConfig) {
  const root = new THREE.Group(); root.name = 'Living garden'; scene.add(root)
  const random = seeded(83107)
  const aspect = camera.aspect
  const portrait = aspect < .9
  const vh = (z: number) => 2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*(camera.position.z-z)
  const world = (x: number, y: number, z: number) => {z*=config.camera.sceneDepth;return new THREE.Vector3(x*vh(z)*aspect/2,y*vh(z)/2,z)}
  const particleSettings=config.particles
  const r = (a: number,b: number) => a+(b-a)*random()
  const exclusion = portrait ? .39 : .225
  const clusters = Array.from({length: 120},(_,i) => {
    let x = r(-1.2,1.2), y = r(-.57,1.3)
    // The banks have different profiles, not mirrored wings. Their irregular
    // inner edges open around the product, then fold back across the top.
    const bankEdge=exclusion+.045+Math.sin(y*7+(x<0?1.6:.1))*.055
    if (Math.abs(x)<bankEdge) x = (x<0?-1:1)*(bankEdge+random()*.25)
    if (i<22) { x=r(-1.15,1.15); y=r(-.66,-.43); if(Math.abs(x)<exclusion) x+=(x<0?-1:1)*exclusion }
    return {x,y,z:r(-5.2,-.6),spread:r(.075,.20)}
  })
  function sample() {
    const c=clusters[Math.floor(random()*clusters.length)]
    const a=random()*Math.PI*2, d=Math.sqrt(random())*c.spread*particleSettings.cluster
    let x=c.x+Math.cos(a)*d, y=c.y+Math.sin(a)*d*1.7
    if(Math.abs(x)<exclusion && y>-.5 && y<.64) x=(x<0?-1:1)*(exclusion+random()*.12)
    return world(x*particleSettings.spread,y*particleSettings.spread,(c.z+r(-.7,.7))*particleSettings.depth)
  }
  const dummy = new THREE.Object3D()
  const color = new THREE.Color()
  const mossMaterial = new THREE.MeshStandardMaterial({color:'#76813d',roughness:.82,metalness:.08})
  mossMaterial.onBeforeCompile = s => {
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 mossPosition;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nmossPosition=position;')
    s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 mossPosition;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        float n=sin(mossPosition.x*43.)*sin(mossPosition.y*47.)*sin(mossPosition.z*39.);
        diffuseColor.rgb*=.55+.45*smoothstep(-.7,.8,n);`)
  }
  const mossCount = compact?7000:18000
  const moss = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),mossMaterial,mossCount)
  moss.name='Moss and lichen'; moss.layers.set(WORLD)
  for(let i=0;i<mossCount;i++) {
    dummy.position.copy(sample()); const size=r(.006,.024)
    dummy.scale.set(size*r(.6,1.7),size*r(.6,1.5),size)
    dummy.rotation.set(r(0,6),r(0,6),r(0,6)); dummy.updateMatrix(); moss.setMatrixAt(i,dummy.matrix)
    color.setHSL(r(.17,.28),r(.25,.65),r(.02,.13)); moss.setColorAt(i,color)
  }
  root.add(moss)

  // Irregular, asymmetric woody stems and tapered leaves, with a few bead flowers.
  const branchMaterial = new THREE.MeshStandardMaterial({color:'#373827',roughness:.62,metalness:.15})
  const leafMaterial = new THREE.MeshPhysicalMaterial({color:'#879059',roughness:.38,metalness:.12,clearcoat:.6,side:THREE.DoubleSide})
  const leafGeometry = new THREE.SphereGeometry(1,5,3)
  const leafCount=compact?1700:3600
  const leaves = new THREE.InstancedMesh(leafGeometry,leafMaterial,leafCount); leaves.layers.set(WORLD); leaves.name='Wet leaves'
  let leafIndex=0
  const stems:THREE.BufferGeometry[]=[]
  for(let i=0;i<(compact?44:83);i++) {
    const c=clusters[i%clusters.length]
    const points = Array.from({length:6},(_,j)=>world(c.x+Math.sin(j*.64+i)*.07+j*(i%2?-.013:.018),c.y+j*.055,c.z+Math.sin(j)*.16))
    const curve=new THREE.CatmullRomCurve3(points)
    stems.push(new THREE.TubeGeometry(curve,18,r(.002,.006),4,false))
    for(let j=0;j<44 && leafIndex<leafCount;j++,leafIndex++) {
      const t=random(), p=curve.getPoint(t), sign=j%2?1:-1
      dummy.position.copy(p).add(new THREE.Vector3(sign*r(.015,.065),r(-.025,.03),r(-.025,.025)))
      const size=r(.015,.045)*(1-t*.45)
      dummy.scale.set(size,size*.27,size*.55); dummy.rotation.set(r(-1,1),r(-1,1),sign*r(.25,1.2))
      dummy.updateMatrix(); leaves.setMatrixAt(leafIndex,dummy.matrix)
      color.setHSL(r(.18,.30),r(.2,.55),r(.045,.17)); leaves.setColorAt(leafIndex,color)
    }
  }
  const branches=new THREE.Mesh(mergeGeometries(stems),branchMaterial)
  branches.name='Merged botanical stems';branches.layers.set(WORLD);root.add(branches)
  stems.forEach(g=>g.dispose())
  leaves.count=leafIndex; root.add(leaves)

  const pearl = new THREE.MeshPhysicalMaterial({color:'#d9c9b0',roughness:.42,metalness:.04,clearcoat:.25,specularIntensity:.55})
  pearl.onBeforeCompile = s => {
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 marbleP;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nmarbleP=position;')
    s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 marbleP;')
      .replace('#include <color_fragment>',`#include <color_fragment>
      vec3 q=normalize(marbleP)*3.;
      float vein=abs(sin(q.x*4.+sin(q.y*5.+sin(q.z*4.))*1.8));
      float fine=1.-smoothstep(.025,.11,vein);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.24,.12,.027),fine*.97);`)
  }
  const amber = new THREE.MeshPhysicalMaterial({color:'#f5c177',roughness:.045,metalness:.08,transmission:.87,thickness:.14,ior:1.46,attenuationColor:new THREE.Color('#ad6429'),attenuationDistance:.5})
  const pink = new THREE.MeshPhysicalMaterial({color:'#b65e90',roughness:.1,metalness:.12,transmission:.65,thickness:.12,ior:1.45,clearcoat:1})
  const glass = new THREE.MeshPhysicalMaterial({color:'#fff4e3',roughness:.025,transmission:1,thickness:.12,ior:1.45})
  // Orbs are excluded from the backdrop capture, then refract that completed
  // capture in the final pass. Never read and write the same GPU texture.
  const gardenSize={value:new THREE.Vector2(1,1)}
  for(const m of [amber,pink,glass]) {
    m.onBeforeCompile=s=>{
      s.uniforms.gardenMap={value:stage.backdrop}; s.uniforms.gardenSize=gardenSize
      m.userData.shader=s
      s.fragmentShader=s.fragmentShader.replace('#include <transmission_pars_fragment>',THREE.ShaderChunk.transmission_pars_fragment.replaceAll('transmissionSamplerMap','gardenMap').replaceAll('transmissionSamplerSize','gardenSize'))
    }
    m.customProgramCacheKey=()=> 'garden-orb'
  }
  const gold=new THREE.MeshStandardMaterial({color:'#b88b42',metalness:.94,roughness:.2})
  const mossOrb=mossMaterial.clone();mossOrb.color.set('#263813');mossOrb.onBeforeCompile=mossMaterial.onBeforeCompile
  const mossGeometry=new THREE.IcosahedronGeometry(1,3)
  const mossVertices=mossGeometry.attributes.position
  for(let i=0;i<mossVertices.count;i++){
    const p=new THREE.Vector3().fromBufferAttribute(mossVertices,i)
    const bump=1+.07*Math.sin(p.x*23)*Math.cos(p.y*31)*Math.sin(p.z*27)
    mossVertices.setXYZ(i,p.x*bump,p.y*bump,p.z*bump)
  }
  mossGeometry.computeVertexNormals()
  const materials=[glass,pink,amber,mossOrb,pearl,gold]
  const spheres: {mesh:THREE.Mesh,home:THREE.Vector3,phase:number,id:string}[]=[]
  const kindIndex:Record<SphereConfig['kind'],number>={glass:0,pink:1,amber:2,moss:3,pearl:4,gold:5}
  const orbGeometry=new THREE.SphereGeometry(1,32,24)
  // Large accents are deliberately sparse. Depth-of-field softens these edges.
  function addSphere(sphere:SphereConfig){
    const kind=kindIndex[sphere.kind]
    const mesh=new THREE.Mesh(kind===3?mossGeometry:orbGeometry,materials[kind].clone())
    mesh.layers.set([0,1,2].includes(kind)?7:WORLD)
    mesh.name=['Clear bubble','Rose glass','Amber glass','Moss sphere','Veined pearl','Gold bead'][kind]
    mesh.userData.sphereId=sphere.id;root.add(mesh)
    const entry={mesh,home:new THREE.Vector3(),phase:random()*6,id:sphere.id};spheres.push(entry)
    updateSphere(sphere)
  }
  function updateSphere(sphere:SphereConfig){
    const entry=spheres.find(s=>s.id===sphere.id);if(!entry)return
    const {mesh,home}=entry;const kind=kindIndex[sphere.kind]
    if(mesh.userData.kind!==kind){(mesh.material as THREE.Material).dispose();mesh.material=materials[kind].clone();mesh.geometry=kind===3?mossGeometry:orbGeometry;mesh.layers.set([0,1,2].includes(kind)?7:WORLD);mesh.userData.kind=kind}
    const x=portrait?sphere.x*1.12:sphere.x
    home.copy(world(x,sphere.y,sphere.z));mesh.position.copy(home)
    mesh.scale.setScalar(sphere.size*(portrait?.62:1));mesh.rotation.y=THREE.MathUtils.degToRad(sphere.rotation)
    const material=mesh.material as THREE.MeshPhysicalMaterial
    material.color.set(sphere.color);material.color.offsetHSL(sphere.hue/360,0,0)
    const hsl={h:0,s:0,l:0};material.color.getHSL(hsl);material.color.setHSL(hsl.h,THREE.MathUtils.clamp(hsl.s*sphere.saturation,0,1),hsl.l)
    material.opacity=sphere.opacity;material.transparent=sphere.opacity<1||material.transmission>0
    material.ior=sphere.ior;material.roughness=sphere.roughness;material.metalness=sphere.metalness;material.envMapIntensity=sphere.reflection
    material.emissive.set(sphere.color);material.emissiveIntensity=sphere.glow
  }
  config.spheres.forEach(addSphere)

  // Thousands of small, physically shaded ground beads make the transition
  // from living banks to the reflecting water; they are not large white balls.
  const groundCount=compact?750:1800
  const beads=new THREE.InstancedMesh(new THREE.SphereGeometry(1,7,5),new THREE.MeshStandardMaterial({roughness:.21,metalness:.68}),groundCount)
  beads.layers.set(WORLD);beads.name='Ground dew'
  for(let i=0;i<groundCount;i++) {
    const z=r(-4.8,2.8), x=r(-1.15,1.15)
    const radius=r(.004,.019)
    dummy.position.copy(world(x,0,z));dummy.position.y=-vh(0)*(portrait?.185:.248)+radius
    if(Math.abs(x)<.24 && z>-.5 && random()<.85)dummy.position.x+=(x<0?-1:1)*vh(z)*aspect*.25
    dummy.scale.setScalar(radius);dummy.updateMatrix();beads.setMatrixAt(i,dummy.matrix)
    color.set(palette[Math.floor(random()*palette.length)]).multiplyScalar(r(.35,1.2));beads.setColorAt(i,color)
  }
  root.add(beads)

  const dimension=compact?96:160, count=dimension*dimension
  const gpu=new GPUComputationRenderer(dimension,dimension,renderer)
  const origin=gpu.createTexture(), zero=gpu.createTexture()
  const positions=new Float32Array(count*3), refs=new Float32Array(count*2), colors=new Float32Array(count*3), sizes=new Float32Array(count)
  for(let i=0;i<count;i++) {
    let p=sample()
    if(i%5===0) {
      let x=r(-1.08,1.08),y=r(-.65,1.15)
      if(Math.abs(x)<exclusion && y>-.48&&y<.67)x+=(x<0?-1:1)*exclusion
      p=world(x,y,r(-4.8,.65))
    }
    positions.set(p.toArray(),i*3);origin.image.data.set([p.x,p.y,p.z,random()*6.28],i*4)
    refs.set([(i%dimension+.5)/dimension,(Math.floor(i/dimension)+.5)/dimension],i*2)
    const botanical=Math.sin(p.x*2.1+Math.sin(p.y*3.3)+p.z*.65)
    const hue=botanical>.45?2:botanical<-.25?4:random()<.11?1:0
    color.set(hue===2?particleSettings.secondaryColor:hue===0?particleSettings.color:palette[hue]).multiplyScalar(r(.3,hue===4?1.1:2.2));colors.set(color.toArray(),i*3)
    sizes[i]=i%127===0?r(4,7):r(1.1,3.8)
  }
  const pointer={value:new THREE.Vector3(99,99,0)}, speed={value:0}, dt={value:1/60}, elapsed={value:0}, active={value:0}
  const spherePointer={value:new THREE.Vector3(99,99,0)},sphereSpeed={value:0}
  const velocity=gpu.addVariable('velocity',`
    uniform sampler2D origins;uniform vec3 pointer,spherePointer;uniform float dt,speed,pointerActive,sphereSpeed;
    uniform float radius,repulsion,attraction,velocitySensitivity,momentum,damping,returnStrength,sphereStrength,turbulence;
    void main(){vec2 uv=gl_FragCoord.xy/resolution.xy;
      vec3 p=texture2D(origins,uv).xyz;vec3 o=texture2D(offsets,uv).xyz;vec3 v=texture2D(velocity,uv).xyz;
      vec3 d=p+o-pointer;d.z*=.15;float influence=exp(-dot(d,d)*8./max(radius*radius,.01))*pointerActive;
      vec3 direction=normalize(d+vec3(.0001));
      vec3 force=direction*influence*(repulsion-attraction)*(.035+min(speed*velocitySensitivity,4.)*.7);
      vec3 sd=p+o-spherePointer;sd.z*=.2;
      force+=normalize(sd+vec3(.0001))*exp(-dot(sd,sd)*6.)*min(sphereSpeed,4.)*sphereStrength*.45;
      force+=vec3(sin(p.y*8.+p.z*3.),cos(p.x*6.+p.z),sin(p.x*4.))*.002*turbulence;
      v+=(force-o*returnStrength)*dt;v*=exp(-dt*damping/max(momentum,.05));
      gl_FragColor=vec4(clamp(v,vec3(-.8),vec3(.8)),1.);}`,zero)
  const offsets=gpu.addVariable('offsets',`uniform float dt;void main(){vec2 uv=gl_FragCoord.xy/resolution.xy;vec3 p=texture2D(offsets,uv).xyz;vec3 v=texture2D(velocity,uv).xyz;gl_FragColor=vec4(p+v*dt,1.);}`,zero.clone())
  gpu.setVariableDependencies(velocity,[velocity,offsets]);gpu.setVariableDependencies(offsets,[velocity,offsets])
  Object.assign(velocity.material.uniforms,{origins:{value:origin},pointer,speed,dt,pointerActive:active,spherePointer,sphereSpeed,
    radius:{value:particleSettings.radius},repulsion:{value:particleSettings.repulsion},attraction:{value:particleSettings.attraction},velocitySensitivity:{value:particleSettings.velocitySensitivity},momentum:{value:particleSettings.momentum},damping:{value:particleSettings.damping},returnStrength:{value:particleSettings.returnStrength},sphereStrength:{value:particleSettings.sphereStrength},turbulence:{value:particleSettings.turbulence}})
  offsets.material.uniforms.dt=dt
  const gpuError=gpu.init()
  if(gpuError) console.warn('Particle simulation unavailable; using animated vertex field:',gpuError)
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,blending:THREE.NormalBlending,
    uniforms:{offsetMap:{value:zero},simulate:{value:gpuError?0:1},time:elapsed,pixelRatio:{value:renderer.getPixelRatio()},sizeScale:{value:1},sizeVariation:{value:1},hue:{value:0},saturation:{value:1},brightness:{value:1},opacity:{value:.92},glow:{value:1},ambientSpeed:{value:1}},
    vertexShader:`attribute vec2 reference;attribute float beadSize;attribute vec3 tint;
      uniform sampler2D offsetMap;uniform float simulate,time,pixelRatio,sizeScale,sizeVariation,ambientSpeed;varying vec3 vColor;varying float fog;
      void main(){vec3 p=position+texture2D(offsetMap,reference).xyz*simulate;
        p+=vec3(sin(time*.18*ambientSpeed+p.y*3.),cos(time*.13*ambientSpeed+p.x*2.),0.)*.009;
        vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;
        gl_PointSize=clamp(mix(2.,beadSize,sizeVariation)*sizeScale*pixelRatio*5./-v.z,1.,14.);vColor=tint;fog=exp(-max(-v.z-6.,0.)*.08);}`,
    fragmentShader:`uniform float hue,saturation,brightness,opacity,glow;varying vec3 vColor;varying float fog;void main(){vec2 p=gl_PointCoord*2.-1.;float r=dot(p,p);if(r>1.)discard;
      float z=sqrt(1.-r);vec3 n=vec3(p,z);float diffuse=.18+.55*max(dot(n,normalize(vec3(-.6,.8,1.))),0.);
      float spec=pow(max(dot(n,normalize(vec3(-.4,.5,1.))),0.),30.);
      vec3 c=vColor*(diffuse+.18)+mix(vColor,vec3(1.3,.93,.57),.3)*spec*glow;
      float angle=hue*6.2831853;mat3 rotate=mat3(.299+.701*cos(angle)+.168*sin(angle),.587-.587*cos(angle)+.330*sin(angle),.114-.114*cos(angle)-.497*sin(angle),.299-.299*cos(angle)-.328*sin(angle),.587+.413*cos(angle)+.035*sin(angle),.114-.114*cos(angle)+.292*sin(angle),.299-.3*cos(angle)+1.25*sin(angle),.587-.588*cos(angle)-1.05*sin(angle),.114+.886*cos(angle)-.203*sin(angle));
      c=max(rotate*c,vec3(0.));c=mix(vec3(dot(c,vec3(.299,.587,.114))),c,saturation)*brightness;
      gl_FragColor=vec4(c*fog,(1.-smoothstep(.64,1.,r))*opacity);}`,
  })
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('reference',new THREE.BufferAttribute(refs,2))
  geometry.setAttribute('tint',new THREE.BufferAttribute(colors,3));geometry.setAttribute('beadSize',new THREE.BufferAttribute(sizes,1))
  const particles=new THREE.Points(geometry,material);particles.layers.set(WORLD);particles.frustumCulled=false;particles.name='GPU botanical bead field';root.add(particles)
  const drawingSize=new THREE.Vector2()
  function updateParticles(change='all'){
    const settings=config.particles
    geometry.setDrawRange(0,Math.min(count,Math.round(settings.count*settings.density*(compact?9216/25600:1))))
    for(const key of ['size','sizeVariation','hue','saturation','brightness','opacity','glow','ambientSpeed'] as const)material.uniforms[key==='size'?'sizeScale':key].value=settings[key]
    for(const key of ['radius','repulsion','attraction','velocitySensitivity','momentum','damping','returnStrength','sphereStrength','turbulence'] as const)velocity.material.uniforms[key].value=settings[key]
    if(change==='all'||change==='particles.color'||change==='particles.secondaryColor'){
      const base=new THREE.Color(settings.color),secondary=new THREE.Color(settings.secondaryColor)
      for(let i=0;i<count;i++)if(i%5!==4){const source=i%3===0?secondary:base;colors[i*3]=source.r*(.35+(i%7)*.18);colors[i*3+1]=source.g*(.35+(i%7)*.18);colors[i*3+2]=source.b*(.35+(i%7)*.18)}
      geometry.attributes.tint.needsUpdate=true
    }
  }
  updateParticles()
  return {
    count, root, spheres,
    audit:()=>({drawCount:geometry.drawRange.count,pointerSpeed:speed.value,sphereSpeed:sphereSpeed.value,particleSize:material.uniforms.sizeScale.value,particleBrightness:material.uniforms.brightness.value,repulsion:velocity.material.uniforms.repulsion.value,returnStrength:velocity.material.uniforms.returnStrength.value,spheres:spheres.map(s=>({id:s.id,position:s.mesh.position.toArray(),size:s.mesh.scale.x,material:(s.mesh.material as THREE.MeshPhysicalMaterial).color.getHexString()}))}),
    updateParticles,updateSphere,addSphere,
    removeSphere(id:string){const index=spheres.findIndex(s=>s.id===id);if(index<0)return;const [entry]=spheres.splice(index,1);entry.mesh.removeFromParent();(entry.mesh.material as THREE.Material).dispose()},
    moveSphere(id:string,movement:number){const entry=spheres.find(s=>s.id===id);if(!entry)return;spherePointer.value.copy(entry.mesh.position);sphereSpeed.value=movement},
    sphereWorld(id:string){return spheres.find(s=>s.id===id)?.mesh.position.clone()},
    world,
    pointer(x:number,y:number,movement:number){pointer.value.copy(world(x,y,-.8));speed.value=movement;active.value=1},
    leave(){active.value=0},
    tick(seconds:number,delta:number,reduced:boolean){
      elapsed.value=reduced?0:seconds*particleSettings.speed;dt.value=Math.min(delta,.033)*particleSettings.speed
      material.uniforms.pixelRatio.value=renderer.getPixelRatio()
      if(!gpuError&&!reduced){gpu.compute();material.uniforms.offsetMap.value=gpu.getCurrentRenderTarget(offsets).texture}
      renderer.getDrawingBufferSize(drawingSize)
      gardenSize.value.copy(drawingSize)
      speed.value*=Math.exp(-delta*4)
      sphereSpeed.value*=Math.exp(-delta*4)
      for(const {mesh,home,phase,id} of spheres){
        mesh.position.copy(home)
        const setting=config.spheres.find(s=>s.id===id)
        if(!reduced&&setting){mesh.position.y+=Math.sin(seconds*.3*setting.speed+phase)*setting.float*4/(setting.damping+1);mesh.rotation.y+=delta*.015*setting.speed}
      }
    },
    dispose(){root.removeFromParent();const geometries=new Set<THREE.BufferGeometry>(),mats=new Set<THREE.Material>();
      root.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m))}})
      geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());gpu.dispose();origin.dispose();zero.dispose()},
  }
}
