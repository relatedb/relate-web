# ADR-0072: .NET joins the docs' client languages, its samples built from the release tag

Status: Proposed

Date: 2026-11-20

## Context

relate 1.2.0 adds a .NET client, `Relate.Net`, for C#, F# and Visual Basic
on .NET 8 or later, over the same C ABI as the Java, Go, Swift and C
clients (upstream ADR-0625). It is not published to NuGet: an application
references the client's project from a checkout of the release tag and
supplies the engine library, either built from that checkout or taken from
the release's `relate-ffi-<target>.tar.gz` archive. A community package of
the same name on NuGet predates it and is not upstream's.

The docs cover every client with a get-started page, a guide and an API
reference, and every code sample on them is verified (ADR-0053): the
samples runner builds and runs it against the client and records its output.
The runner, the language picker, the surfaces matrix and the `verified_by`
list of each twin all enumerate the client languages.

## Decision

.NET is a client language of the docs, with the surface id `dotnet`, the
picker language `.NET` (tab keys `dotnet`, `csharp`, `net`), and the
verifier `dotnet`. Its pages are a get-started tutorial, a guide and an API
reference, written in C#.

C# samples are fenced ```` ```csharp run ````. The runner builds each one as
a `net8.0` console project whose one source file is the sample and which
references the client's `Relate.Net.csproj`, with `dotnet build -c Release`
against the engine library, then runs the built assembly with `dotnet`. The
samples setup copies `clients/dotnet` (without its tests) from the checkout
at the release tag that ADR-0062 already requires, and builds it once
against the engine library it builds for the C, Go and Swift samples. The
build keeps the CLI's state and NuGet's package folder under the setup's
own directory, and starts no build server that outlives it.

F# and Visual Basic are named where the client supports them; the verified
samples are C#.

## Alternatives considered

- **Mention .NET in the changelog only, until it is on NuGet.** Rejected:
  the client ships in the release, and a page that tells readers how to use
  it from the tag is more use than silence; the pages change when a package
  exists.
- **Document .NET without verified samples.** Rejected: every client's code
  on the docs is run; an unverified page would be the one exception.
- **Install the community NuGet package.** Rejected: it is not upstream's
  client and does not track its releases.

## Consequences

- The samples setup needs an SDK for .NET 8 or later; `--skip-dotnet` leaves
  the language out, as for the others.
- `_data/samples.json` gains a `csharp` client, described as a checkout
  build at the tag.
- When upstream publishes the client to a registry, a later decision moves
  its samples to the package, as ADR-0062 and ADR-0071 did for the others.
