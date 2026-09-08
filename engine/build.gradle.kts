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
