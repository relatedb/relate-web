# ADR-0071: The Java samples install ai.relatedb:relate from Maven Central

Status: Proposed

Date: 2026-11-20

## Context

ADR-0062 has the verified samples install every client a registry publishes,
at the release the docs are pinned to, and build the rest from an upstream
checkout at the tag. The Java client was one of the rest: up to relate 1.1.0,
`ai.relatedb:relate` was a release download only, so the samples setup
packaged a copy of `clients/java` with Maven and pointed it at an engine
library built from the checkout, and the Java pages told readers to run
`mvn install:install-file` on the release jar.

From relate 1.2.0, every release publishes `ai.relatedb:relate` to Maven
Central: the all-platform jar, which bundles the engine for the five
supported platforms, one classifier jar per platform, and a POM naming JNA
and Jackson. The jar on Central is not byte-identical to the jar attached to
the GitHub release, so a sample run on the release jar, or on a checkout
build, proves less than a run on what a reader's build resolves.

## Decision

The samples setup resolves `ai.relatedb:relate:<version>` from Maven Central,
the way a reader's Maven build does: a POM with that one dependency, resolved
with checksum failures fatal into a Maven repository of its own, and its
runtime classpath (the client jar first, then JNA and Jackson) handed to the
runner. A Java sample runs without `RELATE_LIB`, so the client loads the
engine it bundles. The setup no longer copies `clients/java` from the
checkout, and the Java client no longer needs the engine library built there.

The Java pages describe the Maven Central dependency for Maven and Gradle.
ADR-0062 still holds for the clients without a registry.

## Alternatives considered

- **Keep packaging `clients/java` from the checkout.** No new network
  dependency, one code path for the clients built from the tag. Rejected:
  the docs would verify a jar no reader installs, and a packaging fault in
  the published jar (a missing native, a wrong POM dependency) would pass.
- **Download the jar attached to the GitHub release.** Rejected: it is not
  the artifact a Maven or Gradle build resolves, and its dependencies would
  still have to come from somewhere.

## Consequences

- A replay needs Maven Central, and a release's Java samples can be
  re-recorded only once Central serves it, which can lag the GitHub release.
- `_data/samples.json` describes the Java client as the published artifact.
- Maven and the pinned JDK are still downloaded by the setup; only what
  Maven resolves changes.
