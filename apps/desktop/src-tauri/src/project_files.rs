use serde::{Deserialize, Serialize};
use std::error::Error;
use std::fmt::{self, Display, Formatter};
use std::fs;
use std::path::Path;

const PROJECT_FORMAT_VERSION: u32 = 1;
const PROJECT_EXTENSION: &str = "yocsow";
const MAX_PROJECT_FILE_SIZE: usize = 1024 * 1024;
const MAX_PROJECT_NAME_LENGTH: usize = 120;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProjectDocument {
    format_version: u32,
    name: String,
    seed_range: ProjectSeedRange,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProjectSeedRange {
    minimum: String,
    maximum: String,
    seed: String,
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

        let minimum = parse_signed_64_bit_integer("minimum", &self.seed_range.minimum)?;
        let maximum = parse_signed_64_bit_integer("maximum", &self.seed_range.maximum)?;
        parse_signed_64_bit_integer("seed", &self.seed_range.seed)?;

        if minimum > maximum {
            return Err(ProjectFileError::Validation(
                "minimum must not be greater than maximum".into(),
            ));
        }

        Ok(())
    }
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
    let project: ProjectDocument = serde_json::from_str(&contents)?;
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

fn parse_signed_64_bit_integer(parameter: &str, value: &str) -> Result<i64, ProjectFileError> {
    value.trim().parse::<i64>().map_err(|_| {
        ProjectFileError::Validation(format!("{parameter} must be a signed 64-bit integer"))
    })
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
        PROJECT_FORMAT_VERSION, ProjectDocument, ProjectSeedRange, load_project, save_project,
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
        assert!(contents.contains(r#""formatVersion": 1"#));
        assert_eq!(loaded, project);

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
    fn rejects_invalid_seed_ranges() {
        let path = test_path("invalid-range.yocsow");
        let mut project = sample_project();
        project.seed_range.minimum = "10".into();
        project.seed_range.maximum = "0".into();

        let error =
            save_project(&path, &project).expect_err("invalid seed ranges should be rejected");

        assert!(
            error
                .to_string()
                .contains("minimum must not be greater than maximum")
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
              "formatVersion": 1,
              "name": "Unknown field",
              "seedRange": {
                "minimum": "-10",
                "maximum": "10",
                "seed": "0"
              },
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
            seed_range: ProjectSeedRange {
                minimum: "-10".into(),
                maximum: "10".into(),
                seed: "0".into(),
            },
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
