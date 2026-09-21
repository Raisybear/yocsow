import type { SearchRequirement } from '../domain/search-requirements'
import type { SeedMapSettings } from '../domain/seed-map'
import { ResizablePanelGroup } from './ResizablePanelGroup'
import { SearchRequirementsPanel } from './SearchRequirementsPanel'
import { SeedFinderPanel } from './SeedFinderPanel'
import './SeedFinderWorkspace.css'

interface SeedFinderWorkspaceProps {
  requirements: SearchRequirement[]
  onRequirementsChange: (
    requirements: SearchRequirement[],
  ) => void
  seedMap: SeedMapSettings
  onSeedMapChange: (seedMap: SeedMapSettings) => void
  resultLimit: string
  onResultLimitChange: (resultLimit: string) => void
}

export function SeedFinderWorkspace({
  requirements,
  onRequirementsChange,
  seedMap,
  onSeedMapChange,
  resultLimit,
  onResultLimitChange,
}: SeedFinderWorkspaceProps) {
  return (
    <ResizablePanelGroup
      axis="rows"
      label="Resize seed filters and seed search"
      initialPercentage={47}
      minimumPrimaryPixels={240}
      minimumSecondaryPixels={220}
      className="seed-finder-workspace"
    >
      <SearchRequirementsPanel
        requirements={requirements}
        onChange={onRequirementsChange}
        seedMap={seedMap}
        onSeedMapChange={onSeedMapChange}
      />

      <SeedFinderPanel
        requirements={requirements}
        resultLimit={resultLimit}
        onResultLimitChange={onResultLimitChange}
      />
    </ResizablePanelGroup>
  )
}
