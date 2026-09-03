# ADR 0001: Java engine process boundary

- Status: Accepted
- Date: 2026-09-03

## Context

YOCSOW consists of three primary local components:

- a React and TypeScript user interface;
- a Tauri and Rust desktop runtime;
- a Java 21 Minecraft engine.

The Java engine must remain independent from the user interface and desktop
framework. It will perform seed analysis, constraint evaluation, world-data
processing, and later computationally expensive generation tasks.

The desktop application must remain local-first and must not require a hosted
service or locally exposed network port.

A stable boundary is required between the Rust desktop runtime and the Java
engine.

## Decision

The Java engine will run as a separate child process managed by the Tauri
Rust runtime.

The architecture is:

```text
React UI
    ↓ Tauri commands
Rust desktop runtime
    ↓ JSON-RPC 2.0 over stdin and stdout
Java engine runner
    ↓ Java method calls
Java engine library
```

React must never start or communicate with the Java process directly.

### Java modules

The existing `engine` module remains a reusable Java library containing
Minecraft and world-generation logic.

A separate `engine-runner` Gradle application module will be introduced. It
will:

- depend on the `engine` module;
- own the JSON-RPC protocol implementation;
- read requests from standard input;
- write responses to standard output;
- write diagnostic logs to standard error;
- contain no graphical user interface.

The `engine` library must not depend on Tauri, Rust, React, or transport-layer
classes.

### Transport

The Rust runtime communicates with the Java process through piped standard
input and standard output.

Messages use UTF-8 encoded JSON Lines:

- every request occupies exactly one line;
- every response occupies exactly one line;
- line endings delimit messages;
- standard output is reserved exclusively for protocol messages;
- logs and diagnostics are written to standard error.

No TCP or HTTP port is opened.

### Protocol

Messages follow the JSON-RPC 2.0 specification.

Requests contain:

- `jsonrpc` with the value `"2.0"`;
- a unique string `id`;
- a namespaced `method`;
- an optional structured `params` object.

Example initialization request:

```json
{"jsonrpc":"2.0","id":"1","method":"engine.initialize","params":{"protocolVersion":1,"clientVersion":"0.1.0"}}
```

Example successful response:

```json
{"jsonrpc":"2.0","id":"1","result":{"protocolVersion":1,"engineVersion":"0.1.0"}}
```

Example error response:

```json
{"jsonrpc":"2.0","id":"1","error":{"code":-32602,"message":"Invalid params"}}
```

Response identifiers must match their request identifiers.

Protocol field names and method parameters use `camelCase`. Method names use
the `engine.` namespace.

The YOCSOW engine protocol version is independent from the JSON-RPC version
and application version. The first request must be `engine.initialize`.
Unsupported protocol versions must be rejected before other operations are
accepted.

The initial protocol version is `1`.

### Process lifecycle

The Rust desktop runtime owns the complete Java process lifecycle.

It will:

1. start one engine process on demand;
2. retain the process while the desktop application is running;
3. connect piped standard input, output, and error streams;
4. correlate responses with requests by JSON-RPC identifier;
5. apply operation timeouts;
6. report process failures as typed Tauri command errors;
7. request graceful shutdown when the application exits;
8. terminate the process if graceful shutdown exceeds its timeout.

Unexpected process termination must fail pending operations. The runtime must
not silently repeat an operation because generation or file-writing commands
might not be safe to execute twice.

A restart policy may be added later for operations that are explicitly known
to be safe to retry.

### Concurrency

The first implementation processes one request at a time.

The protocol identifiers allow concurrent requests to be introduced later
without changing the message format. Long-running operations may later use
JSON-RPC notifications for progress and explicit cancellation methods.

Tauri commands that wait for the engine must be asynchronous so the desktop
interface remains responsive.

### Packaging

During development, the runner uses the Java 21 installation selected through
`.sdkmanrc`.

Production releases will include:

- the engine runner;
- the engine libraries;
- a platform-specific launcher;
- a minimal Java 21 runtime created with `jlink`.

The runtime and runner will be bundled as platform-specific application
resources or sidecar artifacts. Users must not be required to install Java
separately.

Windows, Linux, and macOS artifacts must be produced separately because the
Java runtime and native launcher are platform-specific.

### Security

The implementation must:

- start only the bundled or explicitly configured engine executable;
- avoid constructing shell command strings;
- pass arguments as separate process arguments;
- validate all incoming and outgoing protocol messages;
- reject unknown methods;
- limit accepted message sizes;
- validate all filesystem paths at the native boundary;
- prevent protocol logs from being written to standard output;
- avoid exposing authentication tokens or secrets to the engine process.

The Java engine does not receive unrestricted access to frontend input.
Requests pass through validation in the Rust runtime and Java runner.

## Alternatives considered

### Local Spring Boot HTTP service

A local HTTP service would provide familiar tooling but would require port
selection, service discovery, lifecycle management, and protection against
requests from other local processes.

Spring Boot remains an option for future online community services, but it is
not used for desktop IPC.

### JNI

JNI would avoid a separate process but introduces a complex native boundary,
platform-specific loading behavior, unsafe failure modes, and tighter coupling
between Rust and the JVM.

A JVM crash could also terminate the entire desktop application.

### Reimplement the engine in Rust

Using only Rust would simplify the process topology, but it would discard the
Java ecosystem and require Minecraft Java Edition logic to be duplicated.

Rust remains responsible for desktop orchestration, not Minecraft engine
implementation.

### Start a new Java process for every operation

A process-per-operation model would be simpler initially but would repeatedly
pay JVM startup costs and prevent reuse of caches and loaded world data.

## Consequences

### Positive

- the application remains fully local;
- no local network port is exposed;
- Java and Rust remain independently testable;
- engine crashes are isolated from the desktop process;
- the Java engine remains reusable outside Tauri;
- the protocol can evolve independently from implementation details;
- heavy engine work does not run inside the webview process.

### Negative

- process lifecycle and asynchronous request handling add complexity;
- protocol types must be maintained in Java, Rust, and TypeScript;
- releases become larger because they include a Java runtime;
- platform-specific packaging must include the correct runtime;
- standard output cannot be used for ordinary Java logging.

## Initial implementation sequence

1. Add the `engine-runner` Gradle application module.
2. Implement `engine.initialize` and `engine.health`.
3. Add protocol parsing, validation, and unit tests in Java.
4. Add a supervised Java process client in Rust.
5. Expose engine health through a Tauri command.
6. Add frontend status handling and integration tests.
7. Bundle a minimal Java runtime in release workflows.

## References

- [JSON-RPC 2.0 specification](https://www.jsonrpc.org/specification)
- [Tauri external binaries](https://v2.tauri.app/develop/sidecar/)
- [Java 21 jlink](https://docs.oracle.com/en/java/javase/21/docs/specs/man/jlink.html)
