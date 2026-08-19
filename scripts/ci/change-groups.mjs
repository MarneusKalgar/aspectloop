export const CHANGE_GROUPS = Object.freeze({
  dependencies: Object.freeze({
    changedReason: 'dependency-policy surfaces changed',
    paths: Object.freeze([
      '.npmrc',
      'package.json',
      'package-lock.json',
      ':(glob)apps/*/package.json',
      ':(glob)mocks/*/package.json',
      ':(glob)packages/*/package.json',
      ':(glob)scripts/dependencies/**',
    ]),
    unchangedReason: 'no dependency-policy changes',
  }),
  docker: Object.freeze({
    changedReason: 'Docker-related changes detected',
    paths: Object.freeze([
      '.dockerignore',
      'apps/gateway-api/Dockerfile.dev',
      'infra/local/compose.local.yml',
      'mocks/persistence-service/.dockerignore',
      'mocks/persistence-service/Dockerfile.dev',
      'droast.toml',
    ]),
    unchangedReason: 'no Docker-related changes',
  }),
});
