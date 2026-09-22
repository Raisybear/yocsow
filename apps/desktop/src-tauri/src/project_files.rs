use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::error::Error;
use std::fmt::{self, Display, Formatter};
use std::fs;
use std::path::Path;

const VERSION_ONE_PROJECT_FORMAT: u32 = 1;
const VERSION_TWO_PROJECT_FORMAT: u32 = 2;
const VERSION_THREE_PROJECT_FORMAT: u32 = 3;
const VERSION_FOUR_PROJECT_FORMAT: u32 = 4;
const PROJECT_FORMAT_VERSION: u32 = 5;
const PROJECT_EXTENSION: &str = "yocsow";
const MAX_PROJECT_FILE_SIZE: usize = 1024 * 1024;
const MAX_PROJECT_NAME_LENGTH: usize = 120;
const MAX_SEARCH_REQUIREMENTS: usize = 64;
const MAX_REQUIREMENT_ID_LENGTH: usize = 120;
const MAX_SEARCH_RADIUS_BLOCKS: u64 = 60_000_000;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProjectDocument {
    format_version: u32,
    name: String,
    search_requirements: Vec<ProjectSearchRequirement>,
    seed_map: ProjectSeedMap,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ProjectSeedMap {
    visible: bool,
    seed: String,
}

impl Default for ProjectSeedMap {
    fn default() -> Self {
        Self {
            visible: false,
            seed: "0".into(),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct DiscardedSeedRange {
    #[serde(rename = "minimum")]
    _minimum: String,
    #[serde(rename = "maximum")]
    _maximum: String,
    #[serde(rename = "seed")]
    _seed: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", deny_unknown_fields)]
pub enum ProjectSearchRequirement {
    #[serde(rename = "structure")]
    Structure {
        id: String,
        #[serde(rename = "structureType")]
        structure_type: ProjectStructureType,
        center: ProjectBlockPosition,
        #[serde(rename = "radiusBlocks")]
        radius_blocks: u64,
    },
    #[serde(rename = "biome")]
    Biome {
        id: String,
        #[serde(rename = "biomeType")]
        biome_type: ProjectBiomeType,
        center: ProjectBlockPosition,
        size: ProjectBiomeSize,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ProjectStructureType {
    Village,
    RuinedPortal,
    WoodlandMansion,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ProjectBiomeType {
    Taiga,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ProjectBiomeSize {
    Tiny,
    Small,
    Big,
    Gigantic,
    Enormous,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProjectBlockPosition {
    x: i64,
    z: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct VersionOneProjectDocument {
    format_version: u32,
    name: String,
    #[serde(rename = "seedRange")]
    _seed_range: DiscardedSeedRange,
}

impl VersionOneProjectDocument {
    fn migrate(self) -> ProjectDocument {
        debug_assert_eq!(self.format_version, VERSION_ONE_PROJECT_FORMAT);

        ProjectDocument {
            format_version: PROJECT_FORMAT_VERSION,
            name: self.name,
            search_requirements: Vec::new(),
            seed_map: ProjectSeedMap::default(),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct VersionTwoProjectDocument {
    format_version: u32,
    name: String,
    #[serde(rename = "seedRange")]
    _seed_range: DiscardedSeedRange,
    search_requirements: Vec<ProjectSearchRequirement>,
}

impl VersionTwoProjectDocument {
    fn migrate(self) -> ProjectDocument {
        debug_assert_eq!(self.format_version, VERSION_TWO_PROJECT_FORMAT);

        ProjectDocument {
            format_version: PROJECT_FORMAT_VERSION,
            name: self.name,
            search_requirements: self.search_requirements,
            seed_map: ProjectSeedMap::default(),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct VersionThreeProjectDocument {
    format_version: u32,
    name: String,
    search_requirements: Vec<ProjectSearchRequirement>,
}

impl VersionThreeProjectDocument {
    fn migrate(self) -> ProjectDocument {
        debug_assert_eq!(self.format_version, VERSION_THREE_PROJECT_FORMAT);

        ProjectDocument {
            format_version: PROJECT_FORMAT_VERSION,
            name: self.name,
            search_requirements: self.search_requirements,
            seed_map: ProjectSeedMap::default(),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct VersionFourProjectDocument {
    format_version: u32,
    name: String,
    search_requirements: Vec<ProjectSearchRequirement>,
}

impl VersionFourProjectDocument {
    fn migrate(self) -> ProjectDocument {
        debug_assert_eq!(self.format_version, VERSION_FOUR_PROJECT_FORMAT);

        ProjectDocument {
            format_version: PROJECT_FORMAT_VERSION,
            name: self.name,
            search_requirements: self.search_requirements,
            seed_map: ProjectSeedMap::default(),
        }
    }
}

impl ProjectDocument {
    fn validate(&self) -> Result<(), ProjectFileError> {
        if self.format_version != PROJECT_FORMAT_VERSION {
            return Err(ProjectFileError::Validation(format!(
                "unsupported project format version {}; expected {PROJECT_FORMAT_VERSION}",
                self.format_version
            )));
        }

        let trimmed_name = self.name.trim();

        if trimmed_name.is_empty() {
            return Err(ProjectFileError::Validation(
                "project name must not be empty".into(),
            ));
        }

        if trimmed_name.chars().count() > MAX_PROJECT_NAME_LENGTH {
            return Err(ProjectFileError::Validation(format!(
                "project name must not exceed {MAX_PROJECT_NAME_LENGTH} characters"
            )));
        }

        if self.search_requirements.len() > MAX_SEARCH_REQUIREMENTS {
            return Err(ProjectFileError::Validation(format!(
                "project must not contain more than {MAX_SEARCH_REQUIREMENTS} search requirements"
            )));
        }

        self.seed_map.seed.parse::<i64>().map_err(|_| {
            ProjectFileError::Validation("seed map seed must be a signed 64-bit integer".into())
        })?;

        let mut requirement_ids = HashSet::new();

        for requirement in &self.search_requirements {
            validate_requirement_id(requirement.id(), &mut requirement_ids)?;

            match requirement {
                ProjectSearchRequirement::Structure { radius_blocks, .. } => {
                    if *radius_blocks == 0 || *radius_blocks > MAX_SEARCH_RADIUS_BLOCKS {
                        return Err(ProjectFileError::Validation(format!(
                            "search radius must be between 1 and {MAX_SEARCH_RADIUS_BLOCKS} blocks"
                        )));
                    }
                }
                ProjectSearchRequirement::Biome { .. } => {}
            }
        }

        Ok(())
    }
}

impl ProjectSearchRequirement {
    fn id(&self) -> &str {
        match self {
            Self::Structure { id, .. } | Self::Biome { id, .. } => id,
        }
    }
}

fn validate_requirement_id<'a>(
    id: &'a str,
    requirement_ids: &mut HashSet<&'a str>,
) -> Result<(), ProjectFileError> {
    let trimmed_id = id.trim();

    if trimmed_id.is_empty() {
        return Err(ProjectFileError::Validation(
            "search requirement ID must not be empty".into(),
        ));
    }

    if trimmed_id.chars().count() > MAX_REQUIREMENT_ID_LENGTH {
        return Err(ProjectFileError::Validation(format!(
            "search requirement ID must not exceed {MAX_REQUIREMENT_ID_LENGTH} characters"
        )));
    }

    if trimmed_id != id {
        return Err(ProjectFileError::Validation(
            "search requirement ID must not contain surrounding whitespace".into(),
        ));
    }

    if !requirement_ids.insert(id) {
        return Err(ProjectFileError::Validation(format!(
            "duplicate search requirement ID: {id}"
        )));
    }

    Ok(())
}

pub(crate) fn load_project(path: &Path) -> Result<ProjectDocument, ProjectFileError> {
    validate_project_path(path)?;

    let metadata = fs::metadata(path)?;

    if !metadata.is_file() {
        return Err(ProjectFileError::Validation(
            "project path must reference a file".into(),
        ));
    }

    if metadata.len() > MAX_PROJECT_FILE_SIZE as u64 {
        return Err(ProjectFileError::Validation(format!(
            "project file must not exceed {MAX_PROJECT_FILE_SIZE} bytes"
        )));
    }

    let contents = fs::read_to_string(path)?;
    let value: Value = serde_json::from_str(&contents)?;
    let format_version = value
        .get("formatVersion")
        .and_then(Value::as_u64)
        .ok_or_else(|| {
            ProjectFileError::Validation(
                "project format version must be a non-negative integer".into(),
            )
        })?;

    let project = match format_version {
        version if version == u64::from(VERSION_ONE_PROJECT_FORMAT) => {
            let project: VersionOneProjectDocument = serde_json::from_value(value)?;
            project.migrate()
        }
        version if version == u64::from(VERSION_TWO_PROJECT_FORMAT) => {
            let project: VersionTwoProjectDocument = serde_json::from_value(value)?;
            project.migrate()
        }
        version if version == u64::from(VERSION_THREE_PROJECT_FORMAT) => {
            let project: VersionThreeProjectDocument = serde_json::from_value(value)?;
            project.migrate()
        }
        version if version == u64::from(VERSION_FOUR_PROJECT_FORMAT) => {
            let project: VersionFourProjectDocument = serde_json::from_value(value)?;
            project.migrate()
        }
        version if version == u64::from(PROJECT_FORMAT_VERSION) => serde_json::from_value(value)?,
        unsupported_version => {
            return Err(ProjectFileError::Validation(format!(
                "unsupported project format version {unsupported_version}; expected {PROJECT_FORMAT_VERSION}"
            )));
        }
    };

    project.validate()?;

    Ok(project)
}

pub(crate) fn save_project(path: &Path, project: &ProjectDocument) -> Result<(), ProjectFileError> {
    validate_project_path(path)?;
    project.validate()?;

    if let Some(parent) = path.parent()
        && !parent.as_os_str().is_empty()
        && !parent.is_dir()
    {
        return Err(ProjectFileError::Validation(
            "project directory does not exist".into(),
        ));
    }

    let mut contents = serde_json::to_string_pretty(project)?;
    contents.push('\n');

    if contents.len() > MAX_PROJECT_FILE_SIZE {
        return Err(ProjectFileError::Validation(format!(
            "project file must not exceed {MAX_PROJECT_FILE_SIZE} bytes"
        )));
    }

    fs::write(path, contents)?;

    Ok(())
}

fn validate_project_path(path: &Path) -> Result<(), ProjectFileError> {
    let valid_extension = path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case(PROJECT_EXTENSION));

    if !valid_extension {
        return Err(ProjectFileError::Validation(format!(
            "project file must use the .{PROJECT_EXTENSION} extension"
        )));
    }

    Ok(())
}

#[derive(Debug)]
pub(crate) enum ProjectFileError {
    Io(std::io::Error),
    Json(serde_json::Error),
    Validation(String),
}

impl Display for ProjectFileError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        match self {
            Self::Io(error) => write!(formatter, "project file I/O error: {error}"),
            Self::Json(error) => write!(formatter, "invalid project JSON: {error}"),
            Self::Validation(message) => write!(formatter, "invalid project: {message}"),
        }
    }
}

impl Error for ProjectFileError {}

impl From<std::io::Error> for ProjectFileError {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error)
    }
}

impl From<serde_json::Error> for ProjectFileError {
    fn from(error: serde_json::Error) -> Self {
        Self::Json(error)
    }
}

#[cfg(test)]
mod tests {
    use super::{
        PROJECT_FORMAT_VERSION, ProjectBiomeSize, ProjectBiomeType, ProjectBlockPosition,
        ProjectDocument, ProjectSearchRequirement, ProjectSeedMap, ProjectStructureType,
        VERSION_FOUR_PROJECT_FORMAT, VERSION_ONE_PROJECT_FORMAT, VERSION_THREE_PROJECT_FORMAT,
        VERSION_TWO_PROJECT_FORMAT, load_project, save_project,
    };
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::sync::atomic::{AtomicU64, Ordering};

    static NEXT_TEST_ID: AtomicU64 = AtomicU64::new(1);

    #[test]
    fn saves_and_loads_a_project() {
        let path = test_path("world.yocsow");
        let project = sample_project();

        save_project(&path, &project).expect("project should be saved");

        let contents = fs::read_to_string(&path).expect("saved project should be readable");
        let loaded = load_project(&path).expect("project should be loaded");

        assert!(contents.ends_with('\n'));
        assert!(contents.contains(r#""formatVersion": 5"#));
        assert!(!contents.contains(r#""seedRange""#));
        assert!(contents.contains(r#""searchRequirements": []"#));
        assert!(contents.contains(r#""visible": true"#));
        assert!(contents.contains(r#""seed": "-9223372036854775808""#));
        assert_eq!(loaded, project);

        remove_test_directory(&path);
    }

    #[test]
    fn saves_and_loads_search_requirements() {
        let path = test_path("village-search.yocsow");
        let mut project = sample_project();
        project.search_requirements.push(sample_requirement());

        save_project(&path, &project).expect("project should be saved");

        let contents = fs::read_to_string(&path).expect("saved project should be readable");
        let loaded = load_project(&path).expect("project should be loaded");

        assert!(contents.contains(r#""kind": "structure""#));
        assert!(contents.contains(r#""structureType": "village""#));
        assert!(contents.contains(r#""radiusBlocks": 1000"#));
        assert_eq!(loaded, project);

        remove_test_directory(&path);
    }

    #[test]
    fn saves_and_loads_biome_requirements() {
        let path = test_path("taiga-search.yocsow");
        let mut project = sample_project();
        project.search_requirements.push(sample_biome_requirement());

        save_project(&path, &project).expect("project should be saved");

        let contents = fs::read_to_string(&path).expect("saved project should be readable");
        let loaded = load_project(&path).expect("project should be loaded");

        assert!(contents.contains(r#""kind": "biome""#));
        assert!(contents.contains(r#""biomeType": "taiga""#));
        assert!(contents.contains(r#""size": "big""#));
        assert_eq!(loaded, project);

        remove_test_directory(&path);
    }

    #[test]
    fn saves_and_loads_ruined_portal_requirements() {
        let path = test_path("ruined-portal-search.yocsow");
        let mut project = sample_project();
        project
            .search_requirements
            .push(sample_ruined_portal_requirement());

        save_project(&path, &project).expect("project should be saved");

        let contents = fs::read_to_string(&path).expect("saved project should be readable");
        let loaded = load_project(&path).expect("project should be loaded");

        assert!(contents.contains(r#""structureType": "ruinedPortal""#));
        assert_eq!(loaded, project);

        remove_test_directory(&path);
    }

    #[test]
    fn saves_and_loads_woodland_mansion_requirements() {
        let path = test_path("woodland-mansion-search.yocsow");
        let mut project = sample_project();
        project
            .search_requirements
            .push(sample_woodland_mansion_requirement());

        save_project(&path, &project).expect("project should be saved");

        let contents = fs::read_to_string(&path).expect("saved project should be readable");
        let loaded = load_project(&path).expect("project should be loaded");

        assert!(contents.contains(r#""structureType": "woodlandMansion""#));
        assert_eq!(loaded, project);

        remove_test_directory(&path);
    }

    #[test]
    fn migrates_version_one_projects() {
        let path = test_path("legacy.yocsow");

        fs::write(
            &path,
            format!(
                r#"{{
                  "formatVersion": {VERSION_ONE_PROJECT_FORMAT},
                  "name": "Legacy world",
                  "seedRange": {{
                    "minimum": "-10",
                    "maximum": "10",
                    "seed": "0"
                  }}
                }}"#
            ),
        )
        .expect("legacy project should be written");

        let migrated = load_project(&path).expect("legacy project should be migrated");

        assert_eq!(migrated.format_version, PROJECT_FORMAT_VERSION);
        assert_eq!(migrated.name, "Legacy world");
        assert!(migrated.search_requirements.is_empty());
        assert_eq!(migrated.seed_map, ProjectSeedMap::default());

        remove_test_directory(&path);
    }

    #[test]
    fn migrates_version_two_projects_and_keeps_requirements() {
        let path = test_path("range-project.yocsow");

        fs::write(
            &path,
            format!(
                r#"{{
                  "formatVersion": {VERSION_TWO_PROJECT_FORMAT},
                  "name": "Village search",
                  "seedRange": {{
                    "minimum": "-1000",
                    "maximum": "1000",
                    "seed": "0"
                  }},
                  "searchRequirements": [{{
                    "kind": "structure",
                    "id": "village-1",
                    "structureType": "village",
                    "center": {{ "x": 120, "z": -340 }},
                    "radiusBlocks": 1000
                  }}]
                }}"#
            ),
        )
        .expect("version two project should be written");

        let migrated = load_project(&path).expect("version two project should be migrated");

        assert_eq!(migrated.format_version, PROJECT_FORMAT_VERSION);
        assert_eq!(migrated.name, "Village search");
        assert_eq!(migrated.search_requirements, vec![sample_requirement()]);
        assert_eq!(migrated.seed_map, ProjectSeedMap::default());

        remove_test_directory(&path);
    }

    #[test]
    fn migrates_version_three_projects_and_keeps_requirements() {
        let path = test_path("version-three.yocsow");

        fs::write(
            &path,
            format!(
                r#"{{
                  "formatVersion": {VERSION_THREE_PROJECT_FORMAT},
                  "name": "Village search",
                  "searchRequirements": [{{
                    "kind": "structure",
                    "id": "village-1",
                    "structureType": "village",
                    "center": {{ "x": 120, "z": -340 }},
                    "radiusBlocks": 1000
                  }}]
                }}"#
            ),
        )
        .expect("version three project should be written");

        let migrated = load_project(&path).expect("version three project should be migrated");

        assert_eq!(migrated.format_version, PROJECT_FORMAT_VERSION);
        assert_eq!(migrated.search_requirements, vec![sample_requirement()]);
        assert_eq!(migrated.seed_map, ProjectSeedMap::default());

        remove_test_directory(&path);
    }

    #[test]
    fn migrates_version_four_projects_and_adds_seed_map_settings() {
        let path = test_path("version-four.yocsow");

        fs::write(
            &path,
            format!(
                r#"{{
                  "formatVersion": {VERSION_FOUR_PROJECT_FORMAT},
                  "name": "Existing map project",
                  "searchRequirements": [{{
                    "kind": "structure",
                    "id": "village-1",
                    "structureType": "village",
                    "center": {{ "x": 120, "z": -340 }},
                    "radiusBlocks": 1000
                  }}]
                }}"#
            ),
        )
        .expect("version four project should be written");

        let migrated = load_project(&path).expect("version four project should be migrated");

        assert_eq!(migrated.format_version, PROJECT_FORMAT_VERSION);
        assert_eq!(migrated.search_requirements, vec![sample_requirement()]);
        assert_eq!(migrated.seed_map, ProjectSeedMap::default());

        remove_test_directory(&path);
    }

    #[test]
    fn rejects_unsupported_format_versions() {
        let path = test_path("future.yocsow");
        let mut project = sample_project();
        project.format_version = PROJECT_FORMAT_VERSION + 1;

        let error = save_project(&path, &project)
            .expect_err("unsupported project versions should be rejected");

        assert!(
            error
                .to_string()
                .contains("unsupported project format version")
        );

        remove_test_directory(&path);
    }

    #[test]
    fn rejects_invalid_search_radii() {
        let path = test_path("invalid-radius.yocsow");
        let mut project = sample_project();
        let mut requirement = sample_requirement();

        match &mut requirement {
            ProjectSearchRequirement::Structure { radius_blocks, .. } => *radius_blocks = 0,
            ProjectSearchRequirement::Biome { .. } => unreachable!(),
        }

        project.search_requirements.push(requirement);

        let error =
            save_project(&path, &project).expect_err("invalid search radii should be rejected");

        assert!(error.to_string().contains("search radius must be between"));

        remove_test_directory(&path);
    }

    #[test]
    fn rejects_invalid_seed_map_seeds() {
        let path = test_path("invalid-seed-map.yocsow");
        let mut project = sample_project();
        project.seed_map.seed = "9223372036854775808".into();

        let error = save_project(&path, &project)
            .expect_err("out-of-range seed map seeds should be rejected");

        assert!(
            error
                .to_string()
                .contains("seed map seed must be a signed 64-bit integer")
        );

        remove_test_directory(&path);
    }

    #[test]
    fn rejects_duplicate_search_requirement_identifiers() {
        let path = test_path("duplicate-requirements.yocsow");
        let mut project = sample_project();
        project.search_requirements.push(sample_requirement());
        project.search_requirements.push(sample_requirement());

        let error = save_project(&path, &project)
            .expect_err("duplicate requirement IDs should be rejected");

        assert!(
            error
                .to_string()
                .contains("duplicate search requirement ID")
        );

        remove_test_directory(&path);
    }

    #[test]
    fn rejects_files_with_the_wrong_extension() {
        let path = test_path("world.json");

        let error = save_project(&path, &sample_project())
            .expect_err("wrong extensions should be rejected");

        assert!(error.to_string().contains(".yocsow extension"));

        remove_test_directory(&path);
    }

    #[test]
    fn rejects_unknown_project_fields() {
        let path = test_path("unknown-field.yocsow");

        fs::write(
            &path,
            r#"{
              "formatVersion": 3,
              "name": "Unknown field",
              "searchRequirements": [],
              "unexpected": true
            }"#,
        )
        .expect("test project should be written");

        let error = load_project(&path).expect_err("unknown fields should be rejected");

        assert!(error.to_string().contains("invalid project JSON"));

        remove_test_directory(&path);
    }

    fn sample_project() -> ProjectDocument {
        ProjectDocument {
            format_version: PROJECT_FORMAT_VERSION,
            name: "Example world".into(),
            search_requirements: Vec::new(),
            seed_map: ProjectSeedMap {
                visible: true,
                seed: "-9223372036854775808".into(),
            },
        }
    }

    fn sample_requirement() -> ProjectSearchRequirement {
        ProjectSearchRequirement::Structure {
            id: "village-1".into(),
            structure_type: ProjectStructureType::Village,
            center: ProjectBlockPosition { x: 120, z: -340 },
            radius_blocks: 1_000,
        }
    }

    fn sample_biome_requirement() -> ProjectSearchRequirement {
        ProjectSearchRequirement::Biome {
            id: "taiga-1".into(),
            biome_type: ProjectBiomeType::Taiga,
            center: ProjectBlockPosition { x: 64, z: -128 },
            size: ProjectBiomeSize::Big,
        }
    }

    fn sample_ruined_portal_requirement() -> ProjectSearchRequirement {
        ProjectSearchRequirement::Structure {
            id: "portal-1".into(),
            structure_type: ProjectStructureType::RuinedPortal,
            center: ProjectBlockPosition { x: -800, z: 1200 },
            radius_blocks: 640,
        }
    }

    fn sample_woodland_mansion_requirement() -> ProjectSearchRequirement {
        ProjectSearchRequirement::Structure {
            id: "mansion-1".into(),
            structure_type: ProjectStructureType::WoodlandMansion,
            center: ProjectBlockPosition { x: 4096, z: -2048 },
            radius_blocks: 8_000,
        }
    }

    fn test_path(file_name: &str) -> PathBuf {
        let test_id = NEXT_TEST_ID.fetch_add(1, Ordering::Relaxed);
        let directory = std::env::temp_dir().join(format!(
            "yocsow-project-files-{}-{test_id}",
            std::process::id()
        ));

        fs::create_dir_all(&directory).expect("test directory should be created");

        directory.join(file_name)
    }

    fn remove_test_directory(path: &Path) {
        if let Some(directory) = path.parent() {
            let _ = fs::remove_dir_all(directory);
        }
    }
}
