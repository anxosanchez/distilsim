/**
 * Vista 3D da columna de destilación (Three.js).
 *
 * Representación realista cunha carcasa transparente para ver no interior:
 *  - cada prato coloreado pola súa temperatura (escala azul → vermello),
 *  - burbullas de vapor ascendentes,
 *  - condensador (total/parcial) e refervedor con chama,
 *  - tuberías de alimentación, destilado, refluxo e fondos cos seus cabais,
 *  - etiquetas de temperatura/composición por prato,
 *  - tooltip interactivo ao pasar o rato sobre un prato,
 *  - panel de datos en vivo (x_D, x_B, T, D, B, Q_R…).
 *
 * Cámara: arrastrar co rato esquerdo rota, roda = zoom, botón dereito = desprazar.
 * A simulación é a compartida co Simulador (appEngine).
 */

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { appEngine } from './engineStore'
import type { SimSnapshot } from './engine'
import { useI18n } from '../i18n'

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

/** Cor de temperatura: azul (frío) → vermello (quente) na escala HSL. */
function tempColor(T: number, tMin: number, tMax: number): THREE.Color {
  const f = Math.min(1, Math.max(0, (T - tMin) / (tMax - tMin + 1e-9)))
  return new THREE.Color().setHSL(0.66 * (1 - f), 0.9, 0.5)
}

/** Etiqueta de texto 3D (sprite) con canvas reutilizable para actualización en vivo. */
function makeLabel(initial = ''): { sprite: THREE.Sprite; update: (text: string) => void } {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 192
  const ctx = canvas.getContext('2d')!
  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(2.4, 0.45, 1)

  const draw = (text: string) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.font = '300 34px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(220,226,233,0.92)'
    const lines = text.split('\n')
    lines.forEach((line, i) => {
      ctx.fillText(line, canvas.width / 2, canvas.height / 2 + (i - (lines.length - 1) / 2) * 40)
    })
    texture.needsUpdate = true
  }
  if (initial) draw(initial)
  return { sprite, update: draw }
}

/* ------------------------------------------------------------------ */
/* Compoñente                                                          */
/* ------------------------------------------------------------------ */

const COL_RADIUS = 1.6
const COL_HEIGHT = 8

export function Column3D() {
  const { t } = useI18n()
  const mountRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ tray: number; T: number; x: number[] } | null>(null)
  const [stats, setStats] = useState<SimSnapshot | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const engine = appEngine

    /* --- Escena / cámara / renderer --- */
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b0f16)
    scene.fog = new THREE.Fog(0x0b0f16, 24, 42)

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.set(9.5, 4.5, 11)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.7
    controls.minDistance = 4
    controls.maxDistance = 30
    controls.target.set(0, 0, 0)

    /* --- Luces --- */
    scene.add(new THREE.AmbientLight(0xffffff, 0.55))
    const key = new THREE.DirectionalLight(0xffffff, 1.1)
    key.position.set(8, 12, 9)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x6fa8ff, 0.5)
    rim.position.set(-7, 3, -6)
    scene.add(rim)
    const floorLight = new THREE.PointLight(0xff8844, 1.6, 12)
    floorLight.position.set(0, -6.2, 0)
    scene.add(floorLight)

    /* --- Chan (reixa) --- */
    const grid = new THREE.GridHelper(22, 22, 0x2d333b, 0x1c2330)
    grid.position.y = -5.6
    scene.add(grid)

    const disposables: Array<{ dispose: () => void }> = []
    const track = <T extends { dispose: () => void }>(o: T): T => {
      disposables.push(o)
      return o
    }

    /* --- Carcasa da columna (transparente) --- */
    const shell = new THREE.Mesh(
      track(new THREE.CylinderGeometry(COL_RADIUS, COL_RADIUS, COL_HEIGHT, 64, 1, true)),
      track(new THREE.MeshPhysicalMaterial({
        color: 0xaac3e0,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        roughness: 0.15,
        metalness: 0.7,
        depthWrite: false,
      })),
    )
    scene.add(shell)

    // Aros superior e inferior (bordes metálicos)
    const addRing = (y: number, r: number) => {
      const ring = new THREE.Mesh(
        track(new THREE.TorusGeometry(r, 0.06, 12, 48)),
        track(new THREE.MeshStandardMaterial({ color: 0x8aa2bd, metalness: 0.9, roughness: 0.3 })),
      )
      ring.position.y = y
      ring.rotation.x = Math.PI / 2
      scene.add(ring)
    }
    addRing(COL_HEIGHT / 2, COL_RADIUS)
    addRing(-COL_HEIGHT / 2, COL_RADIUS)

    /* --- Platos (discos) --- */
    const trayMeshes: THREE.Mesh[] = []
    const trayMaterials: THREE.MeshStandardMaterial[] = []
    const nTrays = engine.config.nTrays
    const trayGap = (COL_HEIGHT - 1.8) / Math.max(1, nTrays - 1)
    for (let j = 0; j < nTrays; j++) {
      const mat = track(new THREE.MeshStandardMaterial({ color: 0x4a6fa5, roughness: 0.5, metalness: 0.2 }))
      const mesh = new THREE.Mesh(track(new THREE.CylinderGeometry(COL_RADIUS - 0.12, COL_RADIUS - 0.12, 0.07, 40)), mat)
      const yTop = COL_HEIGHT / 2 - 0.9
      mesh.position.y = yTop - j * trayGap
      mesh.userData.trayIndex = j
      scene.add(mesh)
      trayMaterials.push(mat)
      trayMeshes.push(mesh)

      // Líquido sobre o prato (disco lixeiramente máis alto)
      const liq = new THREE.Mesh(
        track(new THREE.CylinderGeometry(COL_RADIUS - 0.2, COL_RADIUS - 0.2, 0.045, 40)),
        track(new THREE.MeshStandardMaterial({ color: 0x3f7fbf, transparent: true, opacity: 0.85, roughness: 0.25, metalness: 0.1 })),
      )
      liq.position.y = mesh.position.y + 0.055
      scene.add(liq)
      trayMaterials.push(liq.material as THREE.MeshStandardMaterial)
      trayMeshes.push(liq)
    }

    /* --- Etiquetas de temperatura por prato --- */
    const trayLabels: Array<{ sprite: THREE.Sprite; update: (text: string) => void }> = []
    for (let j = 0; j < nTrays; j++) {
      const label = makeLabel()
      const yTop = COL_HEIGHT / 2 - 0.9
      label.sprite.position.set(COL_RADIUS + 1.15, yTop - j * trayGap, 0)
      scene.add(label.sprite)
      trayLabels.push(label)
    }

    /* --- Condensador --- */
    const condenserGroup = new THREE.Group()
    const condShell = new THREE.Mesh(
      track(new THREE.CylinderGeometry(COL_RADIUS + 0.28, COL_RADIUS + 0.28, 0.85, 48, 1, true)),
      track(new THREE.MeshPhysicalMaterial({ color: 0x9fc0e8, transparent: true, opacity: 0.25, side: THREE.DoubleSide, roughness: 0.2, metalness: 0.5 })),
    )
    condShell.position.y = COL_HEIGHT / 2 + 0.5
    condenserGroup.add(condShell)
    // Serpentín (torus) para suxerir o intercambiador
    for (let i = 0; i < 4; i++) {
      const coil = new THREE.Mesh(
        track(new THREE.TorusGeometry(COL_RADIUS + 0.08, 0.045, 10, 40)),
        track(new THREE.MeshStandardMaterial({ color: 0x7fb0e8, metalness: 0.85, roughness: 0.25 })),
      )
      coil.position.y = COL_HEIGHT / 2 + 0.2 + i * 0.2
      coil.rotation.x = Math.PI / 2
      condenserGroup.add(coil)
    }
    scene.add(condenserGroup)
    const condLabel = makeLabel()
    condLabel.sprite.position.set(0, COL_HEIGHT / 2 + 1.25, 0)
    scene.add(condLabel.sprite)

    /* --- Refervedor --- */
    const reboilerGroup = new THREE.Group()
    const rebShell = new THREE.Mesh(
      track(new THREE.CylinderGeometry(COL_RADIUS + 0.38, COL_RADIUS + 0.38, 1.15, 48, 1, true)),
      track(new THREE.MeshPhysicalMaterial({ color: 0xd8a06a, transparent: true, opacity: 0.3, side: THREE.DoubleSide, roughness: 0.4, metalness: 0.5 })),
    )
    rebShell.position.y = -COL_HEIGHT / 2 - 0.65
    reboilerGroup.add(rebShell)
    const rebLiquid = new THREE.Mesh(
      track(new THREE.CylinderGeometry(COL_RADIUS + 0.3, COL_RADIUS + 0.3, 0.7, 48)),
      track(new THREE.MeshStandardMaterial({ color: 0xc05020, transparent: true, opacity: 0.8, roughness: 0.2 })),
    )
    rebLiquid.position.y = -COL_HEIGHT / 2 - 0.75
    reboilerGroup.add(rebLiquid)
    scene.add(reboilerGroup)
    const rebLabel = makeLabel()
    rebLabel.sprite.position.set(0, -COL_HEIGHT / 2 - 1.55, 0)
    scene.add(rebLabel.sprite)

    /* --- Tuberías --- */
    const pipe = (len: number, r: number, color: number) => {
      const m = new THREE.Mesh(
        track(new THREE.CylinderGeometry(r, r, len, 16)),
        track(new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.35 })),
      )
      scene.add(m)
      return m
    }
    const feedPipe = pipe(2.1, 0.14, 0xd8872e) // alimentación (horizontal)
    feedPipe.rotation.z = Math.PI / 2
    feedPipe.position.set(-(COL_RADIUS + 1.05), 1.6, 0)
    const distillatePipe = pipe(2.0, 0.13, 0x3fb950) // destilado
    distillatePipe.rotation.z = Math.PI / 2
    distillatePipe.position.set(COL_RADIUS + 1.0, COL_HEIGHT / 2 + 0.3, 0)
    const refluxPipe = pipe(2.4, 0.12, 0x58a6ff) // refluxo (vertical exterior)
    refluxPipe.position.set(COL_RADIUS + 0.95, 2.2, 0)
    const bottomsPipe = pipe(2.1, 0.14, 0xf85149) // fondos
    bottomsPipe.rotation.z = Math.PI / 2
    bottomsPipe.position.set(-(COL_RADIUS + 1.05), -COL_HEIGHT / 2 - 0.65, 0)

    const feedLabel = makeLabel()
    feedLabel.sprite.position.set(-(COL_RADIUS + 2.0), 1.6, 0)
    scene.add(feedLabel.sprite)
    const distillateLabel = makeLabel()
    distillateLabel.sprite.position.set(COL_RADIUS + 1.95, COL_HEIGHT / 2 + 0.3, 0)
    scene.add(distillateLabel.sprite)
    const refluxLabel = makeLabel()
    refluxLabel.sprite.position.set(COL_RADIUS + 1.9, 2.2, 0)
    scene.add(refluxLabel.sprite)
    const bottomsLabel = makeLabel()
    bottomsLabel.sprite.position.set(-(COL_RADIUS + 2.0), -COL_HEIGHT / 2 - 0.65, 0)
    scene.add(bottomsLabel.sprite)

    /* --- Burbullas de vapor dentro da columna --- */
    const bubbleCount = 420
    const bubblePos = new Float32Array(bubbleCount * 3)
    const bubbleVel = new Float32Array(bubbleCount)
    for (let i = 0; i < bubbleCount; i++) {
      const a = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * (COL_RADIUS - 0.3)
      bubblePos[i * 3] = r * Math.cos(a)
      bubblePos[i * 3 + 1] = -COL_HEIGHT / 2 + Math.random() * COL_HEIGHT
      bubblePos[i * 3 + 2] = r * Math.sin(a)
      bubbleVel[i] = 0.35 + Math.random() * 0.5
    }
    const bubbleGeo = track(new THREE.BufferGeometry())
    bubbleGeo.setAttribute('position', new THREE.BufferAttribute(bubblePos, 3))
    const bubbleMat = track(
      new THREE.PointsMaterial({ color: 0x9fd8ff, size: 0.09, transparent: true, opacity: 0.55, sizeAttenuation: true, depthWrite: false }),
    )
    const bubbles = new THREE.Points(bubbleGeo, bubbleMat)
    scene.add(bubbles)

    /* --- Chama do refervedor --- */
    const flameCount = 90
    const flamePos = new Float32Array(flameCount * 3)
    const flameSeed = new Float32Array(flameCount)
    for (let i = 0; i < flameCount; i++) {
      flamePos[i * 3] = (Math.random() - 0.5) * 1.5
      flamePos[i * 3 + 1] = -5.5 + Math.random() * 1.6
      flamePos[i * 3 + 2] = (Math.random() - 0.5) * 1.5
      flameSeed[i] = Math.random() * Math.PI * 2
    }
    const flameGeo = track(new THREE.BufferGeometry())
    flameGeo.setAttribute('position', new THREE.BufferAttribute(flamePos, 3))
    const flameMat = track(
      new THREE.PointsMaterial({ color: 0xff8844, size: 0.13, transparent: true, opacity: 0.9, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    )
    const flames = new THREE.Points(flameGeo, flameMat)
    scene.add(flames)

    /* --- Interacción hover (raycaster) --- */
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let hoverIdx: number | null = null
    const onMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(trayMeshes)
      if (hits.length > 0) {
        const idx = hits[0].object.userData.trayIndex as number
        if (idx !== hoverIdx) {
          hoverIdx = idx
          const snap = engine.snapshot()
          const tray = snap.column.trays[idx]
          setHover({ tray: idx, T: tray.T, x: tray.x.slice() })
        }
      } else if (hoverIdx !== null) {
        hoverIdx = null
        setHover(null)
      }
    }
    renderer.domElement.addEventListener('pointermove', onMove)

    /* --- Redimensionamento --- */
    const resize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(mount)

    /* --- Bucle principal --- */
    let raf = 0
    let statsClock = 0
    const loop = () => {
      engine.tick()
      const snap = engine.snapshot()
      const trays = snap.column.trays
      const tMin = Math.min(...trays.map((tr) => tr.T))
      const tMax = Math.max(...trays.map((tr) => tr.T))

      // Platos: cor por temperatura + resaltado hover
      for (let j = 0; j < nTrays; j++) {
        const c = tempColor(trays[j].T, tMin, tMax)
        trayMaterials[j * 2].color.copy(c)
        trayMaterials[j * 2].emissive.copy(c).multiplyScalar(hoverIdx === j ? 0.55 : 0.22)
        ;(trayMaterials[j * 2 + 1] as THREE.MeshStandardMaterial).color.copy(c).lerp(new THREE.Color(0xffffff), 0.15)
        trayLabels[j].update(`${trays[j].T.toFixed(1)} °C\nx₁ ${trays[j].x[0].toFixed(3)}`)
      }

      // Condensador / refervedor
      condLabel.update(
        `${snap.config.mode === 'total' ? t('tab.3dCondTotal') : t('tab.3dCondPartial')}  T ${snap.column.TD.toFixed(1)} °C`,
      )
      rebLabel.update(`${t('sim.tFondos')} T ${snap.column.TB.toFixed(1)} °C`)
      ;(rebLiquid.material as THREE.MeshStandardMaterial).color.copy(tempColor(snap.column.TB, tMin, tMax))

      // Tuberías e cabais
      feedLabel.update(`${t('sim.alimentacionF')}: ${snap.inputs.F.toFixed(0)}  z ${snap.inputs.zF[0].toFixed(2)}`)
      distillateLabel.update(`${t('sim.destiladoD')}: ${snap.column.D.toFixed(1)}  x ${snap.column.xD[0].toFixed(3)}`)
      refluxLabel.update(`L₀: ${snap.column.L_rect.toFixed(1)}  R ${snap.inputs.R.toFixed(2)}`)
      bottomsLabel.update(`${t('sim.fondosB')}: ${snap.column.B.toFixed(1)}  x ${snap.column.xB[0].toFixed(3)}`)

      // Burbullas ascendentes
      const pos = bubbleGeo.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < bubbleCount; i++) {
        let y = pos.getY(i) + bubbleVel[i] * 0.016
        if (y > COL_HEIGHT / 2 - 0.4) {
          y = -COL_HEIGHT / 2 + 0.4
          const a = Math.random() * Math.PI * 2
          const r = Math.sqrt(Math.random()) * (COL_RADIUS - 0.3)
          pos.setX(i, r * Math.cos(a))
          pos.setZ(i, r * Math.sin(a))
        }
        pos.setY(i, y)
      }
      pos.needsUpdate = true

      // Chama
      const fpos = flameGeo.attributes.position as THREE.BufferAttribute
      const tNow = performance.now() / 1000
      for (let i = 0; i < flameCount; i++) {
        let y = fpos.getY(i) + 0.55 * 0.016
        if (y > -4.35) y = -5.6
        fpos.setY(i, y)
        fpos.setX(i, Math.sin(tNow * 2 + flameSeed[i]) * 0.18)
        fpos.setZ(i, Math.cos(tNow * 2 + flameSeed[i] * 1.3) * 0.18)
      }
      fpos.needsUpdate = true

      // Panel de datos (cada ~250 ms)
      statsClock += 16
      if (statsClock >= 250) {
        statsClock = 0
        setStats(snap)
      }

      controls.update()
      renderer.render(scene, camera)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    /* --- Limpeza --- */
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointermove', onMove)
      controls.dispose()
      renderer.dispose()
      disposables.forEach((d) => d.dispose())
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fmt = (v: number) => v.toFixed(4)

  return (
    <div className="panel panel-3d">
      <div className="panel-3d-head">
        <h3>{t('tab.3d')}</h3>
        <span className="panel-3d-hint">{t('vista3d.hint')}</span>
      </div>
      <div ref={mountRef} className="viewport-3d" />

      {/* Escala de temperatura */}
      <div className="legend-3d">
        <span style={{ color: 'hsl(237, 90%, 50%)' }}>●</span>
        <span>{t('vista3d.frio')}</span>
        <div className="legend-3d-bar" />
        <span>{t('vista3d.quente')}</span>
        <span style={{ color: 'hsl(0, 90%, 50%)' }}>●</span>
      </div>

      {/* Tooltip do prato en hover */}
      {hover && (
        <div className="tooltip-3d">
          <b>{t('vista3d.prato', { n: hover.tray + 1 })}</b>
          <div>{t('sim.tMedida', { n: hover.tray + 1 })}: <b>{hover.T.toFixed(2)} °C</b></div>
          <div>
            x: {hover.x.map((xi) => fmt(xi)).join(' · ')}
          </div>
        </div>
      )}

      {/* Panel de datos en vivo */}
      {stats && (
        <div className="panel-3d-stats">
          <div className="instrument">
            <div className="k">{t('sim.xD')}</div>
            <div className="v">{fmt(stats.column.xD[0])}</div>
          </div>
          <div className="instrument">
            <div className="k">{t('sim.xB')}</div>
            <div className="v">{fmt(stats.column.xB[stats.column.xB.length - 1])}</div>
          </div>
          <div className="instrument">
            <div className="k">{t('sim.tCabeza')}</div>
            <div className="v">{stats.column.TD.toFixed(1)} °C</div>
          </div>
          <div className="instrument">
            <div className="k">{t('sim.tFondos')}</div>
            <div className="v">{stats.column.TB.toFixed(1)} °C</div>
          </div>
          <div className="instrument">
            <div className="k">{t('sim.destiladoD')}</div>
            <div className="v">{stats.column.D.toFixed(1)}</div>
          </div>
          <div className="instrument">
            <div className="k">{t('sim.fondosB')}</div>
            <div className="v">{stats.column.B.toFixed(1)}</div>
          </div>
          <div className="instrument">
            <div className="k">{t('sim.calorRefervedor')}</div>
            <div className="v">{(stats.column.QR / 3.6e6).toFixed(2)} MW</div>
          </div>
          <div className="instrument">
            <div className="k">{t('sim.calorCondensador')}</div>
            <div className="v">{(stats.column.QC / 3.6e6).toFixed(2)} MW</div>
          </div>
        </div>
      )}
    </div>
  )
}
