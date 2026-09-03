use serde::Serialize;

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
