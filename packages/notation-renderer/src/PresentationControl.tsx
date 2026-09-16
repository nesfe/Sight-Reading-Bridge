import { Columns3, Rows3, Music2 } from 'lucide-react'
import type { Scaffold } from '../../curriculum/src'
import { presentationOf, selectPresentation } from '../../curriculum/src/presentation'

export function PresentationControl({ scaffold, onChange }: { scaffold: Scaffold; onChange: (next: Scaffold) => void }) {
  const options = [
    { id: 'vertical', label: 'Вертикальные полосы', Icon: Columns3 },
    { id: 'horizontal', label: 'Горизонтальные полосы', Icon: Rows3 },
    { id: 'standard', label: 'Обычный нотный стан', Icon: Music2 },
  ] as const
  return <div className="presentation-control" role="radiogroup" aria-label="Представление нотного стана">
    {options.map(({ id, label, Icon }, index) => <button key={id} type="button" role="radio" aria-checked={presentationOf(scaffold) === id} onClick={() => onChange(selectPresentation(scaffold, id))}><Icon size={17}/><span><small>{index + 1}</small>{label}</span></button>)}
  </div>
}
