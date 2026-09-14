plugins {
    `java-library`
    checkstyle
    id("com.diffplug.spotless")
}

group = "io.github.raisybear.yocsow"
version = "0.1.0-SNAPSHOT"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("net.java.dev.jna:jna:5.19.1")

    testImplementation(platform("org.junit:junit-bom:6.1.3"))
    testImplementation("org.junit.jupiter:junit-jupiter")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

val benchmark = sourceSets.create("benchmark") {
    compileClasspath += sourceSets.main.get().output
    runtimeClasspath += sourceSets.main.get().output
}

configurations[benchmark.implementationConfigurationName].extendsFrom(
    configurations.implementation.get(),
)

configurations[benchmark.runtimeOnlyConfigurationName].extendsFrom(
    configurations.runtimeOnly.get(),
)

val hostOperatingSystem =
    System.getProperty("os.name").lowercase()

val hostArchitecture =
    System.getProperty("os.arch").lowercase()

val jnaArchitecture =
    when (hostArchitecture) {
        "amd64", "x86_64" -> "x86-64"
        "aarch64", "arm64" -> "aarch64"
        else ->
            throw GradleException(
                "Unsupported native architecture: $hostArchitecture",
            )
    }

val nativePlatform =
    when {
        hostOperatingSystem.startsWith("windows") ->
            Triple(
                "win32",
                "cubiomes/Release/yocsow_cubiomes.dll",
                "yocsow_cubiomes.dll",
            )

        hostOperatingSystem.startsWith("linux") ->
            Triple(
                "linux",
                "cubiomes/libyocsow_cubiomes.so",
                "libyocsow_cubiomes.so",
            )

        hostOperatingSystem.startsWith("mac") ->
            Triple(
                "darwin",
                "cubiomes/libyocsow_cubiomes.dylib",
                "libyocsow_cubiomes.dylib",
            )

        else ->
            throw GradleException(
                "Unsupported native operating system: $hostOperatingSystem",
            )
    }

val nativeBuildDirectory =
    rootProject.layout.buildDirectory
        .dir("native-runtime")
        .get()
        .asFile

val nativeLibraryFile =
    nativeBuildDirectory.resolve(nativePlatform.second)

val configureNativeComponents =
    tasks.register<Exec>("configureNativeComponents") {
    group = "build"
    description = "Configures the native YOCSOW components."

    workingDir(rootProject.projectDir)

    commandLine(
        "cmake",
        "-S",
        rootProject.file("native").absolutePath,
        "-B",
        nativeBuildDirectory.absolutePath,
        "-DCMAKE_BUILD_TYPE=Release",
    )

    inputs.files(
        rootProject.file("native/CMakeLists.txt"),
        rootProject.file("native/cubiomes/CMakeLists.txt"),
        rootProject.file("third_party/cubiomes/CMakeLists.txt"),
    )

    outputs.file(
        nativeBuildDirectory.resolve("CMakeCache.txt"),
    )
}

val buildNativeComponents =
    tasks.register<Exec>("buildNativeComponents") {
    group = "build"
    description = "Builds the native YOCSOW components."

    dependsOn(configureNativeComponents)

    workingDir(rootProject.projectDir)

    commandLine(
        "cmake",
        "--build",
        nativeBuildDirectory.absolutePath,
        "--config",
        "Release",
        "--target",
        "yocsow_cubiomes",
    )

    inputs.files(
        rootProject.fileTree("native") {
            include(
                "**/*.c",
                "**/*.h",
                "**/CMakeLists.txt",
            )
        },
        rootProject.fileTree("third_party/cubiomes") {
            include(
                "**/*.c",
                "**/*.h",
                "**/CMakeLists.txt",
            )
        },
    )

    outputs.file(nativeLibraryFile)
}

tasks.processResources {
    dependsOn(buildNativeComponents)

    from(nativeLibraryFile) {
        into("${nativePlatform.first}-$jnaArchitecture")
        rename { nativePlatform.third }
    }
}

checkstyle {
    toolVersion = "14.1.0"
    maxWarnings = 0
}

spotless {
    java {
        forbidWildcardImports()
        removeUnusedImports()
        googleJavaFormat()
        formatAnnotations()
        trimTrailingWhitespace()
        endWithNewline()
    }
}

tasks.test {
    useJUnitPlatform()
}

tasks.register<JavaExec>("benchmarkSeedSearch") {
    group = "verification"
    description = "Measures deterministic seed-search throughput."

    dependsOn(benchmark.classesTaskName)

    classpath = benchmark.runtimeClasspath
    mainClass.set("io.github.raisybear.yocsow.engine.search.seed.SeedSearchBenchmark")

    args(
        providers.gradleProperty("seedSearchBenchmarkScenario").getOrElse("shared"),
        providers.gradleProperty("seedSearchBenchmarkSeedCount").getOrElse("10000"),
        providers.gradleProperty("seedSearchBenchmarkIterations").getOrElse("3"),
        providers.gradleProperty("seedSearchBenchmarkWarmupSeedCount").getOrElse("2000"),
        providers.gradleProperty("seedSearchBenchmarkResultLimit").getOrElse("20"),
        providers
            .gradleProperty("seedSearchBenchmarkParallelism")
            .getOrElse(Runtime.getRuntime().availableProcessors().toString()),
    )
}
