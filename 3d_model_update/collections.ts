import { PropertyBinding, type Object3D } from 'three'

const SCENE_NAME = 'Scene'

/** The glTF loader stores "Right Door" as "Right_Door". Matching is case-insensitive. */
export function canonicalKey(name: string) {
  return PropertyBinding.sanitizeNodeName(name.trim()).toLowerCase()
}

export function collectionLabel(name: string) {
  return name.replace(/_\|_/g, ' | ').replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
}

/** The collection that owns this mesh: a group such as Right_Door, or the wheel name before the material slot. */
export function collectionKey(object: Object3D) {
  let current = object
  while (current.parent && current.parent.name !== SCENE_NAME) current = current.parent
  const [group] = current.name.split('_|_')
  return group || current.name
}

/** Windows and the inner door card stay clear unless that collection is the part being marked. */
export function showsDamage(meshName: string, collectionName: string) {
  const mesh = meshName.toLowerCase()
  const collection = collectionName.toLowerCase()
  if (mesh.includes('glass') && !/glass|windshield|lens/.test(collection)) return false
  if ((mesh.includes('interior') || mesh.includes('upholstery')) && !collection.includes('interior')) return false
  return true
}
