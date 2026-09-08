use crate::seed_search::{SeedSearchQuery, SeedSearchResult};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::env;
use std::error::Error;
use std::fmt::{self, Display, Formatter};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::Mutex;

const JSON_RPC_VERSION: &str = "2.0";
const PROTOCOL_VERSION: u32 = 1;
const ENGINE_RUNNER_ENVIRONMENT_VARIABLE: &str = "YOCSOW_ENGINE_RUNNER";
const REQUIRED_CAPABILITIES: [&str; 3] = ["engine.health", "seed.range.contains", "seed.search"];

pub struct EngineState {
    process: Mutex<Option<EngineProcess>>,
}

impl Default for EngineState {
    fn default() -> Self {
        Self {
            process: Mutex::new(None),
        }
    }
}

impl EngineState {
    pub(crate) fn status(&self) -> Result<EngineStatus, EngineProcessError> {
        self.with_process(EngineProcess::health)
    }

    pub(crate) fn seed_range_contains(
        &self,
        query: SeedRangeQuery,
    ) -> Result<SeedRangeResult, EngineProcessError> {
        self.with_process(|process| process.seed_range_contains(query))
    }

    pub(crate) fn search_seeds(
        &self,
        query: SeedSearchQuery,
    ) -> Result<SeedSearchResult, EngineProcessError> {
        self.with_process(|process| process.search_seeds(query))
    }

    fn with_process<T>(
        &self,
        operation: impl FnOnce(&mut EngineProcess) -> Result<T, EngineProcessError>,
    ) -> Result<T, EngineProcessError> {
        let mut process = self
            .process
            .lock()
            .map_err(|_| EngineProcessError::State("engine process lock was poisoned".into()))?;

        if process.is_none() {
            let executable = engine_runner_path()?;
            let mut started_process = EngineProcess::start(&executable)?;
            started_process.initialize()?;
            *process = Some(started_process);
        }

        let result = {
            let active_process = process
                .as_mut()
                .ok_or_else(|| EngineProcessError::State("engine process is unavailable".into()))?;

            operation(active_process)
        };

        if result
            .as_ref()
            .is_err_and(|error| error.invalidates_process())
        {
            *process = None;
        }

        result
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineStatus {
    status: String,
    initialized: bool,
    protocol_version: u32,
    engine_version: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct SeedRangeQuery {
    minimum: i64,
    maximum: i64,
    seed: i64,
}

impl SeedRangeQuery {
    pub(crate) fn parse(
        minimum: &str,
        maximum: &str,
        seed: &str,
    ) -> Result<Self, EngineProcessError> {
        Ok(Self {
            minimum: parse_signed_64_bit_integer("minimum", minimum)?,
            maximum: parse_signed_64_bit_integer("maximum", maximum)?,
            seed: parse_signed_64_bit_integer("seed", seed)?,
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeedRangeResult {
    contains: bool,
}

fn parse_signed_64_bit_integer(parameter: &str, value: &str) -> Result<i64, EngineProcessError> {
    value.trim().parse::<i64>().map_err(|_| {
        EngineProcessError::Input(format!("{parameter} must be a signed 64-bit integer"))
    })
}

struct EngineProcess {
    child: Child,
    client: JsonRpcClient<BufReader<ChildStdout>, ChildStdin>,
}

impl EngineProcess {
    fn start(executable: &Path) -> Result<Self, EngineProcessError> {
        if !executable.is_file() {
            return Err(EngineProcessError::Configuration(format!(
                "engine runner not found at {}; run ./gradlew :engine-runner:installDist \
                 or set {ENGINE_RUNNER_ENVIRONMENT_VARIABLE}",
                executable.display()
            )));
        }

        let mut child = Command::new(executable)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()?;

        let stdin = child.stdin.take().ok_or_else(|| {
            EngineProcessError::Protocol("engine runner stdin is unavailable".into())
        })?;

        let stdout = child.stdout.take().ok_or_else(|| {
            EngineProcessError::Protocol("engine runner stdout is unavailable".into())
        })?;

        Ok(Self {
            child,
            client: JsonRpcClient::new(BufReader::new(stdout), stdin),
        })
    }

    fn initialize(&mut self) -> Result<(), EngineProcessError> {
        let result: InitializeResult = self.client.call(
            "engine.initialize",
            Some(json!({
                "protocolVersion": PROTOCOL_VERSION
            })),
        )?;

        if result.protocol_version != PROTOCOL_VERSION {
            return Err(EngineProcessError::Protocol(format!(
                "engine selected protocol version {}, expected {PROTOCOL_VERSION}",
                result.protocol_version
            )));
        }

        if result.engine_version.trim().is_empty() {
            return Err(EngineProcessError::Protocol(
                "engine returned an empty version".into(),
            ));
        }

        for required_capability in REQUIRED_CAPABILITIES {
            if !result
                .capabilities
                .iter()
                .any(|capability| capability == required_capability)
            {
                return Err(EngineProcessError::Protocol(format!(
                    "engine does not advertise the {required_capability} capability"
                )));
            }
        }

        Ok(())
    }

    fn health(&mut self) -> Result<EngineStatus, EngineProcessError> {
        let status: EngineStatus = self.client.call("engine.health", None)?;

        if status.status != "ok" {
            return Err(EngineProcessError::Protocol(format!(
                "engine reported status {}",
                status.status
            )));
        }

        if !status.initialized {
            return Err(EngineProcessError::Protocol(
                "engine is not initialized".into(),
            ));
        }

        if status.protocol_version != PROTOCOL_VERSION {
            return Err(EngineProcessError::Protocol(format!(
                "engine health reported protocol version {}, expected {PROTOCOL_VERSION}",
                status.protocol_version
            )));
        }

        if status.engine_version.trim().is_empty() {
            return Err(EngineProcessError::Protocol(
                "engine health returned an empty version".into(),
            ));
        }

        Ok(status)
    }

    fn seed_range_contains(
        &mut self,
        query: SeedRangeQuery,
    ) -> Result<SeedRangeResult, EngineProcessError> {
        self.client.call(
            "seed.range.contains",
            Some(json!({
                "minimum": query.minimum,
                "maximum": query.maximum,
                "seed": query.seed
            })),
        )
    }

    fn search_seeds(
        &mut self,
        query: SeedSearchQuery,
    ) -> Result<SeedSearchResult, EngineProcessError> {
        let params = serde_json::to_value(query)?;

        let result: SeedSearchResult = self.client.call("seed.search", Some(params))?;

        result.validate()?;

        Ok(result)
    }
}

impl Drop for EngineProcess {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InitializeResult {
    protocol_version: u32,
    engine_version: String,
    capabilities: Vec<String>,
}

struct JsonRpcClient<R, W> {
    reader: R,
    writer: W,
    next_id: u64,
}

impl<R, W> JsonRpcClient<R, W>
where
    R: BufRead,
    W: Write,
{
    fn new(reader: R, writer: W) -> Self {
        Self {
            reader,
            writer,
            next_id: 1,
        }
    }

    fn call<T>(&mut self, method: &str, params: Option<Value>) -> Result<T, EngineProcessError>
    where
        T: DeserializeOwned,
    {
        let id = self.next_id;
        self.next_id = self
            .next_id
            .checked_add(1)
            .ok_or_else(|| EngineProcessError::Protocol("request ID overflow".into()))?;

        let request = match params {
            Some(params) => json!({
                "jsonrpc": JSON_RPC_VERSION,
                "id": id,
                "method": method,
                "params": params
            }),
            None => json!({
                "jsonrpc": JSON_RPC_VERSION,
                "id": id,
                "method": method
            }),
        };

        serde_json::to_writer(&mut self.writer, &request)?;
        self.writer.write_all(b"\n")?;
        self.writer.flush()?;

        let mut response_line = String::new();

        if self.reader.read_line(&mut response_line)? == 0 {
            return Err(EngineProcessError::Protocol(
                "engine runner closed stdout before responding".into(),
            ));
        }

        let response: JsonRpcResponse = serde_json::from_str(&response_line)?;

        if response.jsonrpc != JSON_RPC_VERSION {
            return Err(EngineProcessError::Protocol(format!(
                "unexpected JSON-RPC version {}",
                response.jsonrpc
            )));
        }

        if response.id != id {
            return Err(EngineProcessError::Protocol(format!(
                "unexpected response ID {}, expected {id}",
                response.id
            )));
        }

        match (response.result, response.error) {
            (Some(result), None) => Ok(serde_json::from_value(result)?),
            (None, Some(error)) => Err(EngineProcessError::Remote {
                code: error.code,
                message: error.message,
            }),
            _ => Err(EngineProcessError::Protocol(
                "response must contain exactly one of result or error".into(),
            )),
        }
    }
}

#[derive(Debug, Deserialize)]
struct JsonRpcResponse {
    jsonrpc: String,
    id: u64,
    result: Option<Value>,
    error: Option<JsonRpcRemoteError>,
}

#[derive(Debug, Deserialize)]
struct JsonRpcRemoteError {
    code: i64,
    message: String,
}

#[derive(Debug)]
pub(crate) enum EngineProcessError {
    Io(std::io::Error),
    Json(serde_json::Error),
    Configuration(String),
    Input(String),
    Protocol(String),
    Remote { code: i64, message: String },
    State(String),
}

impl EngineProcessError {
    fn invalidates_process(&self) -> bool {
        matches!(self, Self::Io(_) | Self::Json(_) | Self::Protocol(_))
    }
}

impl Display for EngineProcessError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        match self {
            Self::Io(error) => write!(formatter, "engine I/O error: {error}"),
            Self::Json(error) => write!(formatter, "invalid engine JSON: {error}"),
            Self::Configuration(message) => {
                write!(formatter, "engine configuration error: {message}")
            }
            Self::Input(message) => {
                write!(formatter, "invalid engine query: {message}")
            }
            Self::Protocol(message) => {
                write!(formatter, "engine protocol error: {message}")
            }
            Self::Remote { code, message } => {
                write!(formatter, "engine returned error {code}: {message}")
            }
            Self::State(message) => {
                write!(formatter, "engine state error: {message}")
            }
        }
    }
}

impl Error for EngineProcessError {}

impl From<std::io::Error> for EngineProcessError {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error)
    }
}

impl From<serde_json::Error> for EngineProcessError {
    fn from(error: serde_json::Error) -> Self {
        Self::Json(error)
    }
}

fn engine_runner_path() -> Result<PathBuf, EngineProcessError> {
    if let Some(configured_path) = env::var_os(ENGINE_RUNNER_ENVIRONMENT_VARIABLE) {
        return Ok(PathBuf::from(configured_path));
    }

    let repository_root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .ancestors()
        .nth(3)
        .ok_or_else(|| {
            EngineProcessError::Configuration("could not determine the repository root".into())
        })?;

    let executable_name = if cfg!(windows) {
        "engine-runner.bat"
    } else {
        "engine-runner"
    };

    Ok(repository_root
        .join("engine-runner")
        .join("build")
        .join("install")
        .join("engine-runner")
        .join("bin")
        .join(executable_name))
}

#[cfg(test)]
mod tests {
    use super::{
        EngineProcessError, EngineStatus, JSON_RPC_VERSION, JsonRpcClient, SeedRangeQuery,
        SeedRangeResult,
    };
    use serde_json::{Value, json};
    use std::io::{BufReader, Cursor};

    #[test]
    fn client_writes_a_request_and_reads_the_result() {
        let response = concat!(
            r#"{"jsonrpc":"2.0","id":1,"result":{"status":"ok","initialized":true,"protocolVersion":1,"engineVersion":"0.1.0-SNAPSHOT"}}"#,
            "\n"
        );

        let reader = BufReader::new(Cursor::new(response.as_bytes()));
        let writer = Vec::new();
        let mut client = JsonRpcClient::new(reader, writer);

        let status: EngineStatus = client
            .call("engine.health", None)
            .expect("health response should succeed");

        assert_eq!(status.status, "ok");
        assert!(status.initialized);
        assert_eq!(status.protocol_version, 1);

        let written_request =
            String::from_utf8(client.writer).expect("request should contain UTF-8");
        let request: Value =
            serde_json::from_str(written_request.trim()).expect("request should be valid JSON");

        assert_eq!(request["jsonrpc"], JSON_RPC_VERSION);
        assert_eq!(request["id"], 1);
        assert_eq!(request["method"], "engine.health");
        assert!(request.get("params").is_none());
    }

    #[test]
    fn client_writes_named_parameters() {
        let response = concat!(
            r#"{"jsonrpc":"2.0","id":1,"result":{"accepted":true}}"#,
            "\n"
        );

        let reader = BufReader::new(Cursor::new(response.as_bytes()));
        let writer = Vec::new();
        let mut client = JsonRpcClient::new(reader, writer);

        let result: Value = client
            .call(
                "engine.initialize",
                Some(json!({
                    "protocolVersion": 1
                })),
            )
            .expect("initialize response should succeed");

        assert_eq!(result["accepted"], true);

        let written_request =
            String::from_utf8(client.writer).expect("request should contain UTF-8");
        let request: Value =
            serde_json::from_str(written_request.trim()).expect("request should be valid JSON");

        assert_eq!(request["params"]["protocolVersion"], 1);
    }

    #[test]
    fn client_writes_seed_range_query_and_reads_result() {
        let response = concat!(
            r#"{"jsonrpc":"2.0","id":1,"result":{"contains":true}}"#,
            "\n"
        );

        let reader = BufReader::new(Cursor::new(response.as_bytes()));
        let writer = Vec::new();
        let mut client = JsonRpcClient::new(reader, writer);
        let query =
            SeedRangeQuery::parse("-10", "10", "0").expect("seed range query should be valid");

        let result: SeedRangeResult = client
            .call(
                "seed.range.contains",
                Some(json!({
                    "minimum": query.minimum,
                    "maximum": query.maximum,
                    "seed": query.seed
                })),
            )
            .expect("seed range response should succeed");

        assert!(result.contains);

        let written_request =
            String::from_utf8(client.writer).expect("request should contain UTF-8");
        let request: Value =
            serde_json::from_str(written_request.trim()).expect("request should be valid JSON");

        assert_eq!(request["method"], "seed.range.contains");
        assert_eq!(request["params"]["minimum"], -10);
        assert_eq!(request["params"]["maximum"], 10);
        assert_eq!(request["params"]["seed"], 0);
    }

    #[test]
    fn seed_range_query_accepts_full_signed_64_bit_values() {
        let query = SeedRangeQuery::parse(
            "-9223372036854775808",
            "9223372036854775807",
            "9223372036854775807",
        )
        .expect("signed 64-bit values should be accepted");

        assert_eq!(query.minimum, i64::MIN);
        assert_eq!(query.maximum, i64::MAX);
        assert_eq!(query.seed, i64::MAX);
    }

    #[test]
    fn seed_range_query_rejects_values_outside_signed_64_bit_range() {
        let error = SeedRangeQuery::parse("0", "9223372036854775808", "1")
            .expect_err("out-of-range values should be rejected");

        match error {
            EngineProcessError::Input(message) => {
                assert_eq!(message, "maximum must be a signed 64-bit integer");
            }
            other => panic!("unexpected error: {other}"),
        }
    }

    #[test]
    fn client_returns_remote_errors() {
        let response = concat!(
            r#"{"jsonrpc":"2.0","id":1,"error":{"code":-32601,"message":"Method not found"}}"#,
            "\n"
        );

        let reader = BufReader::new(Cursor::new(response.as_bytes()));
        let writer = Vec::new();
        let mut client = JsonRpcClient::new(reader, writer);

        let error = client
            .call::<Value>("engine.unknown", None)
            .expect_err("remote error should be returned");

        match error {
            EngineProcessError::Remote { code, message } => {
                assert_eq!(code, -32601);
                assert_eq!(message, "Method not found");
            }
            other => panic!("unexpected error: {other}"),
        }
    }

    #[test]
    fn client_rejects_mismatched_response_ids() {
        let response = concat!(
            r#"{"jsonrpc":"2.0","id":99,"result":{"status":"ok"}}"#,
            "\n"
        );

        let reader = BufReader::new(Cursor::new(response.as_bytes()));
        let writer = Vec::new();
        let mut client = JsonRpcClient::new(reader, writer);

        let error = client
            .call::<Value>("engine.health", None)
            .expect_err("mismatched ID should fail");

        assert!(error.to_string().contains("unexpected response ID 99"));
    }
}
