use crate::engine_process::{EngineState, EngineStatus, SeedRangeQuery, SeedRangeResult};
use crate::project_files::{self, ProjectDocument};
use crate::seed_search::{SeedSearchQuery, SeedSearchRequirementInput, SeedSearchResult};
use serde::Serialize;
use std::path::Path;
use tauri::State;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    name: &'static str,
    version: &'static str,
    platform: &'static str,
    architecture: &'static str,
}

impl AppInfo {
    fn current() -> Self {
        Self {
            name: "YOCSOW",
            version: env!("CARGO_PKG_VERSION"),
            platform: std::env::consts::OS,
            architecture: std::env::consts::ARCH,
        }
    }
}

#[tauri::command]
pub fn get_app_info() -> AppInfo {
    AppInfo::current()
}

#[tauri::command]
pub fn get_engine_status(state: State<'_, EngineState>) -> Result<EngineStatus, String> {
    state.status().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn seed_range_contains(
    state: State<'_, EngineState>,
    minimum: String,
    maximum: String,
    seed: String,
) -> Result<SeedRangeResult, String> {
    let query =
        SeedRangeQuery::parse(&minimum, &maximum, &seed).map_err(|error| error.to_string())?;

    state
        .seed_range_contains(query)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn search_seeds(
    state: State<'_, EngineState>,
    first_seed: String,
    seed_count: u32,
    minecraft_version: String,
    requirements: Vec<SeedSearchRequirementInput>,
    result_limit: u32,
) -> Result<SeedSearchResult, String> {
    let query = SeedSearchQuery::parse(
        &first_seed,
        seed_count,
        &minecraft_version,
        requirements,
        result_limit,
    )
    .map_err(|error| error.to_string())?;

    state.search_seeds(query).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn load_project(path: String) -> Result<ProjectDocument, String> {
    project_files::load_project(Path::new(&path)).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_project(path: String, project: ProjectDocument) -> Result<(), String> {
    project_files::save_project(Path::new(&path), &project).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::AppInfo;

    #[test]
    fn current_app_info_describes_the_native_application() {
        let app_info = AppInfo::current();

        assert_eq!(app_info.name, "YOCSOW");
        assert_eq!(app_info.version, env!("CARGO_PKG_VERSION"));
        assert!(!app_info.platform.is_empty());
        assert!(!app_info.architecture.is_empty());
    }
}
