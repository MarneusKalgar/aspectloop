/**
 * Exact npm project settings enforced by the dependency policy check.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const REQUIRED_NPM_CONFIG = Object.freeze({
  'engine-strict': 'true',
  'strict-npmrc': 'true',
  'min-release-age': '3',
  'allow-directory': 'root',
  'allow-file': 'none',
  'allow-git': 'none',
  'allow-remote': 'none',
  'strict-allow-scripts': 'true',
});

/**
 * Effective npm settings required while dependency policy checks execute.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const REQUIRED_EFFECTIVE_NPM_CONFIG = Object.freeze({
  ...REQUIRED_NPM_CONFIG,
  'dangerously-allow-all-scripts': 'false',
  'ignore-scripts': 'false',
  'legacy-peer-deps': 'false',
  force: 'false',
});
