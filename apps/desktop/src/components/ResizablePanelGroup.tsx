import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useRef,
  useState,
} from 'react'
import './ResizablePanelGroup.css'

type SplitAxis = 'columns' | 'rows'

interface ResizablePanelGroupProps {
  axis: SplitAxis
  label: string
  initialPercentage: number
  minimumPrimaryPixels: number
  minimumSecondaryPixels: number
  className?: string
  children: [ReactNode, ReactNode]
}

interface SplitStyle extends CSSProperties {
  '--split-primary-size': string
}

const KEYBOARD_STEP = 2

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(Math.max(value, minimum), maximum)
}

export function ResizablePanelGroup({
  axis,
  label,
  initialPercentage,
  minimumPrimaryPixels,
  minimumSecondaryPixels,
  className = '',
  children,
}: ResizablePanelGroupProps) {
  const groupRef = useRef<HTMLDivElement>(null)
  const [primaryPercentage, setPrimaryPercentage] = useState(
    initialPercentage,
  )
  const [dragging, setDragging] = useState(false)

  function resizeToPointer(clientX: number, clientY: number): void {
    const group = groupRef.current

    if (group === null) {
      return
    }

    const bounds = group.getBoundingClientRect()
    const availablePixels =
      axis === 'columns' ? bounds.width : bounds.height

    if (availablePixels <= 0) {
      return
    }

    const pointerPixels =
      axis === 'columns'
        ? clientX - bounds.left
        : clientY - bounds.top
    const minimumPercentage =
      (minimumPrimaryPixels / availablePixels) * 100
    const maximumPercentage =
      100 - (minimumSecondaryPixels / availablePixels) * 100

    setPrimaryPercentage(
      clamp(
        (pointerPixels / availablePixels) * 100,
        minimumPercentage,
        Math.max(minimumPercentage, maximumPercentage),
      ),
    )
  }

  function handlePointerDown(
    event: PointerEvent<HTMLDivElement>,
  ): void {
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDragging(true)
    resizeToPointer(event.clientX, event.clientY)
  }

  function handlePointerMove(
    event: PointerEvent<HTMLDivElement>,
  ): void {
    if (!dragging) {
      return
    }

    resizeToPointer(event.clientX, event.clientY)
  }

  function stopDragging(event: PointerEvent<HTMLDivElement>): void {
    if (!dragging) {
      return
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId)
    setDragging(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const decreaseKey = axis === 'columns' ? 'ArrowLeft' : 'ArrowUp'
    const increaseKey = axis === 'columns' ? 'ArrowRight' : 'ArrowDown'

    if (event.key !== decreaseKey && event.key !== increaseKey) {
      return
    }

    event.preventDefault()
    setPrimaryPercentage((currentPercentage) =>
      clamp(
        currentPercentage +
          (event.key === increaseKey ? KEYBOARD_STEP : -KEYBOARD_STEP),
        5,
        95,
      ),
    )
  }

  const style: SplitStyle = {
    '--split-primary-size': `${primaryPercentage}%`,
  }

  return (
    <div
      className={`resizable-panel-group resizable-panel-group--${axis} ${className}`.trim()}
      data-resizing={dragging || undefined}
      ref={groupRef}
      style={style}
    >
      <div className="resizable-panel resizable-panel--primary">
        {children[0]}
      </div>

      <div
        className="resizable-panel-divider"
        role="separator"
        aria-label={label}
        aria-orientation={axis === 'columns' ? 'vertical' : 'horizontal'}
        aria-valuemin={5}
        aria-valuemax={95}
        aria-valuenow={Math.round(primaryPercentage)}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
      >
        <span aria-hidden="true" />
      </div>

      <div className="resizable-panel resizable-panel--secondary">
        {children[1]}
      </div>
    </div>
  )
}
