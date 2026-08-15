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
