import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bounds, Environment, useBounds } from '@react-three/drei'
import { canonicalKey } from '../collections'
import { DEMO_DAMAGE, parseDamage, type PartDamage } from '../damage'
import { InjuryPanel, type InjuryPhoto } from '../InjuryPanel'
import { Car } from '../Models/Car'
import type { TouchedPart } from '../pick'

function FramedCar({
  setIsRotating,
  setCurrentStage,
  scale,
  position,
  rotation,
  transparent,
  damage,
  selected,
  onPick,
}: {
  setIsRotating: (value: boolean) => void
  setCurrentStage: (stage: number | null) => void
  scale: number
  position: [number, number, number]
  rotation: [number, number, number]
  transparent: boolean
  damage: PartDamage[]
  selected: string | null
  onPick: (part: TouchedPart | null) => void
}) {
  const bounds = useBounds()

  return (
    <Car
      setIsRotating={setIsRotating}
      setCurrentStage={setCurrentStage}
      scale={scale}
      position={position}
      rotation={rotation}
      damage={damage}
      selected={selected}
      transparent={transparent}
      onPick={onPick}
      onCentered={() => {
        bounds.refresh().clip().fit()
      }}
    />
  )
}

const HomePage = () => {
  const [isRotating, setIsRotating] = useState(false)
  const [currentStage, setCurrentStage] = useState<number | null>(null)
  const [transparent, setTransparent] = useState(true)
  const [touched, setTouched] = useState<TouchedPart | null>(null)
  const [missed, setMissed] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [damage, setDamage] = useState<PartDamage[]>(DEMO_DAMAGE)
  const [photos, setPhotos] = useState<Record<string, InjuryPhoto[]>>({})
  const photosRef = useRef(photos)
  photosRef.current = photos

  useEffect(() => {
    return () => {
      for (const list of Object.values(photosRef.current)) {
        for (const photo of list) URL.revokeObjectURL(photo.url)
      }
    }
  }, [])

  useEffect(() => {
    let active = true
    fetch('/damage.json')
      .then((response) => {
        if (!response.ok) throw new Error('missing damage file')
        return response.json()
      })
      .then((data) => {
        if (!active) return
        const parts = parseDamage(data)
        if (parts.length) setDamage(parts)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const handlePick = (part: TouchedPart | null) => {
    if (!part) {
      setTouched(null)
      setMissed(true)
      setSelected(null)
      return
    }
    if (selected === part.collection) {
      setSelected(null)
      setTouched(null)
      setMissed(false)
      return
    }
    setSelected(part.collection)
    setTouched(part)
    setMissed(false)
  }

  const addPhotos = (files: File[]) => {
    if (!selected || files.length === 0) return
    const key = selected
    const added = files.map((file) => ({
      id: crypto.randomUUID(),
      url: URL.createObjectURL(file),
      name: file.name,
    }))
    setPhotos((current) => ({ ...current, [key]: [...(current[key] ?? []), ...added] }))
  }

  const removePhoto = (id: string) => {
    if (!selected) return
    const key = selected
    setPhotos((current) => {
      const list = current[key] ?? []
      const photo = list.find((item) => item.id === id)
      if (photo) URL.revokeObjectURL(photo.url)
      return { ...current, [key]: list.filter((item) => item.id !== id) }
    })
  }

  const selectedLevel =
    selected === null
      ? null
      : (damage.find((item) => canonicalKey(item.part) === canonicalKey(selected))?.level ?? null)

  const mobile = window.innerWidth < 768
  const screenScale = mobile ? 0.9 : 1
  const screenPosition: [number, number, number] = [0, 0, 0]
  const rotation: [number, number, number] = [0.1, 0.6, 0]

  return (
    <div className={selected && touched ? 'viewer tracking' : 'viewer'}>
      <div className="stage">
      <Canvas
        style={{
          height: '100%',
          width: '100%',
          cursor: isRotating ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
        camera={{ position: [5, 2, 6], fov: 45, near: 0.1, far: 200 }}
      >
        <color attach="background" args={['#ffffff']} />
        <directionalLight position={[10, 10, 10]} intensity={2} />
        <ambientLight intensity={0.5} />
        <hemisphereLight color="#b1e1ff" groundColor="#000000" intensity={1} />
        <Suspense fallback={null}>
          <Environment preset="city" />
          <Bounds fit clip margin={1.35}>
            <FramedCar
              scale={screenScale}
              position={screenPosition}
              rotation={rotation}
              setIsRotating={setIsRotating}
              setCurrentStage={setCurrentStage}
              transparent={transparent}
              damage={damage}
              selected={selected}
              onPick={handlePick}
            />
          </Bounds>
        </Suspense>
      </Canvas>
      <button
        type="button"
        className="toggle"
        aria-pressed={transparent}
        onClick={() => setTransparent((value) => !value)}
      >
        {transparent ? 'Transparency on' : 'Transparency off'}
      </button>
      {!selected && (
      <aside className="pick" aria-live="polite" data-pick={touched ? 'hit' : missed ? 'miss' : 'idle'}>
        {touched ? (
          <>
            <p className="pick-kicker">Collection</p>
            <p className="pick-name">{touched.collectionLabel}</p>
            <p className="pick-kicker pick-material">Material</p>
            <p className="pick-name pick-material-name">{touched.material}</p>
            <p className="pick-exact">
              {touched.materialExact.split('_').map((part, index) => (
                <span key={`${part}-${index}`}>
                  {index > 0 ? '_' : ''}
                  {part}
                  <wbr />
                </span>
              ))}
            </p>
            <p className="pick-mesh">Mesh · {touched.mesh}</p>
          </>
        ) : missed ? (
          <p className="pick-name">No part under the pointer</p>
        ) : (
          <>
            <p className="pick-kicker">Material</p>
            <p className="pick-name">Click a part of the car</p>
          </>
        )}
      </aside>
      )}
      {damage.length > 0 && (
        <ul className="damage">
          {damage.map((item) => (
            <li key={item.part}>
              <span>{item.part}</span>
              <span>{Math.round(item.level * 100)}%</span>
            </li>
          ))}
        </ul>
      )}
      <p className="hint">
        {currentStage ? `View ${currentStage} · ` : ''}
        Drag or use the arrow keys to rotate. Click a part to track its injury.
      </p>
      </div>
      {selected && touched && (
        <InjuryPanel
          part={touched}
          level={selectedLevel}
          photos={photos[selected] ?? []}
          onAdd={addPhotos}
          onRemove={removePhoto}
        />
      )}
    </div>
  )
}

export default HomePage
