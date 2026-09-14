import type { SearchRequirement } from '../domain/search-requirements'
import { SearchRequirementsPanel } from './SearchRequirementsPanel'
import { SeedFinderPanel } from './SeedFinderPanel'
import './SeedFinderWorkspace.css'

interface SeedFinderWorkspaceProps {
  requirements: SearchRequirement[]
  onRequirementsChange: (
    requirements: SearchRequirement[],
  ) => void
}

export function SeedFinderWorkspace({
  requirements,
  onRequirementsChange,
}: SeedFinderWorkspaceProps) {
  return (
    <div className="seed-finder-workspace">
      <SearchRequirementsPanel
        requirements={requirements}
        onChange={onRequirementsChange}
      />

      <SeedFinderPanel requirements={requirements} />
    </div>
  )
}
