import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createBottleRendering } from './bottle-rendering'
import { createSphereComposition, sphereDefaults, type SphereSettings } from './sphere-composition'
import { rippleDefaults, type RippleSettings } from './ripple-settings'
import {
  ACTIVE_SCENE_KEY, DEFAULT_SCENE_KEY, SAVED_SCENE_KEY, SCENE_CONFIG_FORMAT,
  migrateSceneConfig, parseSceneConfig, stampSceneConfig, storeSceneConfig,
  type JsonObject, type ParticleSceneConfig, type SceneConfig,
} from './scene-config'
import './style.css'

type Settings = {
  positionX: number
  positionY: number
  positionZ: number
  scale: number
  rotationX: number
  rotationY: number
  rotationZ: number
  cameraFov: number
  cameraDistance: number
  environmentIntensity: number
  keyLightIntensity: number
}

const defaults: Settings = {
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  scale: 1,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  cameraFov: 35,
  cameraDistance: 5,
  environmentIntensity: 1,
  keyLightIntensity: 1.8,
}
const creatorMode = import.meta.env.DEV && new URLSearchParams(location.search).get('creator') === '1'
document.documentElement.classList.toggle('creator-mode', creatorMode)
const studioDefaults = {
  glassTint: '#ffffff', glassRoughness: 0.026, glassIor: 1.52, glassTransmission: 1,
  liquidColor: '#cb9b44', liquidAbsorption: 0.4, capTint: '#ffffff', goldColor: '#eeb95d',
  fillIntensity: 0.45, fillColor: '#ffe1b8', keyColor: '#ffe9ce', rimIntensity: 0,
  exposure: 1, backgroundBrightness: 1, backgroundSaturation: 1, backgroundContrast: 1,
  autoRotation: true, autoRotationSpeed: 4, dragSensitivity: 0.4, inertia: 0.9,
  damping: 2, maxRotationSpeed: 180, cameraX: 0, cameraY: 0,
}
type StudioKey = keyof typeof studioDefaults

const builtInConfig: SceneConfig = {
  format: SCENE_CONFIG_FORMAT,
  version: 1,
  updatedAt: new Date(0).toISOString(),
  bottle: { ...defaults },
  spheres: { ...sphereDefaults },
  ripples: { ...rippleDefaults },
  particles: { composition: {}, physics: {}, appearance: {} },
  studio: { ...studioDefaults },
}
const productionConfigUrl = new URL('../Public/Assets/Config/scene-config.default.json', import.meta.url).href
let productionConfig = builtInConfig
try {
  const response = await fetch(productionConfigUrl)
  if (response.ok) productionConfig = migrateSceneConfig(await response.json() as unknown, builtInConfig)
} catch { /* Built-in values remain available if the production data file cannot load. */ }
const storedConfig = creatorMode ? parseSceneConfig(localStorage.getItem(ACTIVE_SCENE_KEY))
  ?? parseSceneConfig(localStorage.getItem(DEFAULT_SCENE_KEY))
  : null
let sceneConfig = migrateSceneConfig(storedConfig ?? productionConfig, productionConfig)
const studioSettings = { ...studioDefaults, ...sceneConfig.studio } as typeof studioDefaults
const legacyCamera = parseSceneConfig(localStorage.getItem('particleCameraView'))
if (legacyCamera && typeof legacyCamera === 'object') {
  const camera = legacyCamera as { fov?: unknown; distance?: unknown }
  const storedParticles = storedConfig && typeof storedConfig === 'object'
    ? (storedConfig as { particles?: { composition?: { depth?: { fov?: unknown; distance?: unknown } } } }).particles : undefined
  const storedDepth = storedParticles?.composition?.depth
  const depth = sceneConfig.particles.composition.depth
  if (depth && typeof depth === 'object') {
    if (storedDepth?.fov === undefined && typeof camera.fov === 'number' && Number.isFinite(camera.fov)) {
      ;(depth as JsonObject).fov = camera.fov
    }
    if (storedDepth?.distance === undefined && typeof camera.distance === 'number' && Number.isFinite(camera.distance)) {
      ;(depth as JsonObject).distance = camera.distance
    }
    ;(depth as JsonObject).cameraSaved = true
  }
}
const settings: Settings = { ...defaults, ...sceneConfig.bottle } as Settings
const controls: { key: keyof Settings; label: string; min: number; max: number; step: number; unit?: string }[] = [
  { key: 'positionX', label: 'Position X', min: -3, max: 3, step: 0.01 },
  { key: 'positionY', label: 'Position Y', min: -3, max: 3, step: 0.01 },
  { key: 'positionZ', label: 'Position Z', min: -3, max: 3, step: 0.01 },
  { key: 'scale', label: 'Scale', min: 0.2, max: 2.5, step: 0.01 },
  { key: 'rotationX', label: 'Rotation X', min: -180, max: 180, step: 1, unit: '°' },
  { key: 'rotationY', label: 'Rotation Y', min: -180, max: 180, step: 1, unit: '°' },
  { key: 'rotationZ', label: 'Rotation Z', min: -180, max: 180, step: 1, unit: '°' },
  { key: 'cameraFov', label: 'Camera FOV', min: 20, max: 75, step: 1, unit: '°' },
  { key: 'cameraDistance', label: 'Camera distance', min: 2, max: 12, step: 0.01 },
  { key: 'environmentIntensity', label: 'Environment intensity', min: 0, max: 3, step: 0.01 },
  { key: 'keyLightIntensity', label: 'Key light intensity', min: 0, max: 10, step: 0.01 },
]

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Application root element was not found.')

app.innerHTML = `
  <div class="entry-intro" aria-hidden="true"><span>NOCTURNE</span></div>
  <a class="skip-link" href="#fragrance">Skip to the fragrance</a>
  <header class="site-header">
    <button class="header-menu" type="button" aria-label="Open menu" aria-haspopup="dialog" aria-controls="menu-dialog" aria-expanded="false">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg><span>Menu</span>
    </button>
    <a class="header-logo" href="#top" aria-label="Nocturne home">NOCTURNE</a>
    <button class="header-studio" type="button" aria-controls="studio-panel" aria-expanded="false" ${creatorMode ? '' : 'hidden'}>Creator Studio</button>
  </header>
  <main>
    <section class="site-hero" id="top" aria-label="Nocturne perfume bottle experience">
      <img class="hero-cavern" alt="" aria-hidden="true" />
      <div class="ripple-layer" aria-hidden="true"><video class="hero-video" autoplay muted loop playsinline preload="auto"></video></div>
      <iframe id="particle-layer" class="particle-layer" src="./particle.html" title="Nocturne particle field" aria-hidden="true" tabindex="-1"></iframe>
      <div class="scene-layer" aria-label="Interactive 3D Nocturne perfume bottle"></div>
      <div class="bottle-drag-target" role="button" tabindex="0" aria-label="Drag horizontally or use arrow keys to rotate the perfume bottle" hidden></div>
      <p class="load-status" role="status">Loading bottle…</p>
      <div class="hero-copy">
        <p class="hero-kicker">EAU DE PARFUM</p>
        <h1>Enter Nocturne</h1>
        <a href="#fragrance" class="hero-discover">Discover the fragrance <span aria-hidden="true">↗</span></a>
      </div>
    </section>
    <section class="fragrance-section" id="fragrance" aria-labelledby="fragrance-title">
      <p class="section-index">01 / THE FRAGRANCE</p>
      <div class="fragrance-grid">
        <div>
          <p class="section-kicker">The Nocturne collection</p>
          <h2 id="fragrance-title">Made for<br>the hours after dark.</h2>
        </div>
        <div class="fragrance-detail">
          <p class="fragrance-name">NOCTURNE <span>EAU DE PARFUM</span></p>
          <p>Deep amber held in sculpted crystal. A warm gold collar and a faceted cap catch the last light.</p>
          <a href="#top" class="text-link">Explore the bottle <span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </section>
    <section class="story-section" id="story" aria-labelledby="story-title">
      <p class="section-index">02 / THE WORLD OF NOCTURNE</p>
      <div class="story-grid">
        <h2 id="story-title">Light, held<br>in shadow.</h2>
        <p>The bottle is the beginning of the experience: crystal, amber and gold moving through a midnight landscape. Turn your attention back to the hero to explore it in real time.</p>
      </div>
      <a href="#top" class="text-link">Return to the experience <span aria-hidden="true">↑</span></a>
    </section>
  </main>
  <footer class="site-footer"><a href="#top" aria-label="Nocturne home">NOCTURNE</a><span>EAU DE PARFUM</span><a href="#top">Back to top ↑</a></footer>
  <dialog class="menu-dialog" id="menu-dialog" aria-labelledby="menu-title">
    <div class="menu-content">
      <div class="menu-top"><h2 id="menu-title">Explore Nocturne</h2><button class="menu-close" type="button" aria-label="Close menu">×</button></div>
      <nav class="menu-links" aria-label="Explore Nocturne">
        <a href="#top">The experience</a>
        <a href="#fragrance">The fragrance</a>
        <a href="#story">The world of Nocturne</a>
        <button type="button" class="menu-scene-controls" ${creatorMode ? '' : 'hidden'}>Creator Studio</button>
      </nav>
      <p class="menu-signoff">NOCTURNE · EAU DE PARFUM</p>
    </div>
  </dialog>
  <aside class="studio-panel" id="studio-panel" aria-label="Creator Studio" hidden>
    <div class="studio-panel-head"><span>Scene controls</span><button class="studio-close" type="button" aria-label="Close scene controls">×</button></div>
    <div class="creator-actions"><button type="button" data-creator-action="preview">Preview Mode</button><button type="button" data-creator-action="undo">Undo</button><button type="button" data-creator-action="redo">Redo</button></div>
    <div class="creator-categories"><a href="#creator-bottle">Bottle</a><a href="#creator-particles">Particles</a><a href="#creator-spheres">Spheres</a><a href="#creator-lighting">Lighting</a><a href="#creator-atmosphere">Atmosphere</a><a href="#creator-brushes">Brushes</a><a href="#creator-camera">Camera</a><a href="#creator-presets">Presets</a></div>
    <section class="scene-config-tools" id="creator-presets" aria-labelledby="scene-config-title">
      <div><h2 id="scene-config-title">Scene Config</h2><p>Art direction is saved locally across refreshes and deployments.</p></div>
      <div class="scene-config-actions">
        <button type="button" data-scene-action="save">Save Scene</button>
        <button type="button" data-scene-action="load">Load Scene</button>
        <button type="button" data-scene-action="default">Set as Default</button>
        <button type="button" data-scene-action="export">Copy / Export Config</button>
        <button type="button" data-scene-action="import">Import Config</button>
        <button type="button" data-scene-action="preset-save">Save As Preset</button>
        <button type="button" data-scene-action="preset-load">Load Preset</button>
        <button type="button" data-scene-action="preset-duplicate">Duplicate Preset</button>
        <button type="button" data-scene-action="reset-all">Reset Entire Scene</button>
        <input type="file" data-scene-import accept="application/json,.json" hidden />
      </div>
      <p class="scene-config-status" role="status" aria-live="polite">Current scene auto-saved.</p>
    </section>
    <div id="creator-particles"><button class="particle-settings-toggle" type="button" aria-controls="particle-layer" aria-expanded="false">Particle Settings</button></div>
    <details class="ripple-editor">
      <summary>Floor Ripple Settings <span>Temporary controls</span></summary>
      <div class="editor-body">
        <div class="ripple-control-list"></div>
        <div class="editor-actions"><button type="button" data-ripple-action="reset">Reset Ripples</button></div>
        <p class="ripple-editor-message" role="status" aria-live="polite"></p>
      </div>
    </details>
    <details class="sphere-editor" id="creator-spheres">
      <summary>Sphere Settings <span>Drag spheres to position them</span></summary>
      <div class="editor-body">
        <div class="sphere-control-list"></div>
        <p class="sphere-selection">Select a sphere in the scene to edit its position.</p>
        <div class="sphere-position-list" hidden></div>
        <div class="editor-actions"><button type="button" data-sphere-action="reset">Reset Spheres</button></div>
        <p class="sphere-editor-message" role="status" aria-live="polite"></p>
      </div>
    </details>
    <details class="bottle-editor" id="creator-bottle">
      <summary>Bottle Editor <span>Temporary controls</span></summary>
      <div class="editor-body">
        <div class="control-list"></div>
        <div class="creator-control-list" data-creator-group="bottle"></div>
        <div class="editor-actions">
          <button type="button" data-action="reset">Reset</button>
          <button type="button" data-action="copy">Copy Settings</button>
        </div>
        <p class="editor-message" role="status" aria-live="polite"></p>
      </div>
    </details>
    <details class="creator-editor" id="creator-lighting"><summary>Lighting</summary><div class="creator-control-list" data-creator-group="lighting"></div></details>
    <details class="creator-editor" id="creator-atmosphere"><summary>Atmosphere</summary><div class="creator-control-list" data-creator-group="atmosphere"></div></details>
    <details class="creator-editor" id="creator-camera"><summary>Camera</summary><div class="creator-control-list" data-creator-group="camera"></div></details>
    <details class="creator-editor" id="creator-brushes"><summary>Brushes</summary><p class="creator-note">Localized painting is not available in this build.</p></details>
  </aside>
`

const menu = app.querySelector<HTMLDialogElement>('.menu-dialog')!
const menuToggle = app.querySelector<HTMLButtonElement>('.header-menu')!
const studioPanel = app.querySelector<HTMLElement>('.studio-panel')!
const studioToggle = app.querySelector<HTMLButtonElement>('.header-studio')!
const setStudioOpen = (open: boolean) => {
  studioPanel.hidden = !open
  studioToggle.setAttribute('aria-expanded', String(open))
  if (!open && particleControlsOpen) particleToggle.click()
  if (open) app.querySelector<HTMLButtonElement>('.studio-close')!.focus()
  else studioToggle.focus()
}
const closeMenu = () => {
  menu.close()
  menuToggle.setAttribute('aria-expanded', 'false')
}
menuToggle.addEventListener('click', () => {
  if (!studioPanel.hidden) setStudioOpen(false)
  menu.showModal()
  menuToggle.setAttribute('aria-expanded', 'true')
  app.querySelector<HTMLButtonElement>('.menu-close')!.focus()
})
app.querySelector<HTMLButtonElement>('.menu-close')!.addEventListener('click', closeMenu)
menu.addEventListener('close', () => menuToggle.setAttribute('aria-expanded', 'false'))
menu.addEventListener('click', (event) => { if (event.target === menu) closeMenu() })
menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu))
app.querySelector<HTMLButtonElement>('.menu-scene-controls')!.addEventListener('click', () => {
  closeMenu()
  setStudioOpen(true)
})
studioToggle.addEventListener('click', () => setStudioOpen(studioPanel.hidden))
app.querySelector<HTMLButtonElement>('.studio-close')!.addEventListener('click', () => setStudioOpen(false))
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !studioPanel.hidden) setStudioOpen(false)
})
const updateHeader = () => app.querySelector('.site-header')?.classList.toggle('is-scrolled', window.scrollY > window.innerHeight * 0.7)
window.addEventListener('scroll', updateHeader, { passive: true })
updateHeader()
window.setTimeout(() => app.querySelector('.entry-intro')?.remove(), 1850)

const particleFrame = app.querySelector<HTMLIFrameElement>('.particle-layer')!
const particleToggle = app.querySelector<HTMLButtonElement>('.particle-settings-toggle')!
const particleRequests = new Map<string, (config: ParticleSceneConfig) => void>()
let particleReady = false
let particleControlsOpen = false
const syncParticleControls = () => {
  particleToggle.setAttribute('aria-expanded', String(particleControlsOpen))
  particleToggle.textContent = particleControlsOpen ? 'Close Particle Settings' : 'Particle Settings'
  particleFrame.setAttribute('aria-hidden', String(!particleControlsOpen))
  particleFrame.tabIndex = particleControlsOpen ? 0 : -1
  particleFrame.contentWindow?.postMessage({ type: 'nocturne:particle-controls', open: particleControlsOpen }, location.origin)
}
particleToggle.addEventListener('click', () => {
  particleControlsOpen = !particleControlsOpen
  syncParticleControls()
})
particleFrame.addEventListener('load', syncParticleControls)
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin || event.source !== particleFrame.contentWindow) return
  if (event.data?.type === 'nocturne:particle-controls-ready') {
    particleReady = true
    syncParticleControls()
    particleFrame.contentWindow?.postMessage({ type: 'nocturne:scene-config-apply', config: sceneConfig.particles }, location.origin)
  } else if (event.data?.type === 'nocturne:particle-config-change') {
    sceneConfig.particles = event.data.config as ParticleSceneConfig
    scheduleAutoSaveScene()
  } else if (event.data?.type === 'nocturne:particle-config-response') {
    const resolve = particleRequests.get(String(event.data.requestId))
    if (resolve) {
      particleRequests.delete(String(event.data.requestId))
      resolve(event.data.config as ParticleSceneConfig)
    }
  }
})

const sceneLayer = app.querySelector<HTMLDivElement>('.scene-layer')!
const loadStatus = app.querySelector<HTMLParagraphElement>('.load-status')!
const controlList = app.querySelector<HTMLDivElement>('.control-list')!
const sphereControlList = app.querySelector<HTMLDivElement>('.sphere-control-list')!
const rippleControlList = app.querySelector<HTMLDivElement>('.ripple-control-list')!
const editorMessage = app.querySelector<HTMLParagraphElement>('.editor-message')!
const sphereEditorMessage = app.querySelector<HTMLParagraphElement>('.sphere-editor-message')!
const rippleEditorMessage = app.querySelector<HTMLParagraphElement>('.ripple-editor-message')!
const sceneConfigStatus = app.querySelector<HTMLParagraphElement>('.scene-config-status')!
const sceneImport = app.querySelector<HTMLInputElement>('[data-scene-import]')!
const hero = app.querySelector<HTMLElement>('.site-hero')!
const cavernUrl = new URL('../Public/Assets/Images/nocturne-cavern.png', import.meta.url).href
app.querySelector<HTMLImageElement>('.hero-cavern')!.src = cavernUrl
const video = app.querySelector<HTMLVideoElement>('.hero-video')!
video.src = new URL('../Public/Assets/Video/Background Final Video.web.mp4', import.meta.url).href

video.play().catch(() => {
  loadStatus.textContent = 'Tap to play the background video.'
  video.addEventListener('pointerdown', () => void video.play(), { once: true })
})

controlList.innerHTML = controls.map(({ key, label, min, max, step, unit }) => `
  <label class="control">
    <span class="control-heading"><span>${label}</span><output data-value="${key}"></output></span>
    <input type="range" data-setting="${key}" min="${min}" max="${max}" step="${step}" value="${settings[key]}" aria-label="${label}" />
    <span class="unit" aria-hidden="true">${unit ?? ''}</span>
  </label>
`).join('')

const rippleSettings: RippleSettings = { ...rippleDefaults, ...sceneConfig.ripples } as RippleSettings
const rippleControls: { key: keyof RippleSettings; label: string; min: number; max: number; step: number }[] = [
  { key: 'opacity', label: 'Ripple overlay opacity', min: 0, max: 1, step: 0.01 },
  { key: 'verticalPosition', label: 'Vertical position', min: -0.35, max: 0.35, step: 0.01 },
  { key: 'verticalScale', label: 'Vertical scale', min: 0.5, max: 1.8, step: 0.01 },
  { key: 'blendIntensity', label: 'Blend intensity', min: 0, max: 2, step: 0.01 },
  { key: 'fadeHeight', label: 'Fade / mask height', min: 0.15, max: 0.7, step: 0.01 },
]
rippleControlList.innerHTML = rippleControls.map(({ key, label, min, max, step }) => `
  <label class="control">
    <span class="control-heading"><span>${label}</span><output data-ripple-value="${key}"></output></span>
    <input type="range" data-ripple-setting="${key}" min="${min}" max="${max}" step="${step}" value="${rippleSettings[key]}" aria-label="${label}" />
  </label>
`).join('')

function applyRippleSettings() {
  hero.style.setProperty('--ripple-opacity', String(rippleSettings.opacity))
  hero.style.setProperty('--ripple-position', `${-rippleSettings.verticalPosition * 100}%`)
  hero.style.setProperty('--ripple-scale', String(rippleSettings.verticalScale))
  hero.style.setProperty('--ripple-blend', String(rippleSettings.blendIntensity))
  hero.style.setProperty('--ripple-fade-height', `${rippleSettings.fadeHeight * 100}%`)
  for (const { key } of rippleControls) {
    rippleControlList.querySelector<HTMLInputElement>(`[data-ripple-setting="${key}"]`)!.value = String(rippleSettings[key])
    rippleControlList.querySelector<HTMLOutputElement>(`[data-ripple-value="${key}"]`)!.value = rippleSettings[key].toFixed(2)
  }
}
applyRippleSettings()

const sphereSettings: SphereSettings = { ...sphereDefaults, ...sceneConfig.spheres } as SphereSettings
sphereSettings.positions = { ...sphereSettings.positions }
sphereSettings.scales = { ...sphereSettings.scales }
sphereSettings.rotations = { ...sphereSettings.rotations }
type SphereNumberKey = Exclude<keyof SphereSettings, 'positions' | 'scales' | 'rotations'>
const sphereControls: { key: SphereNumberKey; label: string; min: number; max: number; step: number }[] = [
  { key: 'count', label: 'Overall count', min: 30, max: 60, step: 1 },
  { key: 'spread', label: 'Spread', min: 0.65, max: 1.7, step: 0.01 },
  { key: 'scaleMin', label: 'Minimum scale', min: 0.03, max: 0.5, step: 0.01 },
  { key: 'scaleMax', label: 'Maximum scale', min: 0.2, max: 1.1, step: 0.01 },
  { key: 'depth', label: 'Depth', min: 1, max: 9, step: 0.1 },
  { key: 'hoverRotationSpeed', label: 'Hover rotation speed (°/s)', min: 0, max: 360, step: 1 },
]
sphereControlList.innerHTML = sphereControls.map(({ key, label, min, max, step }) => `
  <label class="control">
    <span class="control-heading"><span>${label}</span><output data-sphere-value="${key}"></output></span>
    <input type="range" data-sphere-setting="${key}" min="${min}" max="${max}" step="${step}" value="${sphereSettings[key]}" aria-label="${label}" />
  </label>
`).join('')

let autoSaveTimer: number | undefined
const history: SceneConfig[] = []
let historyIndex = -1
let restoringHistory = false

function rememberScene() {
  if (restoringHistory || !creatorMode) return
  const snapshot = currentSceneConfig()
  if (historyIndex >= 0 && JSON.stringify(history[historyIndex]) === JSON.stringify(snapshot)) return
  history.splice(historyIndex + 1)
  history.push(snapshot)
  if (history.length > 50) history.shift()
  historyIndex = history.length - 1
}

function currentSceneConfig(): SceneConfig {
  return stampSceneConfig({
    ...sceneConfig,
    bottle: { ...settings } as unknown as JsonObject,
    spheres: { ...sphereSettings } as unknown as JsonObject,
    ripples: { ...rippleSettings } as unknown as JsonObject,
    studio: { ...studioSettings } as unknown as JsonObject,
  })
}

function scheduleAutoSaveScene() {
  if (!creatorMode) return
  window.clearTimeout(autoSaveTimer)
  autoSaveTimer = window.setTimeout(() => {
    sceneConfig = currentSceneConfig()
    storeSceneConfig(ACTIVE_SCENE_KEY, sceneConfig)
    rememberScene()
    sceneConfigStatus.textContent = 'Current scene auto-saved.'
  }, 120)
}

function requestParticleConfig(): Promise<ParticleSceneConfig> {
  if (!particleReady || !particleFrame.contentWindow) return Promise.resolve(sceneConfig.particles)
  const requestId = crypto.randomUUID()
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      particleRequests.delete(requestId)
      resolve(sceneConfig.particles)
    }, 1500)
    particleRequests.set(requestId, (config) => {
      window.clearTimeout(timeout)
      resolve(config)
    })
    particleFrame.contentWindow?.postMessage({ type: 'nocturne:particle-config-request', requestId }, location.origin)
  })
}

async function captureSceneConfig() {
  const particles = await requestParticleConfig()
  sceneConfig.particles = particles
  sceneConfig = currentSceneConfig()
  return sceneConfig
}

function applySceneConfig(raw: unknown, message: string) {
  sceneConfig = migrateSceneConfig(raw, productionConfig)
  Object.assign(studioSettings, sceneConfig.studio)
  Object.assign(settings, sceneConfig.bottle)
  Object.assign(sphereSettings, sceneConfig.spheres)
  Object.assign(rippleSettings, sceneConfig.ripples)
  applySettings()
  applySphereSettings()
  applyRippleSettings()
  applyStudioSettings()
  if (particleReady) {
    particleFrame.contentWindow?.postMessage({ type: 'nocturne:scene-config-apply', config: sceneConfig.particles }, location.origin)
  }
  storeSceneConfig(ACTIVE_SCENE_KEY, sceneConfig)
  rememberScene()
  sceneConfigStatus.textContent = message
}

const presetKey = 'nocturne.creator-presets'
function readPresets(): Record<string, SceneConfig> {
  const raw = parseSceneConfig(localStorage.getItem(presetKey))
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, SceneConfig> : {}
}
function savePresets(presets: Record<string, SceneConfig>) { localStorage.setItem(presetKey, JSON.stringify(presets)) }
app.querySelector<HTMLButtonElement>('[data-creator-action="preview"]')!.addEventListener('click', () => {
  setStudioOpen(false)
  document.documentElement.classList.add('creator-preview')
  studioToggle.textContent = 'Exit Preview'
})
studioToggle.addEventListener('click', () => {
  if (document.documentElement.classList.contains('creator-preview')) {
    document.documentElement.classList.remove('creator-preview')
    studioToggle.textContent = 'Creator Studio'
    setStudioOpen(true)
  }
})
for (const [action, step] of [['undo', -1], ['redo', 1]] as const) {
  app.querySelector<HTMLButtonElement>(`[data-creator-action="${action}"]`)!.addEventListener('click', () => {
    const next = historyIndex + step
    if (next < 0 || next >= history.length) return
    historyIndex = next
    restoringHistory = true
    applySceneConfig(history[next], `${action === 'undo' ? 'Undid' : 'Redid'} scene edit.`)
    restoringHistory = false
  })
}
app.querySelector<HTMLButtonElement>('[data-scene-action="preset-save"]')!.addEventListener('click', async () => {
  const name = prompt('Name this scene preset:')?.trim()
  if (!name) return
  const presets = readPresets()
  presets[name] = await captureSceneConfig()
  savePresets(presets)
  sceneConfigStatus.textContent = `Preset “${name}” saved locally.`
})
app.querySelector<HTMLButtonElement>('[data-scene-action="preset-load"]')!.addEventListener('click', () => {
  const presets = readPresets()
  const name = prompt(`Load preset:\n${Object.keys(presets).join('\n')}`)?.trim()
  if (name && presets[name]) applySceneConfig(presets[name], `Preset “${name}” loaded.`)
})
app.querySelector<HTMLButtonElement>('[data-scene-action="preset-duplicate"]')!.addEventListener('click', () => {
  const presets = readPresets()
  const source = prompt(`Duplicate which preset?\n${Object.keys(presets).join('\n')}`)?.trim()
  if (!source || !presets[source]) return
  const target = prompt('New preset name:')?.trim()
  if (!target) return
  presets[target] = structuredClone(presets[source])
  savePresets(presets)
  sceneConfigStatus.textContent = `Preset “${target}” created.`
})
app.querySelector<HTMLButtonElement>('[data-scene-action="reset-all"]')!.addEventListener('click', () => applySceneConfig(productionConfig, 'Scene reset to production defaults.'))

function downloadSceneConfig(config: SceneConfig, filename: string) {
  const blob = new Blob([`${JSON.stringify(config, null, 2)}\n`], { type: 'application/json' })
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(href)
}

function isSceneConfigFile(raw: unknown) {
  return Boolean(raw && typeof raw === 'object' && (raw as { format?: unknown }).format === SCENE_CONFIG_FORMAT)
}

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(defaults.cameraFov, 1, 0.1, 100)
camera.position.z = defaults.cameraDistance

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1
renderer.setClearColor(0x000000, 0)
sceneLayer.append(renderer.domElement)

const bottleRendering = createBottleRendering(renderer, scene, camera, video, cavernUrl, rippleSettings)

const keyLight = new THREE.DirectionalLight(0xffe9ce, defaults.keyLightIntensity)
keyLight.position.set(-3, 5, 6)
scene.add(keyLight)

const fillLight = new THREE.DirectionalLight(0xffe1b8, 0.45)
fillLight.position.set(4, 2, -3)
scene.add(fillLight)
const rimLight = new THREE.DirectionalLight(0xffd4a3, 0)
rimLight.position.set(0, 3, -5)
scene.add(rimLight)
const studioFields: { group: string; key: StudioKey; label: string; min?: number; max?: number; step?: number }[] = [
  { group: 'bottle', key: 'glassTint', label: 'Glass tint' },
  { group: 'bottle', key: 'glassRoughness', label: 'Glass roughness', min: 0, max: 0.5, step: 0.001 },
  { group: 'bottle', key: 'glassIor', label: 'Glass refraction index', min: 1, max: 2.2, step: 0.01 },
  { group: 'bottle', key: 'glassTransmission', label: 'Glass transmission', min: 0, max: 1, step: 0.01 },
  { group: 'bottle', key: 'liquidColor', label: 'Amber liquid color' },
  { group: 'bottle', key: 'liquidAbsorption', label: 'Liquid absorption distance', min: 0.05, max: 3, step: 0.01 },
  { group: 'bottle', key: 'capTint', label: 'Crystal cap tint' },
  { group: 'bottle', key: 'goldColor', label: 'Gold color' },
  { group: 'bottle', key: 'autoRotation', label: 'Auto rotation' },
  { group: 'bottle', key: 'autoRotationSpeed', label: 'Auto rotation speed', min: 0, max: 40, step: 0.1 },
  { group: 'bottle', key: 'dragSensitivity', label: 'Drag sensitivity', min: 0.05, max: 2, step: 0.01 },
  { group: 'bottle', key: 'inertia', label: 'Inertia', min: 0, max: 1, step: 0.01 },
  { group: 'bottle', key: 'damping', label: 'Damping', min: 0.1, max: 12, step: 0.1 },
  { group: 'bottle', key: 'maxRotationSpeed', label: 'Maximum spin speed', min: 10, max: 720, step: 1 },
  { group: 'lighting', key: 'keyColor', label: 'Key light color' },
  { group: 'lighting', key: 'fillColor', label: 'Fill light color' },
  { group: 'lighting', key: 'fillIntensity', label: 'Fill light intensity', min: 0, max: 5, step: 0.01 },
  { group: 'lighting', key: 'rimIntensity', label: 'Rim light intensity', min: 0, max: 5, step: 0.01 },
  { group: 'lighting', key: 'exposure', label: 'Exposure', min: 0.3, max: 2.5, step: 0.01 },
  { group: 'atmosphere', key: 'backgroundBrightness', label: 'Background brightness', min: 0.3, max: 2, step: 0.01 },
  { group: 'atmosphere', key: 'backgroundSaturation', label: 'Background saturation', min: 0, max: 2, step: 0.01 },
  { group: 'atmosphere', key: 'backgroundContrast', label: 'Background contrast', min: 0.5, max: 2, step: 0.01 },
  { group: 'camera', key: 'cameraX', label: 'Camera X', min: -2, max: 2, step: 0.01 },
  { group: 'camera', key: 'cameraY', label: 'Camera Y', min: -2, max: 2, step: 0.01 },
]
for (const field of studioFields) {
  const value = studioSettings[field.key]
  const type = typeof value === 'boolean' ? 'checkbox' : typeof value === 'string' ? 'color' : 'range'
  const list = app.querySelector<HTMLElement>(`[data-creator-group="${field.group}"]`)!
  list.insertAdjacentHTML('beforeend', `<label class="creator-control"><span>${field.label}</span><input type="${type}" data-studio-key="${field.key}" ${type === 'checkbox' ? (value ? 'checked' : '') : `value="${value}"`} ${field.min === undefined ? '' : `min="${field.min}" max="${field.max}" step="${field.step}"`} /><output>${type === 'range' ? value : ''}</output></label>`)
}
function applyStudioSettings() {
  bottleRendering.tune(studioSettings)
  keyLight.color.set(studioSettings.keyColor)
  fillLight.color.set(studioSettings.fillColor)
  fillLight.intensity = studioSettings.fillIntensity
  rimLight.intensity = studioSettings.rimIntensity
  renderer.toneMappingExposure = studioSettings.exposure
  app!.querySelector<HTMLImageElement>('.hero-cavern')!.style.filter = `brightness(${studioSettings.backgroundBrightness}) saturate(${studioSettings.backgroundSaturation}) contrast(${studioSettings.backgroundContrast})`
  camera.position.x = studioSettings.cameraX
  camera.position.y = studioSettings.cameraY
  camera.lookAt(studioSettings.cameraX, studioSettings.cameraY, 0)
  camera.updateProjectionMatrix()
  if (!creatorMode) return
  for (const field of studioFields) {
    const input = app!.querySelector<HTMLInputElement>(`[data-studio-key="${field.key}"]`)!
    const value = studioSettings[field.key]
    if (typeof value === 'boolean') input.checked = value
    else input.value = String(value)
    input.nextElementSibling!.textContent = typeof value === 'number' ? value.toFixed(2) : ''
  }
}
app.querySelector<HTMLElement>('.studio-panel')!.addEventListener('input', (event) => {
  const input = event.target as HTMLInputElement
  const key = input.dataset.studioKey as StudioKey | undefined
  if (!key) return
  ;(studioSettings as Record<StudioKey, string | number | boolean>)[key] = input.type === 'checkbox' ? input.checked : input.type === 'color' ? input.value : Number(input.value)
  applyStudioSettings()
  scheduleAutoSaveScene()
})

const bottleRoot = new THREE.Group()
scene.add(bottleRoot)
const bottleDragTarget = app.querySelector<HTMLDivElement>('.bottle-drag-target')!
let bottleSize: THREE.Vector3 | null = null
let baseScale = 1
let sphereComposition: ReturnType<typeof createSphereComposition> | null = null
const sphereSelection = app.querySelector<HTMLParagraphElement>('.sphere-selection')!
app.querySelector<HTMLDetailsElement>('.sphere-editor')!.addEventListener('toggle', (event) => {
  document.documentElement.classList.toggle('sphere-editing', creatorMode && (event.target as HTMLDetailsElement).open)
})
const spherePositionList = app.querySelector<HTMLDivElement>('.sphere-position-list')!
let selectedSphere = -1
let draggedSphere = -1
let dragOffset = new THREE.Vector3()
const sphereDragPlane = new THREE.Plane()
const sphereDragRay = new THREE.Raycaster()
const spherePointer = new THREE.Vector2()
const sphereHit = new THREE.Vector3()

function showSelectedSphere() {
  if (selectedSphere < 0 || !sphereComposition) {
    sphereSelection.textContent = 'Select a sphere in the scene to edit its position.'
    spherePositionList.hidden = true
    return
  }
  const point = sphereComposition.positionOf(selectedSphere)
  if (!point) return
  sphereSelection.textContent = `Sphere ${selectedSphere + 1} selected. Drag it in the scene, or adjust X, Y and depth below.`
  spherePositionList.hidden = false
  spherePositionList.innerHTML = (['x', 'y', 'z'] as const).map((axis) => `
    <label class="control"><span class="control-heading"><span>Position ${axis.toUpperCase()}</span><output>${point[axis].toFixed(2)}</output></span>
    <input type="range" data-sphere-axis="${axis}" min="${axis === 'z' ? -6 : -8}" max="${axis === 'z' ? 6 : 8}" step="0.01" value="${point[axis]}" /></label>
  `).join('') + `<label class="control"><span class="control-heading"><span>Scale</span><output>${(sphereSettings.scales[String(selectedSphere)] ?? 1).toFixed(2)}</output></span><input type="range" data-sphere-transform="scale" min="0.2" max="3" step="0.01" value="${sphereSettings.scales[String(selectedSphere)] ?? 1}" /></label><label class="control"><span class="control-heading"><span>Y rotation</span><output>${(sphereSettings.rotations[String(selectedSphere)] ?? 0).toFixed(0)}</output></span><input type="range" data-sphere-transform="rotation" min="-180" max="180" step="1" value="${sphereSettings.rotations[String(selectedSphere)] ?? 0}" /></label>`
}

spherePositionList.addEventListener('input', (event) => {
  if (selectedSphere < 0) return
  const input = event.target as HTMLInputElement
  const axis = input.dataset.sphereAxis as 'x' | 'y' | 'z' | undefined
  if (!axis) {
    if (input.dataset.sphereTransform === 'scale') sphereSettings.scales[String(selectedSphere)] = Number(input.value)
    else if (input.dataset.sphereTransform === 'rotation') sphereSettings.rotations[String(selectedSphere)] = Number(input.value)
    else return
    sphereComposition?.update(sphereSettings)
    input.parentElement!.querySelector('output')!.value = input.value
    scheduleAutoSaveScene()
    return
  }
  const point = sphereComposition?.positionOf(selectedSphere)
  if (!point) return
  point[axis] = Number(input.value)
  sphereSettings.positions[String(selectedSphere)] = { x: point.x, y: point.y, z: point.z }
  sphereComposition?.update(sphereSettings)
  input.parentElement!.querySelector('output')!.value = point[axis].toFixed(2)
  scheduleAutoSaveScene()
})

function rayAt(event: PointerEvent) {
  const rect = sceneLayer.getBoundingClientRect()
  spherePointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1)
  sphereDragRay.setFromCamera(spherePointer, camera)
  return rect
}

window.addEventListener('pointermove', (event) => {
  if (!creatorMode || !document.documentElement.classList.contains('sphere-editing') || !sphereComposition) return
  const rect = rayAt(event)
  if (draggedSphere >= 0) {
    if (sphereDragRay.ray.intersectPlane(sphereDragPlane, sphereHit)) {
      const point = sphereHit.clone().add(dragOffset)
      sphereSettings.positions[String(draggedSphere)] = { x: point.x, y: point.y, z: point.z }
      sphereComposition.update(sphereSettings)
      particleFrame.contentWindow?.postMessage({ type: 'nocturne:sphere-drag', active: true, x: event.clientX, y: event.clientY }, location.origin)
      showSelectedSphere()
      scheduleAutoSaveScene()
    }
  } else {
    const index = sphereComposition.pick(event.clientX, event.clientY, rect)
    sphereComposition.setHovered(index)
    renderer.domElement.style.cursor = index >= 0 ? 'grab' : ''
  }
})
window.addEventListener('pointerdown', (event) => {
  if (!creatorMode || !document.documentElement.classList.contains('sphere-editing') || event.button !== 0 || !sphereComposition || !(event.target instanceof Element)) return
  if (!event.target.closest('.site-hero') || event.target.closest('.bottle-drag-target, .hero-copy, button, a')) return
  const rect = rayAt(event)
  const index = sphereComposition.pick(event.clientX, event.clientY, rect)
  if (index < 0) return
  selectedSphere = draggedSphere = index
  sphereComposition.setHovered(index)
  const point = sphereComposition.positionOf(index)!
  sphereDragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), point)
  sphereDragRay.ray.intersectPlane(sphereDragPlane, sphereHit)
  dragOffset = point.clone().sub(sphereHit)
  showSelectedSphere()
  event.preventDefault()
})
window.addEventListener('pointerup', () => { draggedSphere = -1; particleFrame.contentWindow?.postMessage({ type: 'nocturne:sphere-drag', active: false }, location.origin) })
window.addEventListener('pointercancel', () => { draggedSphere = -1; particleFrame.contentWindow?.postMessage({ type: 'nocturne:sphere-drag', active: false }, location.origin) })
let idleYaw = 0
let lastFrameTime = 0
let resumeIdleAt = 0
let draggingBottle = false
let lastPointerX = 0
let lastPointerTime = 0
let yawVelocity = 0

function updateBottleDragTarget() {
  if (!bottleSize) return
  const width = sceneLayer.clientWidth
  const height = sceneLayer.clientHeight
  const distance = Math.max(camera.position.z - bottleRoot.position.z, 0.5)
  const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance
  const viewWidth = viewHeight * camera.aspect
  const center = bottleRoot.position.clone().project(camera)
  const bottleWidth = bottleSize.x * baseScale * settings.scale / viewWidth * width
  const bottleHeight = bottleSize.y * baseScale * settings.scale / viewHeight * height
  bottleDragTarget.style.left = `${(center.x + 1) * width / 2}px`
  bottleDragTarget.style.top = `${(1 - center.y) * height / 2}px`
  bottleDragTarget.style.width = `${Math.min(width, bottleWidth * 1.18)}px`
  bottleDragTarget.style.height = `${Math.min(height, bottleHeight * 1.08)}px`
  bottleDragTarget.hidden = false
}

function stopBottleDrag(event: PointerEvent) {
  if (!draggingBottle) return
  draggingBottle = false
  if (bottleDragTarget.hasPointerCapture(event.pointerId)) bottleDragTarget.releasePointerCapture(event.pointerId)
  resumeIdleAt = performance.now() + 3000
  scheduleAutoSaveScene()
}

bottleDragTarget.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return
  draggingBottle = true
  lastPointerX = event.clientX
  lastPointerTime = performance.now()
  yawVelocity = 0
  bottleDragTarget.setPointerCapture(event.pointerId)
  event.preventDefault()
})
bottleDragTarget.addEventListener('pointermove', (event) => {
  if (!draggingBottle) return
  const delta = event.clientX - lastPointerX
  const now = performance.now()
  const dt = Math.max((now - lastPointerTime) / 1000, 0.008)
  lastPointerTime = now
  lastPointerX = event.clientX
  const angularDelta = delta * studioSettings.dragSensitivity
  yawVelocity = THREE.MathUtils.clamp(angularDelta / dt, -studioSettings.maxRotationSpeed, studioSettings.maxRotationSpeed)
  settings.rotationY = THREE.MathUtils.euclideanModulo(settings.rotationY + angularDelta + 180, 360) - 180
  applySettings()
  scheduleAutoSaveScene()
})
bottleDragTarget.addEventListener('pointerup', stopBottleDrag)
bottleDragTarget.addEventListener('pointercancel', stopBottleDrag)
bottleDragTarget.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  settings.rotationY = THREE.MathUtils.euclideanModulo(settings.rotationY + (event.key === 'ArrowRight' ? 10 : -10) + 180, 360) - 180
  applySettings()
  scheduleAutoSaveScene()
  resumeIdleAt = performance.now() + 3000
  event.preventDefault()
})

function frameBottle() {
  if (!bottleSize) return
  const aspect = sceneLayer.clientWidth / Math.max(sceneLayer.clientHeight, 1)
  const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(defaults.cameraFov / 2)) * defaults.cameraDistance
  const viewWidth = viewHeight * aspect
  baseScale = Math.min(
    (viewHeight * 0.74) / Math.max(bottleSize.y, 0.001),
    (viewWidth * 0.72) / Math.max(bottleSize.x, 0.001),
  )
  applySettings()
}

function applySettings() {
  bottleRoot.position.set(settings.positionX, settings.positionY, settings.positionZ)
  bottleRoot.scale.setScalar(baseScale * settings.scale)
  bottleRoot.rotation.set(
    THREE.MathUtils.degToRad(settings.rotationX),
    THREE.MathUtils.degToRad(settings.rotationY) + idleYaw,
    THREE.MathUtils.degToRad(settings.rotationZ),
  )
  camera.fov = settings.cameraFov
  camera.position.z = settings.cameraDistance
  camera.updateProjectionMatrix()
  scene.environmentIntensity = settings.environmentIntensity
  keyLight.intensity = settings.keyLightIntensity
  for (const { key, unit } of controls) {
    const input = controlList.querySelector<HTMLInputElement>(`[data-setting="${key}"]`)!
    const output = controlList.querySelector<HTMLOutputElement>(`[data-value="${key}"]`)!
    input.value = String(settings[key])
    output.value = settings[key].toFixed(Number.isInteger(settings[key]) ? 0 : 2) + (unit ?? '')
  }
  sphereComposition?.update(sphereSettings)
  updateBottleDragTarget()
}

function applySphereSettings() {
  if (sphereSettings.scaleMin > sphereSettings.scaleMax) {
    sphereSettings.scaleMin = sphereSettings.scaleMax
  }
  sphereComposition?.update(sphereSettings)
  for (const { key } of sphereControls) {
    const input = sphereControlList.querySelector<HTMLInputElement>(`[data-sphere-setting="${key}"]`)!
    const output = sphereControlList.querySelector<HTMLOutputElement>(`[data-sphere-value="${key}"]`)!
    input.value = String(sphereSettings[key])
    output.value = key === 'count' ? String(Math.round(sphereSettings[key])) : sphereSettings[key].toFixed(2)
  }
}

function resize() {
  const width = Math.max(sceneLayer.clientWidth, 1)
  const height = Math.max(sceneLayer.clientHeight, 1)
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  frameBottle()
}
window.addEventListener('resize', resize)
resize()

controlList.addEventListener('input', (event) => {
  const input = event.target as HTMLInputElement
  const key = input.dataset.setting as keyof Settings | undefined
  if (!key) return
  settings[key] = Number(input.value)
  applySettings()
  scheduleAutoSaveScene()
})

sphereControlList.addEventListener('input', (event) => {
  const input = event.target as HTMLInputElement
  const key = input.dataset.sphereSetting as SphereNumberKey | undefined
  if (!key) return
  sphereSettings[key] = Number(input.value)
  applySphereSettings()
  scheduleAutoSaveScene()
})

rippleControlList.addEventListener('input', (event) => {
  const input = event.target as HTMLInputElement
  const key = input.dataset.rippleSetting as keyof RippleSettings | undefined
  if (!key) return
  rippleSettings[key] = Number(input.value)
  applyRippleSettings()
  scheduleAutoSaveScene()
})

app.querySelector<HTMLButtonElement>('[data-ripple-action="reset"]')!.addEventListener('click', () => {
  Object.assign(rippleSettings, rippleDefaults)
  applyRippleSettings()
  rippleEditorMessage.textContent = 'Floor ripples reset.'
  scheduleAutoSaveScene()
})

app.querySelector<HTMLButtonElement>('[data-sphere-action="reset"]')!.addEventListener('click', () => {
  Object.assign(sphereSettings, sphereDefaults)
  sphereSettings.positions = {}
  sphereSettings.scales = {}
  sphereSettings.rotations = {}
  selectedSphere = -1
  applySphereSettings()
  showSelectedSphere()
  sphereEditorMessage.textContent = 'Sphere settings reset.'
  scheduleAutoSaveScene()
})

app.querySelector<HTMLButtonElement>('[data-action="reset"]')!.addEventListener('click', () => {
  Object.assign(settings, defaults)
  applySettings()
  editorMessage.textContent = 'Settings reset.'
  scheduleAutoSaveScene()
})

app.querySelector<HTMLButtonElement>('[data-action="copy"]')!.addEventListener('click', async () => {
  const snapshot = JSON.stringify(settings, null, 2)
  try {
    await navigator.clipboard.writeText(snapshot)
    editorMessage.textContent = 'Settings copied to clipboard.'
  } catch {
    editorMessage.textContent = 'Clipboard unavailable. Settings: ' + snapshot
  }
})

app.querySelector<HTMLButtonElement>('[data-scene-action="save"]')!.addEventListener('click', async () => {
  const config = await captureSceneConfig()
  storeSceneConfig(ACTIVE_SCENE_KEY, config)
  storeSceneConfig(SAVED_SCENE_KEY, config)
  sceneConfigStatus.textContent = 'Scene saved in this browser.'
})

app.querySelector<HTMLButtonElement>('[data-scene-action="load"]')!.addEventListener('click', () => {
  const saved = parseSceneConfig(localStorage.getItem(SAVED_SCENE_KEY))
  if (!saved) {
    sceneConfigStatus.textContent = 'No manually saved scene is available yet.'
    return
  }
  applySceneConfig(saved, 'Saved scene loaded.')
})

app.querySelector<HTMLButtonElement>('[data-scene-action="default"]')!.addEventListener('click', async () => {
  const config = await captureSceneConfig()
  storeSceneConfig(ACTIVE_SCENE_KEY, config)
  storeSceneConfig(DEFAULT_SCENE_KEY, config)
  downloadSceneConfig(config, 'nocturne-scene-config.default.json')
  sceneConfigStatus.textContent = 'Default saved locally and exported for production.'
})

app.querySelector<HTMLButtonElement>('[data-scene-action="export"]')!.addEventListener('click', async () => {
  const config = await captureSceneConfig()
  const json = JSON.stringify(config, null, 2)
  try {
    await navigator.clipboard.writeText(json)
    sceneConfigStatus.textContent = 'Scene config copied and exported.'
  } catch {
    sceneConfigStatus.textContent = 'Scene config exported. Clipboard access was unavailable.'
  }
  downloadSceneConfig(config, 'nocturne-scene-config.json')
})

app.querySelector<HTMLButtonElement>('[data-scene-action="import"]')!.addEventListener('click', () => sceneImport.click())
sceneImport.addEventListener('change', async () => {
  const file = sceneImport.files?.[0]
  sceneImport.value = ''
  if (!file) return
  try {
    const raw = JSON.parse(await file.text()) as unknown
    if (!isSceneConfigFile(raw)) throw new Error('Unsupported scene config format')
    applySceneConfig(raw, 'Imported scene applied and auto-saved.')
    storeSceneConfig(SAVED_SCENE_KEY, sceneConfig)
  } catch {
    sceneConfigStatus.textContent = 'Import failed. Choose a Nocturne scene-config JSON file.'
  }
})

new GLTFLoader().load(
  new URL('../Public/Assets/Models/nocturne-bottle.glb', import.meta.url).href,
  (gltf) => {
    const bottle = gltf.scene
    bottleRendering.configure(bottle)
    const bounds = new THREE.Box3().setFromObject(bottle)
    bottleSize = bounds.getSize(new THREE.Vector3())
    bottle.position.sub(bounds.getCenter(new THREE.Vector3()))
    bottleRoot.add(bottle)
    applyStudioSettings()
    frameBottle()
    loadStatus.remove()
  },
  undefined,
  (error) => {
    console.error('Bottle loading failed:', error)
    loadStatus.textContent = 'The bottle could not be loaded.'
  },
)

new GLTFLoader().load(
  new URL('../Public/Assets/Models/nocturne-spheres.glb', import.meta.url).href,
  (gltf) => {
    sphereComposition = createSphereComposition(scene, camera, gltf.scene)
    applySphereSettings()
    showSelectedSphere()
  },
  undefined,
  (error) => {
    console.error('Sphere loading failed:', error)
    sphereEditorMessage.textContent = 'The sphere library could not be loaded.'
  },
)

if (import.meta.env.DEV) {
  Object.assign(window, {
    __nocturneBottle: { audit: bottleRendering.audit, renderer, scene, camera },
    __nocturneSpheres: { audit: () => sphereComposition?.audit(), settings: sphereSettings },
    __nocturneRipples: { settings: rippleSettings },
  })
}
rememberScene()
if (!creatorMode) studioPanel.remove()
renderer.setAnimationLoop((time) => {
  sphereComposition?.tick(lastFrameTime ? (time - lastFrameTime) / 1000 : 0, sphereSettings)
  if (lastFrameTime && !draggingBottle && !document.hidden) {
    const dt = Math.min((time - lastFrameTime) / 1000, 0.1)
    if (Math.abs(yawVelocity) > 0.01) {
      settings.rotationY = THREE.MathUtils.euclideanModulo(settings.rotationY + yawVelocity * dt + 180, 360) - 180
      yawVelocity *= Math.exp(-studioSettings.damping * (1 - studioSettings.inertia * 0.9) * dt)
      if (Math.abs(yawVelocity) < 0.1) { yawVelocity = 0; scheduleAutoSaveScene() }
    } else if (time >= resumeIdleAt && studioSettings.autoRotation) {
      idleYaw += dt * THREE.MathUtils.degToRad(studioSettings.autoRotationSpeed)
    }
    bottleRoot.rotation.y = THREE.MathUtils.degToRad(settings.rotationY) + idleYaw
  }
  lastFrameTime = time
  bottleRendering.render()
})
