import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { Center, useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import {
  Color,
  DoubleSide,
  FrontSide,
  Quaternion,
  Vector3,
  type Camera,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
  type PerspectiveCamera,
} from 'three'
import { canonicalKey, collectionKey, showsDamage } from '../collections'
import { damageLevels, type PartDamage } from '../damage'
import { pickSurface, type TouchedPart } from '../pick'

const MODEL_PATH = '/2019_lamborghini_sc18_alston_fixed.glb'
const BODY_OPACITY = 0.45
const GLASS_TINT = new Color('#c5d0dc')

type GlassMaterial = MeshStandardMaterial & {
  userData: {
    glassBase?: { color: Color; metalness: number; roughness: number; emissive: Color; emissiveIntensity: number }
    collectionKey?: string
  }
}

const DAMAGE_RED = new Color(0.95, 0.08, 0.06)
const SELECT_BLUE = new Color(0.12, 0.4, 1)
const collectionMaterials = new WeakMap<MeshStandardMaterial, Map<string, GlassMaterial>>()
const sourceMaterial = new WeakMap<Mesh, GlassMaterial | GlassMaterial[]>()

function setMaterials(mesh: Mesh, materials: GlassMaterial[]) {
  const source = sourceMaterial.get(mesh)
  mesh.material = Array.isArray(source) ? materials : materials[0]
}

function rememberSurface(surface: GlassMaterial) {
  if (!surface.color || surface.userData.glassBase?.emissive) return
  surface.userData.glassBase = {
    color: surface.color.clone(),
    metalness: surface.metalness ?? 0,
    roughness: surface.roughness ?? 0.5,
    emissive: surface.emissive ? surface.emissive.clone() : new Color(0, 0, 0),
    emissiveIntensity: surface.emissiveIntensity ?? 0,
  }
}

// Paint, carbon, and trim are one material shared across every collection.
// Each collection gets its own copy so a highlight stops at that collection.
function variantFor(surface: GlassMaterial, key: string) {
  if (!surface.color || surface.userData.collectionKey === key) return surface
  let bucket = collectionMaterials.get(surface)
  if (!bucket) {
    bucket = new Map()
    collectionMaterials.set(surface, bucket)
  }
  const cached = bucket.get(key)
  if (cached) return cached
  const copy = surface.clone() as GlassMaterial
  copy.name = surface.name
  copy.userData = { collectionKey: key }
  rememberSurface(copy)
  bucket.set(key, copy)
  return copy
}

function sourceList(mesh: Mesh) {
  const saved = sourceMaterial.get(mesh)
  if (saved) return Array.isArray(saved) ? saved : [saved]
  const current = mesh.material as GlassMaterial | GlassMaterial[]
  sourceMaterial.set(mesh, current)
  return Array.isArray(current) ? current : [current]
}

function tint(surface: GlassMaterial, color: Color, amount: number, transparent: boolean) {
  const base = surface.userData.glassBase
  if (!base || amount <= 0) return
  surface.color.copy(base.color).lerp(color, amount)
  surface.metalness = 0.05
  surface.roughness = 0.45
  if (surface.emissive) {
    surface.emissive.copy(color)
    surface.emissiveIntensity = 0.75 * amount
  }
  surface.opacity = 1
  surface.transparent = false
  surface.depthWrite = true
  surface.side = transparent ? DoubleSide : FrontSide
}

function applyBodyStyle(scene: Group, damage: PartDamage[], selected: string | null, transparent: boolean) {
  const levels = damageLevels(damage)
  const selectedKey = selected ? canonicalKey(selected) : ''
  scene.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    const key = collectionKey(mesh)
    const marked = levels.get(canonicalKey(key)) ?? 0
    const picked = selectedKey !== '' && canonicalKey(key) === selectedKey
    const highlight = picked || (marked > 0 && showsDamage(mesh.name, key))
    const sources = sourceList(mesh)
    for (const material of sources) rememberSurface(material)
    const materials = highlight ? sources.map((material) => variantFor(material, key)) : sources
    setMaterials(mesh, materials)
    for (const surface of materials) {
      if (!surface.color) continue
      rememberSurface(surface)
      const base = surface.userData.glassBase
      if (!base) continue
      if (transparent) {
        surface.color.copy(base.color).lerp(GLASS_TINT, 0.55)
        surface.transparent = true
        surface.opacity = BODY_OPACITY
        surface.depthWrite = false
        surface.side = DoubleSide
        surface.metalness = base.metalness * 0.25
        surface.roughness = base.roughness
        surface.envMapIntensity = 1
        if (surface.emissive) {
          surface.emissive.copy(surface.color)
          surface.emissiveIntensity = 0.18
        }
      } else {
        surface.color.copy(base.color)
        surface.transparent = false
        surface.opacity = 1
        surface.depthWrite = true
        surface.side = FrontSide
        surface.metalness = base.metalness
        surface.roughness = base.roughness
        surface.envMapIntensity = 1
        if (surface.emissive) {
          surface.emissive.copy(base.emissive)
          surface.emissiveIntensity = base.emissiveIntensity
        }
      }
      if (picked) tint(surface, SELECT_BLUE, 1, transparent)
      else if (highlight && marked > 0) tint(surface, DAMAGE_RED, marked, transparent)
      surface.needsUpdate = true
    }
  })
}
const WORLD_UP = new Vector3(0, 1, 0)
// About 49° either side of the starting tilt, so a vertical drag cannot flip the car.
const PITCH_RANGE = 0.85

function clampPitch(pitch: number, origin: number) {
  return Math.min(origin + PITCH_RANGE, Math.max(origin - PITCH_RANGE, pitch))
}

// Drag scale follows the window, not the canvas. The injury panel shrinks the
// canvas, and dividing by that width made the car spin faster.
function dragUnits(camera: Camera) {
  const distance = Math.max(camera.position.length(), 0.001)
  const fov = 'fov' in camera ? (camera as PerspectiveCamera).fov : 45
  const height = 2 * Math.tan((fov * Math.PI) / 360) * distance
  const aspect = window.innerWidth / Math.max(window.innerHeight, 1)
  return { width: height * aspect, height }
}

type CarProps = {
  setIsRotating: (value: boolean) => void
  setCurrentStage: (stage: number | null) => void
  scale?: number
  position?: [number, number, number]
  rotation?: [number, number, number]
  onCentered?: () => void
  damage: PartDamage[]
  selected: string | null
  transparent: boolean
  onPick: (part: TouchedPart | null) => void
}

export function Car({
  setIsRotating,
  setCurrentStage,
  scale = 1,
  position = [0, 0, 0],
  rotation = [0.1, 0.6, 0],
  onCentered,
  damage,
  selected,
  transparent,
  onPick,
}: CarProps) {
  const { scene } = useGLTF(MODEL_PATH)
  const { camera, gl } = useThree()
  const modelRef = useRef<Group>(null)
  const lastX = useRef(0)
  const lastY = useRef(0)
  const rotationSpeed = useRef(0)
  const pitchSpeed = useRef(0)
  const dampingFactor = 0.95
  const isRotatingRef = useRef(false)
  const stageRef = useRef<number | null>(null)
  const framed = useRef(false)
  const initialRotation = useRef(rotation)
  const yaw = useRef(rotation[1])
  const pitch = useRef(rotation[0])
  const camRight = useRef(new Vector3())
  const yawQuat = useRef(new Quaternion())
  const pitchQuat = useRef(new Quaternion())
  const onCenteredRef = useRef(onCentered)
  const onPickRef = useRef(onPick)
  const pointerDown = useRef({ x: 0, y: 0 })

  useLayoutEffect(() => {
    applyBodyStyle(scene, damage, selected, transparent)
  }, [damage, selected, scene, transparent])

  useEffect(() => {
    onCenteredRef.current = onCentered
    onPickRef.current = onPick
  })

  const handleCentered = useCallback(() => {
    if (framed.current) return
    framed.current = true
    onCenteredRef.current?.()
  }, [])

  // Yaw spins around world up. Pitch tilts around the camera's screen-right,
  // so a vertical drag stays vertical after the car has been turned.
  const applyOrientation = useCallback(() => {
    const model = modelRef.current
    if (!model) return
    camera.updateMatrixWorld()
    camRight.current.setFromMatrixColumn(camera.matrixWorld, 0)
    yawQuat.current.setFromAxisAngle(WORLD_UP, yaw.current)
    pitchQuat.current.setFromAxisAngle(camRight.current, pitch.current)
    model.quaternion.copy(pitchQuat.current).multiply(yawQuat.current)
  }, [camera])

  useEffect(() => {
    const canvas = gl.domElement

    const handlePointerDown = (event: PointerEvent) => {
      event.stopPropagation()
      event.preventDefault()
      isRotatingRef.current = true
      setIsRotating(true)
      lastX.current = event.clientX
      lastY.current = event.clientY
      pointerDown.current.x = event.clientX
      pointerDown.current.y = event.clientY
      canvas.setPointerCapture(event.pointerId)
    }

    const handlePointerUp = (event: PointerEvent) => {
      event.stopPropagation()
      event.preventDefault()
      isRotatingRef.current = false
      setIsRotating(false)
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId)
      }
      const dx = event.clientX - pointerDown.current.x
      const dy = event.clientY - pointerDown.current.y
      // A drag rotates the car. A pointer that barely moves is a click on a part.
      if (dx * dx + dy * dy <= 64) {
        const model = modelRef.current
        onPickRef.current(model ? pickSurface(camera, model, canvas, event.clientX, event.clientY) : null)
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!isRotatingRef.current) return
      event.stopPropagation()
      event.preventDefault()
      const { width, height } = dragUnits(camera)
      const deltaX = (event.clientX - lastX.current) / width
      const deltaY = (event.clientY - lastY.current) / height
      const deltaRotation = deltaX * Math.PI * 0.001
      const deltaPitch = deltaY * Math.PI * 0.001
      const nextPitch = clampPitch(pitch.current + deltaPitch, initialRotation.current[0])

      yaw.current += deltaRotation
      pitchSpeed.current = nextPitch - pitch.current
      pitch.current = nextPitch
      rotationSpeed.current = deltaRotation
      lastX.current = event.clientX
      lastY.current = event.clientY
      applyOrientation()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const turn = 0.01 * Math.PI
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        if (!isRotatingRef.current) {
          isRotatingRef.current = true
          setIsRotating(true)
        }
        yaw.current += event.key === 'ArrowLeft' ? turn : -turn
        applyOrientation()
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (!isRotatingRef.current) {
          isRotatingRef.current = true
          setIsRotating(true)
        }
        const direction = event.key === 'ArrowDown' ? 1 : -1
        pitch.current = clampPitch(pitch.current + direction * turn, initialRotation.current[0])
        applyOrientation()
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (
        event.key === 'ArrowLeft' ||
        event.key === 'ArrowRight' ||
        event.key === 'ArrowUp' ||
        event.key === 'ArrowDown'
      ) {
        isRotatingRef.current = false
        setIsRotating(false)
      }
    }

    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
    }
  }, [applyOrientation, camera, gl, setIsRotating])

  useFrame(() => {
    if (!isRotatingRef.current) {
      rotationSpeed.current *= dampingFactor
      pitchSpeed.current *= dampingFactor
      if (Math.abs(rotationSpeed.current) < 0.001) rotationSpeed.current = 0
      if (Math.abs(pitchSpeed.current) < 0.001) pitchSpeed.current = 0

      const proposedPitch = pitch.current + pitchSpeed.current
      const nextPitch = clampPitch(proposedPitch, initialRotation.current[0])
      if (Math.abs(nextPitch - proposedPitch) > 1e-6) pitchSpeed.current = 0
      pitch.current = nextPitch
      yaw.current += rotationSpeed.current
    }

    applyOrientation()

    const normalizedRotation = ((yaw.current % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)

    let stage: number | null = null
    if (normalizedRotation >= 5.45 && normalizedRotation <= 5.85) stage = 4
    else if (normalizedRotation >= 0.85 && normalizedRotation <= 1.3) stage = 3
    else if (normalizedRotation >= 2.4 && normalizedRotation <= 2.6) stage = 2
    else if (normalizedRotation >= 4.25 && normalizedRotation <= 4.75) stage = 1

    if (stage !== stageRef.current) {
      stageRef.current = stage
      setCurrentStage(stage)
    }
  })

  return (
    <group dispose={null} ref={modelRef} scale={scale} position={position}>
      <Center onCentered={handleCentered}>
        <primitive object={scene} />
      </Center>
    </group>
  )
}

useGLTF.preload(MODEL_PATH)
