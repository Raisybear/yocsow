export const SEED_MAP_FILTER_DRAG_TYPE =
  'application/x-yocsow-filter-id'

export function writeDraggedFilterId(
  dataTransfer: DataTransfer,
  filterId: string,
): void {
  dataTransfer.effectAllowed = 'copy'
  dataTransfer.setData(SEED_MAP_FILTER_DRAG_TYPE, filterId)
}

export function readDraggedFilterId(
  dataTransfer: DataTransfer,
): string | undefined {
  const filterId = dataTransfer.getData(SEED_MAP_FILTER_DRAG_TYPE).trim()

  return filterId.length === 0 ? undefined : filterId
}

export function containsDraggedFilter(
  dataTransfer: DataTransfer,
): boolean {
  return Array.from(dataTransfer.types).includes(
    SEED_MAP_FILTER_DRAG_TYPE,
  )
}
