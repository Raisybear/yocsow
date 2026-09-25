use serde::de::Error as _;
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::fmt::{self, Display, Formatter};
use std::sync::OnceLock;

const DEFAULT_RELEASE_ID: &str = "1.21";

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize)]
#[serde(transparent)]
pub(crate) struct MinecraftJavaReleaseId(String);

impl MinecraftJavaReleaseId {
    pub(crate) fn parse(value: &str) -> Result<Self, String> {
        if !release_ids().contains(value) {
            return Err(format!("unknown Minecraft Java release: {value}"));
        }

        Ok(Self(value.to_owned()))
    }

    pub(crate) fn as_str(&self) -> &str {
        &self.0
    }
}

impl Default for MinecraftJavaReleaseId {
    fn default() -> Self {
        Self::parse(DEFAULT_RELEASE_ID).expect("the default Minecraft release must be catalogued")
    }
}

impl Display for MinecraftJavaReleaseId {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

impl<'de> Deserialize<'de> for MinecraftJavaReleaseId {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = String::deserialize(deserializer)?;

        Self::parse(&value).map_err(D::Error::custom)
    }
}

fn release_ids() -> &'static HashSet<String> {
    static RELEASE_IDS: OnceLock<HashSet<String>> = OnceLock::new();

    RELEASE_IDS.get_or_init(|| {
        let catalog: Value = serde_json::from_str(include_str!(
            "../../../../config/minecraft-java-releases.json"
        ))
        .expect("the checked-in Minecraft Java release catalog must be valid JSON");

        catalog
            .get("releaseIds")
            .and_then(Value::as_array)
            .expect("the checked-in Minecraft Java release catalog must contain releaseIds")
            .iter()
            .map(|release_id| {
                release_id
                    .as_str()
                    .expect("Minecraft Java release IDs must be strings")
                    .to_owned()
            })
            .collect()
    })
}

#[cfg(test)]
mod tests {
    use super::MinecraftJavaReleaseId;

    #[test]
    fn accepts_exact_catalog_releases() {
        assert_eq!(
            MinecraftJavaReleaseId::parse("26.3")
                .expect("latest release should be accepted")
                .as_str(),
            "26.3"
        );
        assert_eq!(
            MinecraftJavaReleaseId::parse("1.0.0")
                .expect("oldest release should be accepted")
                .as_str(),
            "1.0.0"
        );
    }

    #[test]
    fn rejects_aliases_unknown_versions_and_whitespace() {
        for value in ["1.0", "1.7.3", "1.21-fabric", " 1.21"] {
            let error = MinecraftJavaReleaseId::parse(value)
                .expect_err("non-catalog release should be rejected");

            assert_eq!(error, format!("unknown Minecraft Java release: {value}"));
        }
    }
}
