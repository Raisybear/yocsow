mod commands;
mod engine_process;
mod project_files;
mod seed_search;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            app.manage(engine_process::EngineState::for_app(app.handle())?);

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_info,
            commands::get_engine_status,
            commands::seed_range_contains,
            commands::search_seeds,
            commands::load_project,
            commands::save_project
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
