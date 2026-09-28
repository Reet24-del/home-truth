'use client'

import {useCallback, useEffect, useRef, useState} from 'react'
import * as THREE from 'three'

import {PAGE_HEIGHT, PAGE_WIDTH, drawPage, paginate, parseDocument, type PageTheme} from '@/lib/brochurePages'

export interface BrochureProps {
  /** Markdown of the document, printed onto the pages. */
  markdown: string
  /** Line to highlight and stamp, usually the claim that doesn't hold up. */
  highlight?: string
  stampText?: string
  label?: string
}

const PAGE_W = 3
const PAGE_H = (PAGE_W * PAGE_HEIGHT) / PAGE_WIDTH
const TURN_MS = 700

function readTheme(): PageTheme {
  const styles = getComputedStyle(document.documentElement)
  const value = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback
  const display = value('--display', 'Georgia, serif')
  const mono = value('--mono', 'monospace')
  // A printed brochure is paper whatever the room looks like, so the pages
  // keep their own palette; only the typefaces come from the site.
  return {
    paper: '#fbf3e4',
    ink: '#241a11',
    muted: '#6a594a',
    rule: '#c9b795',
    stamp: '#a32c1e',
    highlight: 'rgba(233, 189, 74, 0.6)',
    display,
    body: 'ui-sans-serif, system-ui, sans-serif',
    mono,
  }
}

/**
 * The brochure as an object: a booklet you can turn, zoom and read. The pages
 * are the document's own words, so the claim under the highlighter is the one
 * the findings quote.
 */
export default function BrochureScene({markdown, highlight, stampText = 'Check the record', label}: BrochureProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const [spread, setSpread] = useState(1)
  const [leafCount, setLeafCount] = useState(1)
  const apiRef = useRef<{turn: (direction: 1 | -1) => void; zoom: (step: number) => void} | null>(null)

  const turn = useCallback((direction: 1 | -1) => apiRef.current?.turn(direction), [])
  const zoom = useCallback((step: number) => apiRef.current?.zoom(step), [])

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
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
    const book = new THREE.Group()
    const trash: Array<{dispose: () => void}> = []

    // --- pages -------------------------------------------------------------
    const measure = document.createElement('canvas').getContext('2d')!
    const pages = paginate(measure, parseDocument(markdown), theme, highlight)

    const textures = pages.map((page, index) => {
      const canvas = document.createElement('canvas')
      drawPage(canvas, page, index + 1, theme, stampText)
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
      trash.push(texture)
      return texture
    })

    const leaves: THREE.Group[] = []
    const pageGeometry = new THREE.PlaneGeometry(PAGE_W, PAGE_H)
    trash.push(pageGeometry)

    for (let index = 0; index < textures.length; index += 2) {
      const pivot = new THREE.Group()
      const front = new THREE.Mesh(
        pageGeometry,
        new THREE.MeshStandardMaterial({map: textures[index], roughness: 0.95, metalness: 0}),
      )
      const back = new THREE.Mesh(
        pageGeometry,
        new THREE.MeshStandardMaterial({map: textures[index + 1], roughness: 0.95, metalness: 0}),
      )
      trash.push(front.material as THREE.Material, back.material as THREE.Material)
      front.position.set(PAGE_W / 2, 0, 0.004)
      back.position.set(PAGE_W / 2, 0, -0.004)
      back.rotation.y = Math.PI
      // Leaves stack, so the one on top sits a hair above the one beneath it.
      pivot.position.z = -index * 0.0016
      pivot.add(front, back)
      book.add(pivot)
      leaves.push(pivot)
    }
    setLeafCount(leaves.length)

    const spine = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, PAGE_H * 1.01, 0.09),
      new THREE.MeshStandardMaterial({color: new THREE.Color('#8a7456'), roughness: 0.9}),
    )
    trash.push(spine.geometry, spine.material as THREE.Material)
    spine.position.set(0, 0, -0.03)
    book.add(spine)

    scene.add(book)
    book.rotation.x = -0.32

    // --- lights ------------------------------------------------------------
    const key = new THREE.DirectionalLight(0xffe2bd, 1.25)
    key.position.set(2.5, 4.5, 6)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xffffff, 0.35)
    fill.position.set(-4, 2, 3)
    scene.add(fill)
    scene.add(new THREE.AmbientLight(0xfff0dc, 1.3))

    // --- state -------------------------------------------------------------
    const stampedPage = pages.findIndex((page) => page.stamped)
    const openAt = stampedPage < 0 ? 1 : stampedPage % 2 === 0 ? stampedPage / 2 : (stampedPage + 1) / 2
    let current = THREE.MathUtils.clamp(openAt, 0, leaves.length)
    leaves.forEach((leaf, index) => {
      leaf.rotation.y = index < current ? -Math.PI : 0
    })
    setSpread(current)

    // A closed book shows one page: centre it instead of leaving half the
    // stage empty. An open spread sits on the spine.
    // One page showing or two changes how wide the thing on screen is.
    let framedWidth = PAGE_W * 2.16
    const centreBook = () => {
      const single = current === 0 || current === leaves.length
      book.position.x = current === 0 ? -PAGE_W / 2 : current === leaves.length ? PAGE_W / 2 : 0
      framedWidth = single ? PAGE_W * 1.24 : PAGE_W * 2.16
    }
    centreBook()

    // Frame the open spread: two pages wide, one page tall, plus a margin.
    let zoom = 1
    const applyCamera = () => {
      const verticalFov = THREE.MathUtils.degToRad(camera.fov)
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect)
      const byHeight = (PAGE_H * 1.12) / 2 / Math.tan(verticalFov / 2)
      const byWidth = framedWidth / 2 / Math.tan(horizontalFov / 2)
      camera.position.set(0, 0.1, Math.max(byHeight, byWidth) * zoom)
      camera.lookAt(0, 0, 0)
    }
    applyCamera()

    const animations: Array<{leaf: THREE.Group; from: number; to: number; start: number}> = []
    const turnLeaf = (direction: 1 | -1) => {
      const index = direction === 1 ? current : current - 1
      if (index < 0 || index >= leaves.length) return
      const leaf = leaves[index]
      const to = direction === 1 ? -Math.PI : 0
      current += direction
      setSpread(current)
      centreBook()
      applyCamera()
      if (reduceMotion) {
        leaf.rotation.y = to
        return
      }
      animations.push({leaf, from: leaf.rotation.y, to, start: performance.now()})
    }

    const zoomBy = (step: number) => {
      zoom = THREE.MathUtils.clamp(zoom + step * 0.16, 0.42, 1.6)
      applyCamera()
    }

    apiRef.current = {turn: turnLeaf, zoom: zoomBy}

    // --- interaction -------------------------------------------------------
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearAlpha(0)
    renderer.toneMapping = THREE.NoToneMapping
    mount.appendChild(renderer.domElement)
    const element = renderer.domElement
    element.style.width = '100%'
    element.style.height = '100%'
    element.style.display = 'block'
    element.style.touchAction = 'pan-y'
    element.style.cursor = 'grab'

    let dragging = false
    let moved = 0
    let lastX = 0
    let lastY = 0
    const onPointerDown = (event: PointerEvent) => {
      dragging = true
      moved = 0
      lastX = event.clientX
      lastY = event.clientY
      element.setPointerCapture(event.pointerId)
      element.style.cursor = 'grabbing'
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return
      const dx = event.clientX - lastX
      const dy = event.clientY - lastY
      lastX = event.clientX
      lastY = event.clientY
      moved += Math.abs(dx) + Math.abs(dy)
      book.rotation.y = THREE.MathUtils.clamp(book.rotation.y + dx * 0.005, -0.7, 0.7)
      book.rotation.x = THREE.MathUtils.clamp(book.rotation.x + dy * 0.004, -0.9, 0.2)
    }
    const onPointerUp = (event: PointerEvent) => {
      if (dragging && moved < 6) {
        // A tap on a page turns it, like a real one.
        const bounds = element.getBoundingClientRect()
        turnLeaf(event.clientX - bounds.left > bounds.width / 2 ? 1 : -1)
      }
      dragging = false
      element.releasePointerCapture?.(event.pointerId)
      element.style.cursor = 'grab'
    }
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && Math.abs(event.deltaY) < 2) return
      event.preventDefault()
      zoomBy(event.deltaY * 0.004)
    }
    element.addEventListener('pointerdown', onPointerDown)
    element.addEventListener('pointermove', onPointerMove)
    element.addEventListener('pointerup', onPointerUp)
    element.addEventListener('pointercancel', onPointerUp)
    element.addEventListener('wheel', onWheel, {passive: false})

    const resize = () => {
      const {clientWidth, clientHeight} = mount
      if (!clientWidth || !clientHeight) return
      renderer.setSize(clientWidth, clientHeight, false)
      camera.aspect = clientWidth / clientHeight
      camera.updateProjectionMatrix()
      applyCamera()
    }
    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(mount)

    let visible = true
    const intersectionObserver = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting), {
      threshold: 0.05,
    })
    intersectionObserver.observe(mount)

    renderer.render(scene, camera)
    let frame = 0
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      if (!visible) return
      for (let index = animations.length - 1; index >= 0; index--) {
        const animation = animations[index]
        const t = Math.min((now - animation.start) / TURN_MS, 1)
        const eased = 1 - Math.pow(1 - t, 3)
        animation.leaf.rotation.y = animation.from + (animation.to - animation.from) * eased
        if (t === 1) animations.splice(index, 1)
      }
      renderer.render(scene, camera)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      element.removeEventListener('pointerdown', onPointerDown)
      element.removeEventListener('pointermove', onPointerMove)
      element.removeEventListener('pointerup', onPointerUp)
      element.removeEventListener('pointercancel', onPointerUp)
      element.removeEventListener('wheel', onWheel)
      apiRef.current = null
      for (const item of trash) item.dispose()
      renderer.dispose()
      element.remove()
    }
  }, [markdown, highlight, stampText])

  if (failed) {
    return (
      <div className="brochure-fallback">
        <pre>{markdown}</pre>
      </div>
    )
  }

  return (
    <figure className="brochure">
      <div className="brochure-stage" ref={mountRef} aria-hidden="true" />
      <figcaption className="brochure-controls no-print">
        <span className="brochure-label">{label}</span>
        <span className="brochure-buttons">
          <button type="button" onClick={() => zoom(-0.9)} aria-label="Zoom in">
            +
          </button>
          <button type="button" onClick={() => zoom(0.9)} aria-label="Zoom out">
            −
          </button>
          <button type="button" onClick={() => turn(-1)} aria-label="Previous page" disabled={spread <= 0}>
            ‹
          </button>
          <span className="brochure-count" aria-live="polite">
            {spread === 0 ? 1 : Math.min(spread * 2, leafCount * 2)} / {leafCount * 2}
          </span>
          <button type="button" onClick={() => turn(1)} aria-label="Next page" disabled={spread >= leafCount}>
            ›
          </button>
        </span>
      </figcaption>
      <details className="brochure-text">
        <summary>Read it as plain text</summary>
        <pre>{markdown}</pre>
      </details>
    </figure>
  )
}
