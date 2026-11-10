import './bottle-controls.css'
import { production } from './studio-config'

export type BottleControls = {
  glassTint:string; liquidTint:string; scale:number; clarity:number; reflection:number
  brightness:number; lightColor:string; rotationSpeed:number; inertia:number; glow:number
  lightColorChanged:boolean
}

const original:BottleControls={
  glassTint:production.bottle.glassTint,liquidTint:production.bottle.liquidTint,
  scale:production.bottle.scale,clarity:production.bottle.glassTransmission,reflection:1.15,
  brightness:1,lightColor:production.lighting.keyColor,rotationSpeed:1,
  inertia:production.bottle.inertia,glow:0,lightColorChanged:false,
}

const field=(label:string,key:keyof BottleControls,min?:number,max?:number,step?:number)=>
  `<label class="bottle-control"><span>${label}</span><input data-bottle-setting="${key}" type="${min===undefined?'color':'range'}" ${min===undefined?'':`min="${min}" max="${max}" step="${step}"`} value="${original[key]}"></label>`

export function createBottleControls(host:HTMLElement,onChange:(settings:BottleControls,reset:boolean)=>void){
  const controls=document.createElement('div')
  controls.className='bottle-controls'
  controls.setAttribute('aria-label','Bottle settings')
  controls.innerHTML=`
    <details class="bottle-controls-panel bottle-controls-appearance">
      <summary>Appearance <span aria-hidden="true">＋</span></summary>
      <div class="bottle-controls-fields">
        ${field('Glass color','glassTint')}
        ${field('Perfume color','liquidTint')}
        ${field('Bottle size','scale',.7,1.3,.01)}
        ${field('Glass transparency','clarity',.2,1,.01)}
        ${field('Reflection','reflection',0,3,.01)}
      </div>
    </details>
    <details class="bottle-controls-panel bottle-controls-motion">
      <summary>Light & motion <span aria-hidden="true">＋</span></summary>
      <div class="bottle-controls-fields">
        ${field('Lighting intensity','brightness',.3,1.8,.01)}
        ${field('Lighting color','lightColor')}
        ${field('Rotation speed','rotationSpeed',.2,3,.01)}
        ${field('Rotation inertia','inertia',0,1,.01)}
        ${field('Bottle glow','glow',0,3,.01)}
        <button class="bottle-controls-reset" type="button">Reset original design ↺</button>
      </div>
    </details>`
  host.append(controls)
  let settings={...original}
  const panels=controls.querySelectorAll<HTMLDetailsElement>('details')
  panels.forEach(panel=>panel.addEventListener('toggle',()=>{
    if(panel.open)panels.forEach(other=>{if(other!==panel)other.open=false})
  }))
  controls.querySelectorAll<HTMLInputElement>('input[data-bottle-setting]').forEach(input=>{
    input.addEventListener('input',()=>{
      const key=input.dataset.bottleSetting as keyof BottleControls
      settings={...settings,[key]:input.type==='range'?Number(input.value):input.value}
      if(key==='lightColor')settings.lightColorChanged=true
      onChange(settings,false)
    })
  })
  controls.querySelector('.bottle-controls-reset')!.addEventListener('click',()=>{
    settings={...original}
    controls.querySelectorAll<HTMLInputElement>('input[data-bottle-setting]').forEach(input=>{
      input.value=String(settings[input.dataset.bottleSetting as keyof BottleControls])
    })
    onChange(settings,true)
  })
  return {get settings(){return settings}}
}
