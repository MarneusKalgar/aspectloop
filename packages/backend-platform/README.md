# Backend Platform

`@aspectloop/backend-platform` owns backend-only behavior with genuine consumers
in more than one NestJS application.

Current public boundaries:

- `@aspectloop/backend-platform/config`: common environment transformation,
  validation, and ordered local environment-file loading mechanics; each
  application retains its own schema and adapter;
- `@aspectloop/backend-platform/database`: bounded PostgreSQL datasource
  defaults and source/build discovery conventions; each application retains
  its own connection, entities, migrations, and NestJS adapter;
- `@aspectloop/backend-platform/logging`: bounded HTTP logging, request IDs,
  redaction, and completion-event serialization; each application retains its
  service identity and NestJS configuration adapter.

Do not add entities, repositories, migrations, domain workflows, GraphQL
transport types, or service-specific environment schemas to this package.
