import { useState } from 'react'
import type { TouchedPart } from './pick'

export type InjuryPhoto = {
  id: string
  url: string
  name: string
}

type InjuryPanelProps = {
  part: TouchedPart
  level: number | null
  photos: InjuryPhoto[]
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
}

function imagesIn(files: FileList | File[] | null) {
  if (!files) return []
  return [...files].filter((file) => file.type.startsWith('image/'))
}

export function InjuryPanel({ part, level, photos, onAdd, onRemove }: InjuryPanelProps) {
  const [over, setOver] = useState(false)

  return (
    <aside className="injury" aria-label={`Injury record for ${part.collectionLabel}`}>
      <p className="pick-kicker">Injury</p>
      <h2 className="injury-title">{part.collectionLabel}</h2>
      {level !== null && <p className="injury-level">Damage {Math.round(level * 100)}%</p>}
      <p className="injury-meta">
        {part.material}
        <span> · {part.mesh}</span>
      </p>
      <label
        className={over ? 'injury-drop injury-drop-over' : 'injury-drop'}
        onDragOver={(event) => {
          event.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setOver(false)
          onAdd(imagesIn(event.dataTransfer.files))
        }}
      >
        <span>Post an injury photo</span>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => {
            onAdd(imagesIn(event.target.files))
            event.target.value = ''
          }}
        />
      </label>
      {photos.length === 0 ? (
        <p className="injury-empty">Photos posted here stay with {part.collectionLabel}.</p>
      ) : (
        <ul className="injury-photos">
          {photos.map((photo) => (
            <li key={photo.id}>
              <img src={photo.url} alt={photo.name} />
              <div className="injury-photo-bar">
                <span>{photo.name}</span>
                <button type="button" onClick={() => onRemove(photo.id)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
