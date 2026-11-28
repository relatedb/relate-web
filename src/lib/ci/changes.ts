// Which CI work a change needs (the `changes` job of .github/workflows/cookbook.yml). The required
// check, `check`, always reports; what it waits for depends on what the pull request touched.
// Pure: the caller lists the changed paths. A path this file does not recognise as lighter work
// means everything runs, so the fast paths are the exception that has to be earned.
//
//   projects-data  only the committed projects store (src/data/projects.relate/): the unit tests and
//                  a read of the store (projects:verify), no build
//   meta           only decision records, runbooks, root notes, workflows other than the Cookbook
//                  one and the release-post prompt: nothing a build or a browser reads
//   blog           blog posts and their images, maybe with the above: the site build and its built
//                  checks (the content schema and the sitemap are checked there), no browser, no
//                  docs or recipe checks
//   full           anything else (and a change that lists no paths)
//
// The unit tests and the decision-record check run in every profile. A push to main and a manual
// run are always full, so a wrong rule here is caught after the merge.

export interface Plan {
  profile: 'full' | 'blog' | 'projects-data' | 'meta';
  /** docs:check, the prose lint, the recipe check and the type check. */
  docs: boolean;
  /** The site build and the built-docs checks. */
  build: boolean;
  /** The headless-Chrome shards. */
  browser: boolean;
  reason: string;
}

const PROJECTS_DATA = /^src\/data\/projects\.relate\//;
const BLOG = /^(src\/content\/blog\/|public\/blog\/)/;
const META: RegExp[] = [
  /^docs\/adr\//,
  /^runbooks\//,
  /^[^/]+\.md$/,
  /^scripts\/release-post\//,
  // Workflows and repository settings, except the workflow this plan belongs to.
  /^\.github\/(?!workflows\/cookbook\.yml$)/,
];

export type Kind = 'projects-data' | 'blog' | 'meta' | 'other';

export function kindOf(path: string): Kind {
  const p = path.replace(/^\.\//, '');
  if (PROJECTS_DATA.test(p)) return 'projects-data';
  if (BLOG.test(p)) return 'blog';
  if (META.some((re) => re.test(p))) return 'meta';
  return 'other';
}

const FULL = { docs: true, build: true, browser: true } as const;

export function plan(paths: string[]): Plan {
  const files = paths.map((p) => p.trim()).filter(Boolean);
  if (files.length === 0) return { profile: 'full', ...FULL, reason: 'no changed paths were listed' };
  const kinds = files.map(kindOf);
  const other = files.find((_, i) => kinds[i] === 'other');
  if (other) return { profile: 'full', ...FULL, reason: `${other} needs the full set` };
  if (kinds.includes('blog')) return { profile: 'blog', docs: false, build: true, browser: false, reason: 'only blog posts, their images and notes changed' };
  if (kinds.every((k) => k === 'projects-data')) return { profile: 'projects-data', docs: false, build: false, browser: false, reason: 'only the projects store changed' };
  return { profile: 'meta', docs: false, build: false, browser: false, reason: 'only records, notes and workflows changed' };
}
