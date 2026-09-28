'use client'

import {useEffect, useRef, useState} from 'react'
import * as THREE from 'three'
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js'

export interface TowerProps {
  /** Floors the marketing material advertises. */
  advertised: number
  /** Floors the sanctioned plan actually covers. */
  registered: number
  /** Smaller, calmer version for use inside a finding card. */
  compact?: boolean
  /** Full-bleed hero: low warm window light, fog, the building off to one side. */
  cinematic?: boolean
}

// Building proportions, in scene units.
const SLAB = 0.07 // floor plate thickness
const GLASS = 0.33 // height of the glazed band between plates
const PITCH = SLAB + GLASS
const CORE = 2.3 // glass line
const OVERHANG = 2.62 // floor plates project past the glass
const LOBBY_EXTRA = 0.22 // the ground floor is taller

/** Deterministic noise, so the same building always lights the same windows. */
function seeded(seed: number) {
  let state = seed * 9301 + 49297
  return () => {
    state = (state * 9301 + 49297) % 233280
    return state / 233280
  }
}

function readTheme() {
  const styles = getComputedStyle(document.documentElement)
  const token = (name: string, fallback: string) => {
    const value = styles.getPropertyValue(name).trim()
    try {
      return new THREE.Color(value || fallback)
    } catch {
      return new THREE.Color(fallback)
    }
  }
  const background = token('--bg', '#f7f6f2')
  const dark = background.getHSL({h: 0, s: 0, l: 0}).l < 0.5
  // The unapproved floors are drawn rather than built: a faint brick fill
  // under full-strength brick outlines, like a proposal traced over the
  // building that actually got permission.
  const critical = token('--critical', '#a32c1e')
  const criticalHsl = critical.getHSL({h: 0, s: 0, l: 0})
  const ghost = new THREE.Color().setHSL(
    criticalHsl.h,
    Math.min(1, criticalHsl.s * 1.4),
    dark ? Math.min(criticalHsl.l, 0.52) : Math.min(criticalHsl.l, 0.42),
  )
  return {
    dark,
    accent: token('--accent', '#2f5d50'),
    critical,
    ghost,
    // Warm stone, bronze glazing, lamplight.
    concrete: new THREE.Color(dark ? '#3a3026' : '#ddd0b8'),
    spandrel: new THREE.Color(dark ? '#261e16' : '#c3b499'),
    trim: new THREE.Color(dark ? '#4a3c2d' : '#b3a58f'),
    metal: new THREE.Color(dark ? '#9c8a72' : '#8d8070'),
    glass: new THREE.Color(dark ? '#221d14' : '#8a7a4e'),
    litWarm: new THREE.Color(dark ? '#ffc477' : '#ffdca4'),
    litCool: new THREE.Color(dark ? '#f0e2c0' : '#f6ecd4'),
    foliage: new THREE.Color(dark ? '#4a5a2a' : '#6f8a3e'),
    bark: new THREE.Color(dark ? '#3a2b1e' : '#7a6248'),
    plaza: new THREE.Color(dark ? '#191309' : '#e8dcc4'),
  }
}

/**
 * The product's core idea as a building you can turn: floor plates, glazing,
 * balconies and a roof up to the sanctioned limit, then translucent red
 * floors above it that no approved plan covers.
 */
export default function TowerScene({advertised, registered, compact = false, cinematic = false}: TowerProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const markupRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, powerPreference: 'low-power'})
    } catch {
      setFailed(true)
      return
    }

    const theme = readTheme()
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(compact ? 44 : cinematic ? 30 : 38, 1, 0.1, 200)
    const building = new THREE.Group()
    const trash: Array<{dispose: () => void}> = []
    const keep = <T extends {dispose: () => void}>(item: T): T => {
      trash.push(item)
      return item
    }

    // Reflections: a tiny generated environment is enough to make glass read
    // as glass instead of flat paint.
    const pmrem = new THREE.PMREMGenerator(renderer)
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04)
    scene.environment = environment.texture
    scene.environmentIntensity = 0.55
    trash.push(environment, pmrem)

    const total = Math.max(advertised, registered)
    const floorY = (index: number) => (index === 0 ? 0 : LOBBY_EXTRA + index * PITCH)
    const bandHeight = (index: number) => (index === 0 ? GLASS + LOBBY_EXTRA : GLASS)
    const roofY = floorY(total) + SLAB

    // --- materials ---------------------------------------------------------
    const concreteMaterial = keep(
      new THREE.MeshStandardMaterial({color: theme.concrete, roughness: 0.82, metalness: 0.05}),
    )
    const trimMaterial = keep(new THREE.MeshStandardMaterial({color: theme.trim, roughness: 0.7, metalness: 0.15}))
    const metalMaterial = keep(
      new THREE.MeshStandardMaterial({color: theme.metal, roughness: 0.28, metalness: 0.92}),
    )
    const glassMaterial = keep(
      new THREE.MeshStandardMaterial({
        color: theme.glass,
        roughness: 0.12,
        metalness: 0.72,
        envMapIntensity: 1.6,
      }),
    )
    const makeLight = (color: THREE.Color) =>
      keep(
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: theme.dark ? 1.5 : 0.55,
          roughness: 0.4,
          metalness: 0.05,
        }),
      )
    const warmMaterial = makeLight(theme.litWarm)
    const coolMaterial = makeLight(theme.litCool)
    const spandrelMaterial = keep(
      new THREE.MeshStandardMaterial({color: theme.spandrel, roughness: 0.72, metalness: 0.1}),
    )
    const foliageMaterial = keep(
      new THREE.MeshStandardMaterial({color: theme.foliage, roughness: 0.9, flatShading: true}),
    )
    const barkMaterial = keep(new THREE.MeshStandardMaterial({color: theme.bark, roughness: 0.95}))
    const ghostMaterial = keep(
      new THREE.MeshStandardMaterial({
        color: theme.ghost,
        emissive: theme.ghost,
        emissiveIntensity: theme.dark ? 0.25 : 0.12,
        transparent: true,
        opacity: 0.16,
        roughness: 0.12,
        metalness: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    )
    const ghostSlabMaterial = keep(
      new THREE.MeshStandardMaterial({
        color: theme.ghost,
        emissive: theme.ghost,
        emissiveIntensity: 0.1,
        transparent: true,
        opacity: 0.18,
        roughness: 0.4,
        depthWrite: false,
      }),
    )
    const edgeMaterial = keep(
      new THREE.LineBasicMaterial({color: theme.ghost, transparent: true, opacity: 1}),
    )

    // --- geometry ----------------------------------------------------------
    const slabGeometry = keep(new THREE.BoxGeometry(OVERHANG, SLAB, OVERHANG))
    const panelGeometry = keep(new THREE.BoxGeometry(CORE * 0.92, 1, 0.05))
    const balconyGeometry = keep(new THREE.BoxGeometry(1.25, 0.05, 0.42))
    const railGeometry = keep(new THREE.BoxGeometry(1.25, 0.16, 0.03))
    const edgeGeometry = keep(new THREE.EdgesGeometry(slabGeometry))

    const faces = [
      {rotation: 0, offset: new THREE.Vector3(0, 0, CORE / 2)},
      {rotation: Math.PI, offset: new THREE.Vector3(0, 0, -CORE / 2)},
      {rotation: Math.PI / 2, offset: new THREE.Vector3(CORE / 2, 0, 0)},
      {rotation: -Math.PI / 2, offset: new THREE.Vector3(-CORE / 2, 0, 0)},
    ]

    const random = seeded(total * 31 + registered)
    const warm: Array<{floor: number; face: number}> = []
    const cool: Array<{floor: number; face: number}> = []
    const plain: Array<{floor: number; face: number}> = []
    for (let floor = 0; floor < registered; floor++) {
      for (let face = 0; face < faces.length; face++) {
        // The lobby reads as lit; above it some flats are home (warm) and a few
        // have a screen on (cool). The rest are dark glass.
        const roll = floor === 0 ? (face < 2 ? 0 : 0.9) : random()
        if (roll < 0.3) warm.push({floor, face})
        else if (roll < 0.4) cool.push({floor, face})
        else plain.push({floor, face})
      }
    }

    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const position = new THREE.Vector3()
    const scale = new THREE.Vector3()

    const tint = new THREE.Color()
    const placePanels = (
      entries: Array<{floor: number; face: number}>,
      material: THREE.Material,
      // Per-panel variation, so no two windows are the same flat colour.
      variation = 0,
      warm = false,
    ): THREE.InstancedMesh | null => {
      if (entries.length === 0) return null
      const mesh = new THREE.InstancedMesh(panelGeometry, material, entries.length)
      entries.forEach((entry, index) => {
        const height = bandHeight(entry.floor)
        const face = faces[entry.face]
        quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), face.rotation)
        position.copy(face.offset).setY(floorY(entry.floor) + SLAB + height / 2)
        scale.set(1, height * 0.86, 1)
        matrix.compose(position, quaternion, scale)
        mesh.setMatrixAt(index, matrix)
        if (variation > 0) {
          const shift = 1 + (random() - 0.5) * variation
          tint.setRGB(shift, warm ? shift * 0.96 : shift, warm ? shift * 0.88 : shift * 1.02)
          mesh.setColorAt(index, tint)
        }
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.castShadow = false
      building.add(mesh)
      return mesh
    }

    placePanels(plain, glassMaterial, 0.45)
    placePanels(warm, warmMaterial, 0.5, true)
    placePanels(cool, coolMaterial, 0.35)

    // Ghost glazing above the sanctioned line.
    const ghostPanels: Array<{floor: number; face: number}> = []
    for (let floor = registered; floor < total; floor++) {
      for (let face = 0; face < faces.length; face++) ghostPanels.push({floor, face})
    }
    placePanels(ghostPanels, ghostMaterial)

    // Floor plates.
    const slabs = new THREE.InstancedMesh(slabGeometry, concreteMaterial, registered + 1)
    for (let floor = 0; floor <= registered; floor++) {
      position.set(0, floorY(floor) + SLAB / 2, 0)
      matrix.compose(position, new THREE.Quaternion(), new THREE.Vector3(1, 1, 1))
      slabs.setMatrixAt(floor, matrix)
    }
    slabs.instanceMatrix.needsUpdate = true
    slabs.castShadow = true
    slabs.receiveShadow = true
    building.add(slabs)

    if (total > registered) {
      const ghostSlabs = new THREE.InstancedMesh(slabGeometry, ghostSlabMaterial, total - registered)
      for (let floor = registered + 1; floor <= total; floor++) {
        position.set(0, floorY(floor) + SLAB / 2, 0)
        matrix.compose(position, new THREE.Quaternion(), new THREE.Vector3(1, 1, 1))
        ghostSlabs.setMatrixAt(floor - registered - 1, matrix)
        const outline = new THREE.LineSegments(edgeGeometry, edgeMaterial)
        outline.position.copy(position)
        building.add(outline)
      }
      ghostSlabs.instanceMatrix.needsUpdate = true
      building.add(ghostSlabs)
    }

    // Balconies on the two long faces, from the first residential floor up.
    const balconyFloors = Math.max(registered - 1, 0)
    if (balconyFloors > 0) {
      const balconies = new THREE.InstancedMesh(balconyGeometry, concreteMaterial, balconyFloors * 2)
      const rails = new THREE.InstancedMesh(railGeometry, metalMaterial, balconyFloors * 2)
      let index = 0
      for (let floor = 1; floor < registered; floor++) {
        for (const direction of [1, -1]) {
          const y = floorY(floor) + SLAB + 0.03
          position.set(0, y, direction * (CORE / 2 + 0.2))
          matrix.compose(position, new THREE.Quaternion(), new THREE.Vector3(1, 1, 1))
          balconies.setMatrixAt(index, matrix)
          position.set(0, y + 0.1, direction * (CORE / 2 + 0.39))
          matrix.compose(position, new THREE.Quaternion(), new THREE.Vector3(1, 1, 1))
          rails.setMatrixAt(index, matrix)
          index++
        }
      }
      balconies.instanceMatrix.needsUpdate = true
      rails.instanceMatrix.needsUpdate = true
      balconies.castShadow = true
      building.add(balconies, rails)
    }

    // A sill under every window and a recessed spandrel band above it: the two
    // lines that stop a facade reading as a painted box.
    const sillGeometry = keep(new THREE.BoxGeometry(CORE * 0.95, 0.035, 0.1))
    const spandrelGeometry = keep(new THREE.BoxGeometry(CORE * 0.99, SLAB * 0.9, 0.04))
    const sills = new THREE.InstancedMesh(sillGeometry, metalMaterial, registered * faces.length)
    const spandrels = new THREE.InstancedMesh(spandrelGeometry, spandrelMaterial, registered * faces.length)
    let detailIndex = 0
    for (let floor = 0; floor < registered; floor++) {
      for (const face of faces) {
        quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), face.rotation)
        position.copy(face.offset).multiplyScalar(1.04)
        position.y = floorY(floor) + SLAB + 0.03
        matrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1))
        sills.setMatrixAt(detailIndex, matrix)
        position.copy(face.offset).multiplyScalar(1.01)
        position.y = floorY(floor) + SLAB + bandHeight(floor) + SLAB / 2
        matrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1))
        spandrels.setMatrixAt(detailIndex, matrix)
        detailIndex++
      }
    }
    sills.instanceMatrix.needsUpdate = true
    spandrels.instanceMatrix.needsUpdate = true
    building.add(sills, spandrels)

    // Vertical fins at the corners, the strongest bit of architecture here.
    const height = roofY
    const finGeometry = keep(new THREE.BoxGeometry(0.14, height, 0.14))
    for (const x of [-1, 1]) {
      for (const z of [-1, 1]) {
        const fin = new THREE.Mesh(finGeometry, trimMaterial)
        fin.position.set(x * (CORE / 2 + 0.06), height / 2, z * (CORE / 2 + 0.06))
        fin.castShadow = true
        building.add(fin)
      }
    }
    const mullionGeometry = keep(new THREE.BoxGeometry(0.07, height, 0.09))
    for (const face of faces) {
      for (const shift of [-0.62, 0, 0.62]) {
        const mullion = new THREE.Mesh(mullionGeometry, trimMaterial)
        mullion.position.copy(face.offset).multiplyScalar(1.02)
        mullion.position.y = height / 2
        if (Math.abs(face.offset.x) > 0) mullion.position.z = shift
        else mullion.position.x = shift
        mullion.rotation.y = face.rotation
        building.add(mullion)
      }
    }

    // Lobby canopy and entrance steps.
    const canopyGeometry = keep(new THREE.BoxGeometry(1.9, 0.06, 0.8))
    const canopy = new THREE.Mesh(canopyGeometry, concreteMaterial)
    canopy.position.set(0, LOBBY_EXTRA + 0.16, CORE / 2 + 0.34)
    canopy.castShadow = true
    building.add(canopy)

    const plinthGeometry = keep(new THREE.BoxGeometry(OVERHANG + 0.5, 0.18, OVERHANG + 0.5))
    const plinth = new THREE.Mesh(plinthGeometry, concreteMaterial)
    plinth.position.y = -0.09
    plinth.receiveShadow = true
    plinth.castShadow = true
    building.add(plinth)

    const stepsGeometry = keep(new THREE.BoxGeometry(OVERHANG + 1.1, 0.08, OVERHANG + 1.1))
    const steps = new THREE.Mesh(stepsGeometry, concreteMaterial)
    steps.position.y = -0.22
    steps.receiveShadow = true
    building.add(steps)

    // Roof: parapet, plant room, water tank, mast. Ghosted when the top of the
    // building is the part nobody approved.
    const roofIsGhost = total > registered
    const roofMaterial = roofIsGhost ? ghostSlabMaterial : concreteMaterial
    const parapetGeometry = keep(new THREE.BoxGeometry(OVERHANG, 0.22, 0.08))
    for (const face of faces) {
      const parapet = new THREE.Mesh(parapetGeometry, roofMaterial)
      parapet.position.copy(face.offset).multiplyScalar(1.12)
      parapet.position.y = roofY + 0.11
      parapet.rotation.y = face.rotation
      building.add(parapet)
    }
    const plantGeometry = keep(new THREE.BoxGeometry(0.95, 0.34, 0.7))
    const plantRoom = new THREE.Mesh(plantGeometry, roofMaterial)
    plantRoom.position.set(-0.45, roofY + 0.17, -0.2)
    plantRoom.castShadow = true
    building.add(plantRoom)

    const tankGeometry = keep(new THREE.CylinderGeometry(0.26, 0.26, 0.3, 16))
    const tank = new THREE.Mesh(tankGeometry, roofIsGhost ? ghostSlabMaterial : metalMaterial)
    tank.position.set(0.55, roofY + 0.28, 0.4)
    tank.castShadow = true
    building.add(tank)
    const legGeometry = keep(new THREE.BoxGeometry(0.05, 0.26, 0.05))
    for (const x of [-0.18, 0.18]) {
      for (const z of [-0.18, 0.18]) {
        const leg = new THREE.Mesh(legGeometry, roofIsGhost ? ghostSlabMaterial : metalMaterial)
        leg.position.set(0.55 + x, roofY + 0.13, 0.4 + z)
        building.add(leg)
      }
    }
    const acGeometry = keep(new THREE.BoxGeometry(0.34, 0.16, 0.34))
    for (const [x, z] of [
      [0.42, -0.62],
      [-0.5, 0.55],
      [0.05, -0.28],
    ] as const) {
      const unit = new THREE.Mesh(acGeometry, roofIsGhost ? ghostSlabMaterial : metalMaterial)
      unit.position.set(x, roofY + 0.08, z)
      unit.castShadow = true
      building.add(unit)
    }

    const mastGeometry = keep(new THREE.CylinderGeometry(0.02, 0.03, 0.85, 8))
    const mast = new THREE.Mesh(mastGeometry, roofIsGhost ? ghostSlabMaterial : metalMaterial)
    mast.position.set(-0.45, roofY + 0.76, -0.2)
    building.add(mast)

    // Corner posts through the unapproved floors: structure drawn, never built.
    if (total > registered) {
      const postHeight = roofY - (floorY(registered) + SLAB)
      const postGeometry = keep(new THREE.BoxGeometry(0.05, postHeight, 0.05))
      for (const x of [-1, 1]) {
        for (const z of [-1, 1]) {
          const post = new THREE.Mesh(postGeometry, ghostMaterial)
          post.position.set(
            x * (CORE / 2 + 0.06),
            floorY(registered) + SLAB + postHeight / 2,
            z * (CORE / 2 + 0.06),
          )
          building.add(post)
        }
      }
    }

    // A band in the brand green marking the top approved floor.
    const bandGeometry = keep(new THREE.BoxGeometry(OVERHANG + 0.04, 0.05, OVERHANG + 0.04))
    const bandMaterial = keep(
      new THREE.MeshStandardMaterial({
        color: theme.accent,
        emissive: theme.accent,
        emissiveIntensity: theme.dark ? 0.3 : 0.12,
        roughness: 0.35,
      }),
    )
    const band = new THREE.Mesh(bandGeometry, bandMaterial)
    band.position.y = floorY(registered) + SLAB / 2
    building.add(band)

    // The sanctioned line: a lit ring at the last approved floor.
    const ringGeometry = keep(new THREE.TorusGeometry(OVERHANG * 0.78, 0.016, 8, 72))
    const ringMaterial = keep(new THREE.MeshBasicMaterial({color: theme.accent}))
    const ring = new THREE.Mesh(ringGeometry, ringMaterial)
    ring.rotation.x = Math.PI / 2
    ring.position.y = floorY(registered) + SLAB
    building.add(ring)

    // Planters and trees: they give the building a size the eye can read.
    const planterGeometry = keep(new THREE.BoxGeometry(0.6, 0.18, 0.6))
    const trunkGeometry = keep(new THREE.CylinderGeometry(0.045, 0.06, 0.42, 6))
    const crownGeometry = keep(new THREE.ConeGeometry(0.3, 0.72, 7))
    for (const [x, z] of [
      [2.35, 1.9],
      [-2.4, 1.75],
      [2.15, -2.15],
      [-2.05, -2.3],
      [0, 2.55],
    ] as const) {
      const planter = new THREE.Mesh(planterGeometry, concreteMaterial)
      planter.position.set(x, -0.09, z)
      planter.castShadow = true
      planter.receiveShadow = true
      const trunk = new THREE.Mesh(trunkGeometry, barkMaterial)
      trunk.position.set(x, 0.21, z)
      const crown = new THREE.Mesh(crownGeometry, foliageMaterial)
      crown.position.set(x, 0.72, z)
      crown.castShadow = true
      building.add(planter, trunk, crown)
    }

    scene.add(building)

    if (cinematic) {
      // A dark floor the fog can swallow, so the building stands in a room of
      // dusk rather than on a disc.
      const floorGeometry = keep(new THREE.PlaneGeometry(90, 90))
      const floorMaterial = keep(
        new THREE.MeshStandardMaterial({color: new THREE.Color('#1c1611'), roughness: 0.92, metalness: 0}),
      )
      const floor = new THREE.Mesh(floorGeometry, floorMaterial)
      floor.rotation.x = -Math.PI / 2
      floor.position.y = -0.27
      floor.receiveShadow = true
      scene.add(floor)
      const background = new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#17120d')
      scene.fog = new THREE.FogExp2(background, 0.042)

      // Light through a window: tall additive planes, brightest at the top.
      const shaftCanvas = document.createElement('canvas')
      shaftCanvas.width = 8
      shaftCanvas.height = 256
      const shaftContext = shaftCanvas.getContext('2d')
      if (shaftContext) {
        const gradient = shaftContext.createLinearGradient(0, 0, 0, 256)
        gradient.addColorStop(0, 'rgba(255,196,128,0.9)')
        gradient.addColorStop(0.55, 'rgba(255,170,96,0.25)')
        gradient.addColorStop(1, 'rgba(255,160,90,0)')
        shaftContext.fillStyle = gradient
        shaftContext.fillRect(0, 0, 8, 256)
      }
      const shaftTexture = keep(new THREE.CanvasTexture(shaftCanvas))
      const shaftMaterial = keep(
        new THREE.MeshBasicMaterial({
          map: shaftTexture,
          transparent: true,
          opacity: 0.11,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
          fog: false,
        }),
      )
      const shaftGeometry = keep(new THREE.PlaneGeometry(1, 1))
      for (const [x, width, tilt] of [
        [-5.2, 1.6, 0.42],
        [-3.6, 0.9, 0.46],
        [-6.6, 2.2, 0.38],
      ] as const) {
        const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial)
        shaft.scale.set(width, roofY * 2.2, 1)
        shaft.position.set(x, roofY * 0.62, -1.5)
        shaft.rotation.z = -tilt
        scene.add(shaft)
      }
    }

    // Plaza: a soft disc so the building sits on something.
    const plazaCanvas = document.createElement('canvas')
    plazaCanvas.width = plazaCanvas.height = 128
    const context = plazaCanvas.getContext('2d')
    if (context) {
      const gradient = context.createRadialGradient(64, 64, 6, 64, 64, 64)
      gradient.addColorStop(0, `#${theme.plaza.getHexString()}`)
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      context.fillStyle = gradient
      context.fillRect(0, 0, 128, 128)
    }
    const plazaTexture = keep(new THREE.CanvasTexture(plazaCanvas))
    const plazaGeometry = keep(new THREE.CircleGeometry(6.5, 48))
    const plazaMaterial = keep(new THREE.MeshBasicMaterial({map: plazaTexture, transparent: true}))
    const plaza = new THREE.Mesh(plazaGeometry, plazaMaterial)
    plaza.rotation.x = -Math.PI / 2
    plaza.position.y = -0.27
    if (!cinematic) scene.add(plaza)

    const shadowGeometry = keep(new THREE.CircleGeometry(6, 48))
    const shadowMaterial = keep(new THREE.ShadowMaterial({opacity: theme.dark ? 0.35 : 0.2}))
    const shadowPlane = new THREE.Mesh(shadowGeometry, shadowMaterial)
    shadowPlane.rotation.x = -Math.PI / 2
    shadowPlane.position.y = -0.26
    shadowPlane.receiveShadow = true
    scene.add(shadowPlane)

    // --- lights ------------------------------------------------------------
    const key = new THREE.DirectionalLight(
      cinematic ? 0xffb56e : 0xfff4e2,
      cinematic ? 3.4 : theme.dark ? 0.9 : 2.3,
    )
    // Cinematic: low and from the left, like late sun through a tall window.
    if (cinematic) key.position.set(-9, 5.5, 5)
    else key.position.set(6, 12, 7)
    key.castShadow = !compact
    key.shadow.mapSize.set(cinematic ? 2048 : 1024, cinematic ? 2048 : 1024)
    // The frustum has to cover the whole ground disc, or everything outside it
    // renders as shadow and leaves a rectangle on the plaza.
    key.shadow.camera.near = 1
    key.shadow.camera.far = 70
    key.shadow.camera.left = -14
    key.shadow.camera.right = 14
    key.shadow.camera.top = 20
    key.shadow.camera.bottom = -14
    key.shadow.bias = -0.0008
    scene.add(key)
    const fill = new THREE.DirectionalLight(
      cinematic ? 0x6f7f99 : 0x9cc4ff,
      cinematic ? 0.22 : theme.dark ? 0.45 : 0.9,
    )
    fill.position.set(cinematic ? 7 : -7, 5, -5)
    scene.add(fill)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x14140f, cinematic ? 0.1 : theme.dark ? 0.22 : 0.85))
    const rim = new THREE.PointLight(theme.ghost, compact ? 2 : 6, 16, 2)
    rim.position.set(2.6, roofY + 0.4, 2.6)
    scene.add(rim)

    // --- camera ------------------------------------------------------------
    const target = new THREE.Vector3(0, roofY * (cinematic ? 0.5 : 0.46), 0)
    // Cinematic looks up at the building from nearer the ground.
    const direction = cinematic
      ? new THREE.Vector3(0.5, 0.16, 0.85).normalize()
      : new THREE.Vector3(0.62, 0.4, 0.78).normalize()
    const fitCamera = () => {
      const verticalFov = THREE.MathUtils.degToRad(camera.fov)
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect)
      const byHeight = (roofY + 2.2) / 2 / Math.tan(verticalFov / 2)
      const byWidth = (OVERHANG * 2.1) / 2 / Math.tan(horizontalFov / 2)
      camera.position
        .copy(direction)
        // On a phone, step back a little so the redline fits beside the building.
        .multiplyScalar(Math.max(byHeight, byWidth) * (cinematic ? (camera.aspect < 0.75 ? 1.45 : 1.3) : 1.1))
        .add(target)
      camera.lookAt(target)
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = !compact
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = cinematic ? 1.05 : theme.dark ? 1.15 : 1.0
    renderer.setClearAlpha(0)
    mount.appendChild(renderer.domElement)
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.touchAction = 'pan-y'
    renderer.domElement.style.cursor = 'grab'

    const resize = () => {
      const {clientWidth, clientHeight} = mount
      if (!clientWidth || !clientHeight) return
      renderer.setSize(clientWidth, clientHeight, false)
      camera.aspect = clientWidth / clientHeight
      // On a wide hero the building stands right of centre, leaving the left
      // side dark for the words — the way a photographer frames a figure.
      if (cinematic && camera.aspect > 0.95) {
        // The wider the screen, the further right the building stands.
        const shift = THREE.MathUtils.clamp(0.18 + (camera.aspect - 1) * 0.12, 0.18, 0.3)
        camera.setViewOffset(clientWidth, clientHeight, -clientWidth * shift, clientHeight * 0.02, clientWidth, clientHeight)
      } else if (cinematic) {
        // Upright screens: nudge the building a little right, leaving the
        // left edge for the redline's labels.
        camera.setViewOffset(clientWidth, clientHeight, -clientWidth * 0.1, clientHeight * 0.03, clientWidth, clientHeight)
      } else {
        camera.clearViewOffset()
      }
      camera.updateProjectionMatrix()
      fitCamera()
      placeMarkup()
    }

    // The redline: a dimension line measuring the sanctioned floors, a dashed
    // one over the floors only the brochure has, and a pen loop round them.
    // They're HTML over the canvas, pinned to the building's projected edges.
    const markup = markupRef.current
    const probe = new THREE.Vector3()
    const across = new THREE.Vector3()
    const halfWidth = OVERHANG * 0.8
    const sanctionY = floorY(registered) + SLAB
    // Anything marked as the floor (the hero's headline) covers the base of
    // the building, so the sanctioned dimension stops just above it.
    const floorElement = mount.closest('section')?.querySelector<HTMLElement>('[data-markup-floor]')
    let placed = ''
    function placeMarkup() {
      if (!markup) return
      const {clientWidth: width, clientHeight: height} = mount!
      if (!width || !height) return
      building.updateMatrixWorld()
      camera.updateMatrixWorld()
      across.setFromMatrixColumn(camera.matrixWorld, 0).normalize()
      const at = (y: number, side: number) => {
        probe.set(0, y, 0)
        building.localToWorld(probe)
        probe.addScaledVector(across, side * halfWidth).project(camera)
        return [((probe.x + 1) / 2) * width, ((1 - probe.y) / 2) * height]
      }
      const edges = [roofY + 0.45, sanctionY, 0].map((y) => [at(y, -1), at(y, 1)])
      const left = Math.min(...edges.map(([l]) => l[0]))
      const right = Math.max(...edges.map(([, r]) => r[0]))
      const roof = at(roofY + 0.22, 0)[1]
      const sanction = at(sanctionY, 0)[1]
      const floor = floorElement
        ? floorElement.getBoundingClientRect().top - mount!.getBoundingClientRect().top - 18
        : height
      const cut = at(0, 0)[1] > floor
      const ground = Math.max(Math.min(at(0, 0)[1], floor), sanction + 24)
      const loopTop = edges[0][0][1] - 10
      const loopLeft = Math.min(edges[0][0][0], edges[1][0][0]) - 14
      const loopRight = Math.max(edges[0][1][0], edges[1][1][0]) + 14
      const side = left >= width - right ? 'left' : 'right'
      const values: Array<[string, number]> = [
        ['--mk-left', left],
        ['--mk-right', right],
        ['--mk-roof', roof],
        ['--mk-sanction', sanction],
        ['--mk-ground', ground],
        ['--mk-loop-l', loopLeft],
        ['--mk-loop-t', loopTop],
        ['--mk-loop-w', loopRight - loopLeft],
        ['--mk-loop-h', sanction + 12 - loopTop],
      ]
      const key = side + cut + values.map(([, value]) => Math.round(value)).join(',')
      if (key === placed) return
      placed = key
      for (const [name, value] of values) markup.style.setProperty(name, `${Math.round(value)}px`)
      markup.dataset.side = side
      markup.dataset.cut = String(cut)
      markup.dataset.ready = 'true'
    }
    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(mount)

    building.rotation.y = -0.35

    let dragging = false
    let lastX = 0
    let lastY = 0
    let velocity = 0
    const onPointerDown = (event: PointerEvent) => {
      dragging = true
      lastX = event.clientX
      lastY = event.clientY
      velocity = 0
      renderer.domElement.setPointerCapture(event.pointerId)
      renderer.domElement.style.cursor = 'grabbing'
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return
      const dx = event.clientX - lastX
      const dy = event.clientY - lastY
      lastX = event.clientX
      lastY = event.clientY
      building.rotation.y += dx * 0.008
      building.rotation.x = THREE.MathUtils.clamp(building.rotation.x + dy * 0.004, -0.2, 0.3)
      velocity = dx * 0.008
    }
    const onPointerUp = (event: PointerEvent) => {
      dragging = false
      renderer.domElement.releasePointerCapture?.(event.pointerId)
      renderer.domElement.style.cursor = 'grab'
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerup', onPointerUp)
    renderer.domElement.addEventListener('pointercancel', onPointerUp)

    let visible = true
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
      },
      {threshold: 0.05},
    )
    intersectionObserver.observe(mount)

    renderer.render(scene, camera)

    let frame = 0
    let previous = performance.now()
    let elapsed = 0
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      const delta = Math.min((now - previous) / 1000, 0.05)
      previous = now
      if (!visible) return
      elapsed += delta

      if (!reduceMotion && !document.hidden) {
        if (!dragging) {
          building.rotation.y += velocity || 0.14 * delta
          velocity *= 0.94
          if (Math.abs(velocity) < 0.0004) velocity = 0
        }
        ghostMaterial.opacity = 0.24 + Math.sin(elapsed * 1.6) * 0.07
        ghostMaterial.emissiveIntensity = 0.3 + Math.sin(elapsed * 1.6) * 0.12
      }
      renderer.render(scene, camera)
      placeMarkup()
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('pointercancel', onPointerUp)
      scene.traverse((object) => {
        if (object instanceof THREE.InstancedMesh) object.dispose()
      })
      for (const item of trash) item.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [advertised, registered, compact, cinematic])

  const description = `A ${advertised}-floor tower. The bottom ${registered} floors are solid concrete and glass: they are in the sanctioned plan. The ${advertised - registered} floors above the lit ring are translucent red, because no approved plan covers them.`

  if (failed) {
    return <TowerFallback advertised={advertised} registered={registered} description={description} />
  }

  return (
    <div className={`tower ${compact ? 'tower-compact' : ''} ${cinematic ? 'tower-cinema' : ''}`}>
      <div className="tower-canvas" ref={mountRef} role="img" aria-label={description} />
      {cinematic && (
        <div className="markup" ref={markupRef} aria-hidden="true">
          <span className="mk-ext roof" />
          <span className="mk-ext sanction" />
          <span className="mk-ext ground" />
          <span className="mk-dim ghost">
            <span className="mk-label">
              <span className="mk-figure">+{advertised - registered}</span>
              <span className="mk-caption">brochure only</span>
            </span>
          </span>
          <span className="mk-dim sanctioned">
            <span className="mk-label">
              <span className="mk-figure">{registered}</span>
              <span className="mk-caption">sanctioned</span>
            </span>
          </span>
          <svg className="mk-loop" viewBox="0 0 200 120" preserveAspectRatio="none">
            <path
              pathLength={1}
              d="M152 12C96 0 18 12 8 54C0 94 62 118 114 114C170 110 199 82 193 48C187 16 138 2 80 14"
            />
          </svg>
        </div>
      )}
      {cinematic && <p className="tower-hint no-print">Drag to turn the building</p>}
      {!compact && !cinematic && (
        <>
          <p className="tower-label unsanctioned">
            <span className="dot" aria-hidden="true" />
            {advertised - registered} floors advertised with no sanctioned plan
          </p>
          <p className="tower-label sanctioned">
            <span className="dot" aria-hidden="true" />
            {registered} floors in the registration
          </p>
          <p className="tower-hint no-print">Drag to turn the building</p>
        </>
      )}
    </div>
  )
}

/** Shown when WebGL isn't available: the same comparison, as stacked bars. */
export function TowerFallback({
  advertised,
  registered,
  description,
}: {
  advertised: number
  registered: number
  description: string
}) {
  return (
    <div className="tower-fallback" role="img" aria-label={description}>
      {Array.from({length: advertised}, (_, index) => advertised - 1 - index).map((floor) => (
        <span key={floor} className={floor >= registered ? 'slab ghost' : 'slab'} />
      ))}
    </div>
  )
}
