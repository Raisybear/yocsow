use crate::engine_process::{EngineState, EngineStatus, SeedRangeQuery, SeedRangeResult};
use crate::project_files::{self, ProjectDocument};
use crate::seed_search::{
    ContinuousSeedSearchQuery, ContinuousSeedSearchResult, SeedSearchControl,
    SeedSearchRequirementInput, run_continuous_seed_search,
};
use serde::Serialize;
use std::path::Path;
use tauri::{AppHandle, Manager, State};

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
pub async fn search_seed_batches(
    app: AppHandle,
    first_seed: String,
    minecraft_version: String,
    requirements: Vec<SeedSearchRequirementInput>,
    result_limit: u32,
) -> Result<ContinuousSeedSearchResult, String> {
    let query = ContinuousSeedSearchQuery::parse(
        &first_seed,
        &minecraft_version,
        requirements,
        result_limit,
    )
    .map_err(|error| error.to_string())?;
    let session = app
        .state::<SeedSearchControl>()
        .begin()
        .map_err(|error| error.to_string())?;
    let search_id = session.search_id;
    let cancellation = session.cancellation;
    let worker_app = app.clone();

    let worker = tauri::async_runtime::spawn_blocking(move || {
        let engine = worker_app.state::<EngineState>();

        run_continuous_seed_search(query, &cancellation, |batch| engine.search_seeds(batch))
    });

    let search_result = match worker.await {
        Ok(result) => result.map_err(|error| error.to_string()),
        Err(error) => Err(format!("continuous seed search worker failed: {error}")),
    };

    app.state::<SeedSearchControl>()
        .finish(search_id)
        .map_err(|error| error.to_string())?;

    search_result
}

#[tauri::command]
pub fn stop_seed_search(control: State<'_, SeedSearchControl>) -> Result<bool, String> {
    control.stop().map_err(|error| error.to_string())
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
