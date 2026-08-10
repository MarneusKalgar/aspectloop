# 0002 Product Identity And Namespace

Status: Accepted  
Date: 2026-08-08

## Context

The project used `Elemika` as an internal working name while it evolved from an
interview-oriented proof of concept. The name is too close to the independent
Elemica product and company identity for a public repository, hosted demo, or
portfolio presentation.

The product needs one identity that can cover the current human review workflow
and future extraction, correction, and AI capabilities without implying an
affiliation or narrowing the product to correction alone.

## Decision

The product is named `AspectLoop`.

The canonical machine-facing names are:

| Surface               | Value                      |
| --------------------- | -------------------------- |
| Product name          | `AspectLoop`               |
| Slug                  | `aspectloop`               |
| Private npm scope     | `@aspectloop/*`            |
| Browser auth cookie   | `aspectloop_access_token`  |
| Mock reviewer address | `reviewer@aspectloop.test` |
| Local Compose base    | `aspectloop`               |
| UI monogram           | Equal-size uppercase `AL`  |

`AL` uses the same baseline, weight, and size with letter spacing `0`. A mixed
case `Al` or large-`A`/small-`L` lockup is not part of the current identity.

The product identity is not applied to generic domain contracts. Application
directories, service identifiers, routes, environment-variable keys, queues,
and events remain domain-oriented unless they contain the former product name.

The current browser cookie and default local Compose resources intentionally do
not remain compatible with the former namespace. Existing browser sessions are
invalidated, and the new local stack starts with clean data resources. This is
a namespace migration, not a database-schema migration.

## Alternatives Considered

`DatumLoop` described the data/provenance and human-correction loop precisely,
but its spelling and pronunciation are too close to Dataloop, an established
AI data and human-review platform in an adjacent space.

`AspectLoop` is broader and less directly tied to raw data. It represents the
document fields and facets that users review, while "Loop" retains the
extraction, validation, correction, and feedback cycle. Its exact compound is
more distinguishable for the intended product direction.

## Consequences

- Current tracked product surfaces use AspectLoop and `@aspectloop/*`.
- Future cloud resources use the `aspectloop` base when they are introduced.
- AspectLoop is an independent learning and portfolio project and is not
  affiliated with or endorsed by Elemica.
- Historical Git history and bounded architecture research can retain factual
  references to the former working name and real reference systems.
- This decision records an engineering naming assessment, not legal trademark
  clearance. Availability, domain, and trademark checks remain human-owned
  release gates.
