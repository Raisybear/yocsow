use crate::engine_process::EngineProcessError;
use crate::minecraft_version::MinecraftJavaReleaseId;
use serde::{Deserialize, Serialize, Serializer};
use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering as AtomicOrdering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

const MAXIMUM_SEEDS_PER_BATCH: u32 = 10_000;
const MAXIMUM_REQUIREMENTS: usize = 32;
const MAXIMUM_RESULTS: u32 = 100;
const SIGNED_64_BIT_SEED_COUNT: u128 = 1_u128 << 64;

#[derive(Debug, Default)]
pub struct SeedSearchControl {
    active_search: Mutex<Option<ActiveSeedSearch>>,
    next_search_id: AtomicU64,
}

impl SeedSearchControl {
    pub(crate) fn begin(&self) -> Result<SeedSearchSession, EngineProcessError> {
        let mut active_search = self.active_search.lock().map_err(|_| {
            EngineProcessError::State("seed search control lock was poisoned".into())
        })?;

        if active_search.is_some() {
            return Err(EngineProcessError::State(
                "a continuous seed search is already running".into(),
            ));
        }

        let search_id = self.next_search_id.fetch_add(1, AtomicOrdering::Relaxed);
        let cancellation = Arc::new(AtomicBool::new(false));

        *active_search = Some(ActiveSeedSearch {
            search_id,
            cancellation: Arc::clone(&cancellation),
        });

        Ok(SeedSearchSession {
            search_id,
            cancellation,
        })
    }

    pub(crate) fn stop(&self) -> Result<bool, EngineProcessError> {
        let active_search = self.active_search.lock().map_err(|_| {
            EngineProcessError::State("seed search control lock was poisoned".into())
        })?;

        let Some(active_search) = active_search.as_ref() else {
            return Ok(false);
        };

        active_search
            .cancellation
            .store(true, AtomicOrdering::Release);

        Ok(true)
    }

    pub(crate) fn finish(&self, search_id: u64) -> Result<(), EngineProcessError> {
        let mut active_search = self.active_search.lock().map_err(|_| {
            EngineProcessError::State("seed search control lock was poisoned".into())
        })?;

        if active_search
            .as_ref()
            .is_some_and(|search| search.search_id == search_id)
        {
            *active_search = None;
        }

        Ok(())
    }
}

#[derive(Debug)]
struct ActiveSeedSearch {
    search_id: u64,
    cancellation: Arc<AtomicBool>,
}

#[derive(Debug)]
pub(crate) struct SeedSearchSession {
    pub(crate) search_id: u64,
    pub(crate) cancellation: Arc<AtomicBool>,
}

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
    minecraft_version: MinecraftJavaReleaseId,
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

        let minecraft_version =
            MinecraftJavaReleaseId::parse(minecraft_version).map_err(input_error)?;

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

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ContinuousSeedSearchQuery {
    first_seed: i64,
    minecraft_version: MinecraftJavaReleaseId,
    requirements: Vec<SeedSearchRequirement>,
    result_limit: u32,
}

impl ContinuousSeedSearchQuery {
    pub(crate) fn parse(
        first_seed: &str,
        minecraft_version: &str,
        requirements: Vec<SeedSearchRequirementInput>,
        result_limit: u32,
    ) -> Result<Self, EngineProcessError> {
        let validated_query =
            SeedSearchQuery::parse(first_seed, 1, minecraft_version, requirements, result_limit)?;

        Ok(Self {
            first_seed: validated_query.first_seed,
            minecraft_version: validated_query.minecraft_version,
            requirements: validated_query.requirements,
            result_limit: validated_query.result_limit,
        })
    }

    fn batch(&self, first_seed: i64, seed_count: u32) -> SeedSearchQuery {
        SeedSearchQuery {
            first_seed,
            seed_count,
            minecraft_version: self.minecraft_version.clone(),
            requirements: self.requirements.clone(),
            result_limit: self.result_limit,
        }
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

        if structure_type != "village"
            && structure_type != "ruinedPortal"
            && structure_type != "woodlandMansion"
            && structure_type != "desertTemple"
            && structure_type != "taiga"
        {
            return Err(input_error(format!(
                "unsupported search target type: {structure_type}"
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SeedSearchCompletionReason {
    Limit,
    Stopped,
    Exhausted,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContinuousSeedSearchProgress {
    #[serde(serialize_with = "serialize_u128_as_string")]
    searched_seed_count: u128,
    candidates: Vec<SeedSearchCandidate>,
    elapsed_milliseconds: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContinuousSeedSearchResult {
    #[serde(serialize_with = "serialize_u128_as_string")]
    searched_seed_count: u128,
    candidates: Vec<SeedSearchCandidate>,
    elapsed_milliseconds: u64,
    reason: SeedSearchCompletionReason,
}

pub(crate) fn run_continuous_seed_search(
    query: ContinuousSeedSearchQuery,
    cancellation: &AtomicBool,
    mut search_batch: impl FnMut(SeedSearchQuery) -> Result<SeedSearchResult, EngineProcessError>,
    mut report_progress: impl FnMut(&ContinuousSeedSearchProgress) -> Result<(), EngineProcessError>,
) -> Result<ContinuousSeedSearchResult, EngineProcessError> {
    let started_at = Instant::now();
    let mut next_seed = query.first_seed;
    let mut remaining_seed_count = SIGNED_64_BIT_SEED_COUNT;
    let mut searched_seed_count = 0_u128;
    let mut candidates = Vec::new();

    loop {
        if cancellation.load(AtomicOrdering::Acquire) {
            return Ok(continuous_result(
                searched_seed_count,
                candidates,
                started_at,
                SeedSearchCompletionReason::Stopped,
            ));
        }

        let seeds_before_signed_maximum =
            (i128::from(i64::MAX) - i128::from(next_seed) + 1) as u128;
        let seed_count = remaining_seed_count
            .min(seeds_before_signed_maximum)
            .min(u128::from(MAXIMUM_SEEDS_PER_BATCH)) as u32;
        let batch_result = match search_batch(query.batch(next_seed, seed_count)) {
            Ok(result) => result,
            Err(_) if cancellation.load(AtomicOrdering::Acquire) => {
                return Ok(continuous_result(
                    searched_seed_count,
                    candidates,
                    started_at,
                    SeedSearchCompletionReason::Stopped,
                ));
            }
            Err(error) => return Err(error),
        };

        if batch_result.searched_seed_count != seed_count {
            return Err(protocol_error(format!(
                "engine reported {} searched seeds for a batch of {seed_count}",
                batch_result.searched_seed_count
            )));
        }

        searched_seed_count += u128::from(seed_count);
        remaining_seed_count -= u128::from(seed_count);
        merge_candidates(
            &mut candidates,
            batch_result.candidates,
            query.result_limit as usize,
        );
        let progress = continuous_progress(searched_seed_count, &candidates, started_at);
        report_progress(&progress)?;

        if complete_match_count(&candidates) >= query.result_limit as usize {
            return Ok(continuous_result(
                searched_seed_count,
                candidates,
                started_at,
                SeedSearchCompletionReason::Limit,
            ));
        }

        if cancellation.load(AtomicOrdering::Acquire) {
            return Ok(continuous_result(
                searched_seed_count,
                candidates,
                started_at,
                SeedSearchCompletionReason::Stopped,
            ));
        }

        if remaining_seed_count == 0 {
            return Ok(continuous_result(
                searched_seed_count,
                candidates,
                started_at,
                SeedSearchCompletionReason::Exhausted,
            ));
        }

        next_seed = next_seed
            .checked_add(i64::from(seed_count))
            .unwrap_or(i64::MIN);
    }
}

fn continuous_result(
    searched_seed_count: u128,
    candidates: Vec<SeedSearchCandidate>,
    started_at: Instant,
    reason: SeedSearchCompletionReason,
) -> ContinuousSeedSearchResult {
    ContinuousSeedSearchResult {
        searched_seed_count,
        candidates,
        elapsed_milliseconds: elapsed_milliseconds(started_at),
        reason,
    }
}

fn continuous_progress(
    searched_seed_count: u128,
    candidates: &[SeedSearchCandidate],
    started_at: Instant,
) -> ContinuousSeedSearchProgress {
    ContinuousSeedSearchProgress {
        searched_seed_count,
        candidates: candidates.to_vec(),
        elapsed_milliseconds: elapsed_milliseconds(started_at),
    }
}

fn elapsed_milliseconds(started_at: Instant) -> u64 {
    u64::try_from(started_at.elapsed().as_millis()).unwrap_or(u64::MAX)
}

fn merge_candidates(
    current: &mut Vec<SeedSearchCandidate>,
    incoming: Vec<SeedSearchCandidate>,
    result_limit: usize,
) {
    let mut candidates: HashMap<i64, SeedSearchCandidate> = current
        .drain(..)
        .map(|candidate| (candidate.seed, candidate))
        .collect();

    for candidate in incoming {
        candidates.insert(candidate.seed, candidate);
    }

    *current = candidates.into_values().collect();
    current.sort_by(compare_candidates);
    current.truncate(result_limit);
}

fn compare_candidates(left: &SeedSearchCandidate, right: &SeedSearchCandidate) -> Ordering {
    right
        .matched_requirement_count
        .cmp(&left.matched_requirement_count)
        .then_with(|| {
            left.average_normalized_distance
                .total_cmp(&right.average_normalized_distance)
        })
        .then_with(|| left.seed.cmp(&right.seed))
}

fn complete_match_count(candidates: &[SeedSearchCandidate]) -> usize {
    candidates
        .iter()
        .filter(|candidate| candidate.matches_all_requirements)
        .count()
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

        if self.structure_type != "village"
            && self.structure_type != "ruinedPortal"
            && self.structure_type != "woodlandMansion"
            && self.structure_type != "desertTemple"
            && self.structure_type != "taiga"
        {
            return Err(protocol_error(
                "engine returned an unsupported search target type",
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

fn serialize_u128_as_string<S>(value: &u128, serializer: S) -> Result<S::Ok, S::Error>
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
        ContinuousSeedSearchQuery, SeedSearchCompletionReason, SeedSearchControl,
        SeedSearchPositionInput, SeedSearchQuery, SeedSearchRequirementInput, SeedSearchResult,
        merge_candidates, run_continuous_seed_search,
    };
    use crate::engine_process::EngineProcessError;
    use serde_json::json;
    use std::sync::atomic::{AtomicBool, Ordering as AtomicOrdering};

    #[test]
    fn query_serializes_signed_values_as_engine_numbers() {
        let query = SeedSearchQuery::parse(
            "-9223372036854775808",
            1,
            "1.20.6",
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
        assert_eq!(value["minecraftVersion"], "1.20.6");
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
    fn query_rejects_unknown_minecraft_releases() {
        let error = SeedSearchQuery::parse(
            "0",
            1,
            "1.21-fabric",
            vec![requirement("spawn-village", "0", "0", "1000")],
            1,
        )
        .expect_err("unknown releases should fail");

        assert_input_error(error, "unknown Minecraft Java release: 1.21-fabric");
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
    fn query_accepts_taiga_requirements() {
        let mut biome = requirement("taiga-1", "64", "-128", "256");
        biome.structure_type = "taiga".to_owned();

        let query = SeedSearchQuery::parse("42", 1, "1.21", vec![biome], 1)
            .expect("taiga requirement should be valid");
        let value = serde_json::to_value(query).expect("query should serialize");

        assert_eq!(value["requirements"][0]["structureType"], "taiga");
        assert_eq!(value["requirements"][0]["radiusBlocks"], 256);
    }

    #[test]
    fn query_accepts_ruined_portal_requirements() {
        let mut portal = requirement("portal-1", "-800", "1200", "640");
        portal.structure_type = "ruinedPortal".to_owned();

        let query = SeedSearchQuery::parse("42", 1, "1.21", vec![portal], 1)
            .expect("ruined portal requirement should be valid");
        let value = serde_json::to_value(query).expect("query should serialize");

        assert_eq!(value["requirements"][0]["structureType"], "ruinedPortal");
        assert_eq!(value["requirements"][0]["radiusBlocks"], 640);
    }

    #[test]
    fn query_accepts_woodland_mansion_requirements() {
        let mut mansion = requirement("mansion-1", "4096", "-2048", "8000");
        mansion.structure_type = "woodlandMansion".to_owned();

        let query = SeedSearchQuery::parse("42", 1, "1.21", vec![mansion], 1)
            .expect("woodland mansion requirement should be valid");
        let value = serde_json::to_value(query).expect("query should serialize");

        assert_eq!(value["requirements"][0]["structureType"], "woodlandMansion");
        assert_eq!(value["requirements"][0]["radiusBlocks"], 8000);
    }

    #[test]
    fn query_accepts_desert_temple_requirements() {
        let mut temple = requirement("temple-1", "1600", "-3200", "5000");
        temple.structure_type = "desertTemple".to_owned();

        let query = SeedSearchQuery::parse("42", 1, "1.21", vec![temple], 1)
            .expect("desert temple requirement should be valid");
        let value = serde_json::to_value(query).expect("query should serialize");

        assert_eq!(value["requirements"][0]["structureType"], "desertTemple");
        assert_eq!(value["requirements"][0]["radiusBlocks"], 5000);
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

    #[test]
    fn continuous_search_advances_batches_until_the_result_limit() {
        let query = ContinuousSeedSearchQuery::parse(
            "0",
            "1.21",
            vec![requirement("spawn-village", "0", "0", "1000")],
            1,
        )
        .expect("query should be valid");
        let cancellation = AtomicBool::new(false);
        let mut batches = Vec::new();
        let mut progress_updates = Vec::new();

        let result = run_continuous_seed_search(
            query,
            &cancellation,
            |batch| {
                batches.push((batch.first_seed, batch.seed_count));

                if batches.len() == 1 {
                    Ok(search_result(10_000, Vec::new()))
                } else {
                    Ok(search_result(10_000, vec![candidate(10_004, 1, 0.4)]))
                }
            },
            |progress| {
                progress_updates.push(progress.clone());
                Ok(())
            },
        )
        .expect("continuous search should succeed");

        assert_eq!(batches, vec![(0, 10_000), (10_000, 10_000)]);
        assert_eq!(result.searched_seed_count, 20_000);
        assert_eq!(result.reason, SeedSearchCompletionReason::Limit);
        assert_eq!(result.candidates.len(), 1);
        assert_eq!(result.candidates[0].seed, 10_004);
        assert_eq!(progress_updates.len(), 2);
        assert_eq!(progress_updates[0].searched_seed_count, 10_000);
        assert!(progress_updates[0].candidates.is_empty());
        assert_eq!(progress_updates[1].searched_seed_count, 20_000);
        assert_eq!(progress_updates[1].candidates[0].seed, 10_004);
    }

    #[test]
    fn search_control_allows_one_active_search_and_forwards_stop_requests() {
        let control = SeedSearchControl::default();
        let session = control.begin().expect("first search should start");

        let error = control
            .begin()
            .expect_err("second search should be rejected");
        assert!(error.to_string().contains("already running"));

        assert!(control.stop().expect("stop request should succeed"));
        assert!(session.cancellation.load(AtomicOrdering::Acquire));

        control
            .finish(session.search_id)
            .expect("search should finish");
        assert!(!control.stop().expect("there should be no active search"));
    }

    #[test]
    fn continuous_search_stops_after_the_active_batch() {
        let query = ContinuousSeedSearchQuery::parse(
            "0",
            "1.21",
            vec![requirement("spawn-village", "0", "0", "1000")],
            20,
        )
        .expect("query should be valid");
        let cancellation = AtomicBool::new(false);
        let mut batch_count = 0;

        let result = run_continuous_seed_search(
            query,
            &cancellation,
            |batch| {
                batch_count += 1;
                cancellation.store(true, AtomicOrdering::Release);
                Ok(search_result(batch.seed_count, Vec::new()))
            },
            |_| Ok(()),
        )
        .expect("continuous search should stop cleanly");

        assert_eq!(batch_count, 1);
        assert_eq!(result.searched_seed_count, 10_000);
        assert_eq!(result.reason, SeedSearchCompletionReason::Stopped);
    }

    #[test]
    fn continuous_search_treats_an_interrupted_batch_as_stopped() {
        let query = ContinuousSeedSearchQuery::parse(
            "0",
            "1.21",
            vec![requirement("spawn-village", "0", "0", "1000")],
            20,
        )
        .expect("query should be valid");
        let cancellation = AtomicBool::new(false);

        let result = run_continuous_seed_search(
            query,
            &cancellation,
            |_| {
                cancellation.store(true, AtomicOrdering::Release);
                Err(EngineProcessError::Cancelled)
            },
            |_| Ok(()),
        )
        .expect("an interrupted batch should stop cleanly");

        assert_eq!(result.searched_seed_count, 0);
        assert!(result.candidates.is_empty());
        assert_eq!(result.reason, SeedSearchCompletionReason::Stopped);
    }

    #[test]
    fn continuous_search_wraps_after_the_maximum_signed_seed() {
        let query = ContinuousSeedSearchQuery::parse(
            "9223372036854775806",
            "1.21",
            vec![requirement("spawn-village", "0", "0", "1000")],
            1,
        )
        .expect("query should be valid");
        let cancellation = AtomicBool::new(false);
        let mut batches = Vec::new();

        let result = run_continuous_seed_search(
            query,
            &cancellation,
            |batch| {
                batches.push((batch.first_seed, batch.seed_count));

                if batches.len() == 1 {
                    Ok(search_result(batch.seed_count, Vec::new()))
                } else {
                    Ok(search_result(
                        batch.seed_count,
                        vec![candidate(i64::MIN, 1, 0.2)],
                    ))
                }
            },
            |_| Ok(()),
        )
        .expect("continuous search should succeed");

        assert_eq!(batches, vec![(i64::MAX - 1, 2), (i64::MIN, 10_000)]);
        assert_eq!(result.searched_seed_count, 10_002);
        assert_eq!(result.reason, SeedSearchCompletionReason::Limit);
    }

    #[test]
    fn continuous_search_rejects_incomplete_engine_batches() {
        let query = ContinuousSeedSearchQuery::parse(
            "0",
            "1.21",
            vec![requirement("spawn-village", "0", "0", "1000")],
            1,
        )
        .expect("query should be valid");
        let cancellation = AtomicBool::new(false);

        let error = run_continuous_seed_search(
            query,
            &cancellation,
            |_| Ok(search_result(9_999, Vec::new())),
            |_| Ok(()),
        )
        .expect_err("incomplete batches should fail");

        assert!(
            error
                .to_string()
                .contains("reported 9999 searched seeds for a batch of 10000")
        );
    }

    #[test]
    fn continuous_search_ranks_candidates_by_matches_distance_and_seed() {
        let mut candidates = vec![candidate_with_matches(1, 3, 1, 0.1)];

        merge_candidates(
            &mut candidates,
            vec![
                candidate_with_matches(2, 3, 2, 0.8),
                candidate_with_matches(3, 3, 2, 0.2),
            ],
            3,
        );

        assert_eq!(
            candidates
                .iter()
                .map(|candidate| candidate.seed)
                .collect::<Vec<_>>(),
            vec![3, 2, 1]
        );
    }

    fn search_result(
        searched_seed_count: u32,
        candidates: Vec<super::SeedSearchCandidate>,
    ) -> SeedSearchResult {
        SeedSearchResult {
            searched_seed_count,
            candidates,
        }
    }

    fn candidate(
        seed: i64,
        matched_requirement_count: u32,
        average_normalized_distance: f64,
    ) -> super::SeedSearchCandidate {
        candidate_with_matches(
            seed,
            1,
            matched_requirement_count,
            average_normalized_distance,
        )
    }

    fn candidate_with_matches(
        seed: i64,
        total_requirement_count: u32,
        matched_requirement_count: u32,
        average_normalized_distance: f64,
    ) -> super::SeedSearchCandidate {
        let matches = (0..matched_requirement_count)
            .map(|index| {
                json!({
                    "requirementId": format!("village-{index}"),
                    "structureType": "village",
                    "targetCenter": { "x": 0, "z": 0 },
                    "radiusBlocks": 1000,
                    "actualPosition": { "x": 0, "z": 0 },
                    "distanceBlocks": 0.0,
                    "normalizedDistance": 0.0
                })
            })
            .collect::<Vec<_>>();

        serde_json::from_value(json!({
            "seed": seed,
            "totalRequirementCount": total_requirement_count,
            "matchedRequirementCount": matched_requirement_count,
            "matchesAllRequirements": matched_requirement_count == total_requirement_count,
            "matchRatio": f64::from(matched_requirement_count)
                / f64::from(total_requirement_count),
            "averageNormalizedDistance": average_normalized_distance,
            "matches": matches
        }))
        .expect("candidate should deserialize")
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
