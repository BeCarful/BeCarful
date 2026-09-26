import { Raycaster, Vector2, type Camera, type Intersection, type Material, type Mesh, type Object3D } from 'three'
import { collectionKey, collectionLabel } from './collections'

const raycaster = new Raycaster()
const pointer = new Vector2()

export type TouchedPart = {
  material: string
  materialExact: string
  mesh: string
  collection: string
  collectionLabel: string
}

/** Turns a Sketchfab export name into a short label. The exact glTF name is kept separately. */
export function readableMaterial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return 'Unnamed material'
  let body = trimmed.replace(/^Lambo:?Lamborghini_SC18Alston_/, '')
  body = body.replace(/^2019_?/, '')
  body = body.replace(/_Material1$/, '')
  body = body.replace(/A_3D_3DWheel1A$/, '')
  if (!/^int_/i.test(body)) body = body.replace(/A$/, '')
  return body
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d+)/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
}

function materialOnFace(mesh: Mesh, hit: Intersection): Material | undefined {
  const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  const index = hit.face?.materialIndex ?? 0
  return list[index] ?? list[0]
}

function sourceName(object: Object3D): string {
  const stored = object.userData?.name
  if (typeof stored === 'string' && stored.trim()) return stored
  return object.name
}

function readableMesh(object: Object3D): string {
  let current: Object3D | null = object
  while (current) {
    const name = sourceName(current)
    if ((/^3DWheel /.test(name) || /^Calliper/.test(name)) && name.length < 48) return name
    current = current.parent
  }
  const geo = sourceName(object).match(/([A-Za-z][A-Za-z0-9]*)_Geo/)
  if (geo) return readableMaterial(geo[1])
  return readableMaterial(sourceName(object))
}

export function pickSurface(
  camera: Camera,
  root: Object3D,
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): TouchedPart | null {
  const rect = canvas.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return null
  pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
  camera.updateMatrixWorld()
  raycaster.setFromCamera(pointer, camera)
  root.updateWorldMatrix(true, true)
  const hit = raycaster.intersectObject(root, true).find((item) => (item.object as Mesh).isMesh)
  if (!hit) return null
  const mesh = hit.object as Mesh
  const material = materialOnFace(mesh, hit)
  const materialExact = material?.name?.trim() || 'Unnamed material'
  const collection = collectionKey(mesh)
  return {
    material: readableMaterial(materialExact === 'Unnamed material' ? '' : materialExact),
    materialExact,
    mesh: readableMesh(mesh),
    collection,
    collectionLabel: collectionLabel(collection),
  }
}
