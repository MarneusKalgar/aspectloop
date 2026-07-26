# Contracts

`@elemika/contracts` is the framework-free public boundary for contracts shared
by independently deployed runtimes.

Add transport, event, or provider contracts only when at least two runtimes
need the same stable shape. Do not place NestJS modules, TypeORM entities,
GraphQL resolver definitions, React types, or gateway-only domain types here.
