use crate::engine_process::EngineProcessError;
use serde::{Deserialize, Serialize, Serializer};
use std::collections::HashSet;

const MAXIMUM_SEEDS_PER_BATCH: u32 = 10_000;
const MAXIMUM_REQUIREMENTS: usize = 32;
const MAXIMUM_RESULTS: u32 = 100;

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SeedSearchPositionInput {
    x: String,
    z: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SeedSearchRequirementInput {
    id: String,
    structure_type: String,
    center: SeedSearchPositionInput,
    radius_blocks: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SeedSearchQuery {
    first_seed: i64,
    seed_count: u32,
    minecraft_version: String,
    requirements: Vec<SeedSearchRequirement>,
    result_limit: u32,
}

impl SeedSearchQuery {
    pub(crate) fn parse(
        first_seed: &str,
        seed_count: u32,
        minecraft_version: &str,
        requirements: Vec<SeedSearchRequirementInput>,
        result_limit: u32,
    ) -> Result<Self, EngineProcessError> {
        let first_seed = parse_signed_64_bit_integer("firstSeed", first_seed)?;

        if seed_count == 0 {
            return Err(input_error("seedCount must be greater than zero"));
        }

        if seed_count > MAXIMUM_SEEDS_PER_BATCH {
            return Err(input_error(format!(
                "seedCount must not exceed {MAXIMUM_SEEDS_PER_BATCH}"
            )));
        }

        let final_seed_offset = i64::from(seed_count - 1);

        first_seed
            .checked_add(final_seed_offset)
            .ok_or_else(|| input_error("seed batch must not exceed the signed 64-bit range"))?;

        let minecraft_version = minecraft_version.trim().to_owned();

        if minecraft_version != "1.21" {
            return Err(input_error(format!(
                "unsupported Minecraft version: {minecraft_version}"
            )));
        }

        if requirements.is_empty() {
            return Err(input_error("requirements must not be empty"));
        }

        if requirements.len() > MAXIMUM_REQUIREMENTS {
            return Err(input_error(format!(
                "requirements must not contain more than \
                 {MAXIMUM_REQUIREMENTS} entries"
            )));
        }

        if result_limit == 0 {
            return Err(input_error("resultLimit must be greater than zero"));
        }

        if result_limit > MAXIMUM_RESULTS {
            return Err(input_error(format!(
                "resultLimit must not exceed {MAXIMUM_RESULTS}"
            )));
        }

        let mut requirement_ids = HashSet::new();
        let mut parsed_requirements = Vec::with_capacity(requirements.len());

        for requirement in requirements {
            let parsed_requirement = SeedSearchRequirement::parse(requirement)?;

            if !requirement_ids.insert(parsed_requirement.id.clone()) {
                return Err(input_error(format!(
                    "duplicate requirement id: {}",
                    parsed_requirement.id
                )));
            }

            parsed_requirements.push(parsed_requirement);
        }

        Ok(Self {
            first_seed,
            seed_count,
            minecraft_version,
            requirements: parsed_requirements,
            result_limit,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct SeedSearchRequirement {
    id: String,
    structure_type: String,
    center: SeedSearchPosition,
    radius_blocks: i64,
}

impl SeedSearchRequirement {
    fn parse(requirement: SeedSearchRequirementInput) -> Result<Self, EngineProcessError> {
        let id = requirement.id.trim().to_owned();

        if id.is_empty() {
            return Err(input_error("id must not be blank"));
        }

        let structure_type = requirement.structure_type.trim().to_owned();

        if structure_type != "village" {
            return Err(input_error(format!(
                "unsupported structure type: {structure_type}"
            )));
        }

        let center = SeedSearchPosition {
            x: parse_signed_64_bit_integer("center.x", &requirement.center.x)?,
            z: parse_signed_64_bit_integer("center.z", &requirement.center.z)?,
        };

        let radius_blocks =
            parse_signed_64_bit_integer("radiusBlocks", &requirement.radius_blocks)?;

        if radius_blocks <= 0 {
            return Err(input_error("radiusBlocks must be greater than zero"));
        }

        Ok(Self {
            id,
            structure_type,
            center,
            radius_blocks,
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
struct SeedSearchPosition {
    x: i64,
    z: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeedSearchResult {
    searched_seed_count: u32,
    candidates: Vec<SeedSearchCandidate>,
}

impl SeedSearchResult {
    pub(crate) fn validate(&self) -> Result<(), EngineProcessError> {
        if self.searched_seed_count > MAXIMUM_SEEDS_PER_BATCH {
            return Err(protocol_error("engine returned too many searched seeds"));
        }

        if self.candidates.len() > MAXIMUM_RESULTS as usize {
            return Err(protocol_error("engine returned too many candidates"));
        }

        let mut candidate_seeds = HashSet::new();

        for candidate in &self.candidates {
            if !candidate_seeds.insert(candidate.seed) {
                return Err(protocol_error("engine returned duplicate candidate seeds"));
            }

            candidate.validate()?;
        }

        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SeedSearchCandidate {
    #[serde(serialize_with = "serialize_i64_as_string")]
    seed: i64,
    total_requirement_count: u32,
    matched_requirement_count: u32,
    matches_all_requirements: bool,
    match_ratio: f64,
    average_normalized_distance: f64,
    matches: Vec<StructureMatch>,
}

impl SeedSearchCandidate {
    fn validate(&self) -> Result<(), EngineProcessError> {
        if self.total_requirement_count == 0
            || self.total_requirement_count > MAXIMUM_REQUIREMENTS as u32
        {
            return Err(protocol_error(
                "engine returned an invalid requirement count",
            ));
        }

        if self.matched_requirement_count as usize != self.matches.len()
            || self.matched_requirement_count > self.total_requirement_count
        {
            return Err(protocol_error(
                "engine returned an inconsistent match count",
            ));
        }

        let expected_matches_all = self.matched_requirement_count == self.total_requirement_count;

        if self.matches_all_requirements != expected_matches_all {
            return Err(protocol_error(
                "engine returned an inconsistent complete-match flag",
            ));
        }

        let expected_match_ratio =
            f64::from(self.matched_requirement_count) / f64::from(self.total_requirement_count);

        if !self.match_ratio.is_finite()
            || (self.match_ratio - expected_match_ratio).abs() > 0.000_001
        {
            return Err(protocol_error(
                "engine returned an inconsistent match ratio",
            ));
        }

        if self.matches.is_empty()
            || !self.average_normalized_distance.is_finite()
            || self.average_normalized_distance < 0.0
            || self.average_normalized_distance > 1.0
        {
            return Err(protocol_error(
                "engine returned an invalid average distance",
            ));
        }

        let mut requirement_ids = HashSet::new();

        for structure_match in &self.matches {
            if !requirement_ids.insert(structure_match.requirement_id.as_str()) {
                return Err(protocol_error(
                    "engine returned duplicate matched requirements",
                ));
            }

            structure_match.validate()?;
        }

        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StructureMatch {
    requirement_id: String,
    structure_type: String,
    target_center: SeedSearchResultPosition,
    #[serde(serialize_with = "serialize_i64_as_string")]
    radius_blocks: i64,
    actual_position: SeedSearchResultPosition,
    distance_blocks: f64,
    normalized_distance: f64,
}

impl StructureMatch {
    fn validate(&self) -> Result<(), EngineProcessError> {
        if self.requirement_id.trim().is_empty() {
            return Err(protocol_error("engine returned a blank requirement ID"));
        }

        if self.structure_type != "village" {
            return Err(protocol_error(
                "engine returned an unsupported structure type",
            ));
        }

        if self.radius_blocks <= 0 {
            return Err(protocol_error("engine returned an invalid search radius"));
        }

        if !self.distance_blocks.is_finite()
            || self.distance_blocks < 0.0
            || self.distance_blocks > self.radius_blocks as f64
        {
            return Err(protocol_error(
                "engine returned an invalid structure distance",
            ));
        }

        if !self.normalized_distance.is_finite()
            || self.normalized_distance < 0.0
            || self.normalized_distance > 1.0
        {
            return Err(protocol_error(
                "engine returned an invalid normalized distance",
            ));
        }

        Ok(())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
struct SeedSearchResultPosition {
    #[serde(serialize_with = "serialize_i64_as_string")]
    x: i64,
    #[serde(serialize_with = "serialize_i64_as_string")]
    z: i64,
}

fn parse_signed_64_bit_integer(parameter: &str, value: &str) -> Result<i64, EngineProcessError> {
    value
        .trim()
        .parse::<i64>()
        .map_err(|_| input_error(format!("{parameter} must be a signed 64-bit integer")))
}

fn serialize_i64_as_string<S>(value: &i64, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    serializer.serialize_str(&value.to_string())
}

fn input_error(message: impl Into<String>) -> EngineProcessError {
    EngineProcessError::Input(message.into())
}

fn protocol_error(message: impl Into<String>) -> EngineProcessError {
    EngineProcessError::Protocol(message.into())
}

#[cfg(test)]
mod tests {
    use super::{
        SeedSearchPositionInput, SeedSearchQuery, SeedSearchRequirementInput, SeedSearchResult,
    };
    use crate::engine_process::EngineProcessError;
    use serde_json::json;

    #[test]
    fn query_serializes_signed_values_as_engine_numbers() {
        let query = SeedSearchQuery::parse(
            "-9223372036854775808",
            1,
            "1.21",
            vec![requirement(
                "spawn-village",
                "-9223372036854775808",
                "9223372036854775807",
                "1000",
            )],
            1,
        )
        .expect("query should be valid");

        let value = serde_json::to_value(query).expect("query should serialize");

        assert_eq!(value["firstSeed"], json!(i64::MIN));
        assert_eq!(value["seedCount"], 1);
        assert_eq!(value["minecraftVersion"], "1.21");
        assert_eq!(value["requirements"][0]["center"]["x"], json!(i64::MIN));
        assert_eq!(value["requirements"][0]["center"]["z"], json!(i64::MAX));
        assert_eq!(value["requirements"][0]["radiusBlocks"], 1000);
    }

    #[test]
    fn query_rejects_seed_batch_overflow() {
        let error = SeedSearchQuery::parse(
            "9223372036854775807",
            2,
            "1.21",
            vec![requirement("spawn-village", "0", "0", "1000")],
            1,
        )
        .expect_err("overflowing batch should fail");

        assert_input_error(error, "seed batch must not exceed the signed 64-bit range");
    }

    #[test]
    fn query_rejects_duplicate_requirement_ids() {
        let error = SeedSearchQuery::parse(
            "0",
            1,
            "1.21",
            vec![
                requirement("village-1", "0", "0", "1000"),
                requirement(" village-1 ", "0", "0", "1000"),
            ],
            1,
        )
        .expect_err("duplicate IDs should fail");

        assert_input_error(error, "duplicate requirement id: village-1");
    }

    #[test]
    fn result_serializes_i64_values_as_frontend_strings() {
        let engine_result = json!({
            "searchedSeedCount": 1,
            "candidates": [{
                "seed": i64::MAX,
                "totalRequirementCount": 1,
                "matchedRequirementCount": 1,
                "matchesAllRequirements": true,
                "matchRatio": 1.0,
                "averageNormalizedDistance": 0.5,
                "matches": [{
                    "requirementId": "spawn-village",
                    "structureType": "village",
                    "targetCenter": {
                        "x": i64::MIN,
                        "z": 0
                    },
                    "radiusBlocks": 1000,
                    "actualPosition": {
                        "x": 500,
                        "z": 0
                    },
                    "distanceBlocks": 500.0,
                    "normalizedDistance": 0.5
                }]
            }]
        });

        let result: SeedSearchResult =
            serde_json::from_value(engine_result).expect("engine result should deserialize");

        result.validate().expect("engine result should be valid");

        let frontend_result =
            serde_json::to_value(result).expect("frontend result should serialize");

        assert_eq!(
            frontend_result["candidates"][0]["seed"],
            "9223372036854775807"
        );
        assert_eq!(
            frontend_result["candidates"][0]["matches"][0]["targetCenter"]["x"],
            "-9223372036854775808"
        );
        assert_eq!(
            frontend_result["candidates"][0]["matches"][0]["radiusBlocks"],
            "1000"
        );
        assert_eq!(
            frontend_result["candidates"][0]["matches"][0]["actualPosition"]["x"],
            "500"
        );
    }

    #[test]
    fn result_rejects_inconsistent_match_counts() {
        let engine_result = json!({
            "searchedSeedCount": 1,
            "candidates": [{
                "seed": 1,
                "totalRequirementCount": 1,
                "matchedRequirementCount": 0,
                "matchesAllRequirements": false,
                "matchRatio": 0.0,
                "averageNormalizedDistance": 0.5,
                "matches": [{
                    "requirementId": "spawn-village",
                    "structureType": "village",
                    "targetCenter": {
                        "x": 0,
                        "z": 0
                    },
                    "radiusBlocks": 1000,
                    "actualPosition": {
                        "x": 500,
                        "z": 0
                    },
                    "distanceBlocks": 500.0,
                    "normalizedDistance": 0.5
                }]
            }]
        });

        let result: SeedSearchResult =
            serde_json::from_value(engine_result).expect("engine result should deserialize");

        let error = result
            .validate()
            .expect_err("inconsistent result should fail");

        assert!(error.to_string().contains("inconsistent match count"));
    }

    fn requirement(id: &str, x: &str, z: &str, radius_blocks: &str) -> SeedSearchRequirementInput {
        SeedSearchRequirementInput {
            id: id.to_owned(),
            structure_type: "village".to_owned(),
            center: SeedSearchPositionInput {
                x: x.to_owned(),
                z: z.to_owned(),
            },
            radius_blocks: radius_blocks.to_owned(),
        }
    }

    fn assert_input_error(error: EngineProcessError, expected_message: &str) {
        match error {
            EngineProcessError::Input(message) => {
                assert_eq!(message, expected_message);
            }
            other => panic!("unexpected error: {other}"),
        }
    }
}
