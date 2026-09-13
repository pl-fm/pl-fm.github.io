/**
 * Single place to configure deployment-specific values.
 *
 * Change `url` and `maintainer` when you fork or move the site. Everything
 * else in the codebase reads from here, so nothing else needs editing.
 */
export const SITE = {
  /** Origin the site is served from. No trailing slash. */
  url: 'https://pl-fm.github.io',

  /**
   * Sub-path the site is served from. Use '/' for a user/organisation page or
   * a custom domain, and '/plfm' for a GitHub Pages project page.
   */
  base: '/',

  title: 'PLFM',

  description:
    'A calendar of conferences, deadlines, schools, and events in programming languages and formal methods.',

  maintainer: {
    name: 'Bhumika Mittal',
    /** Personal site. Leave empty and the name renders as plain text. */
    url: 'https://bhumikamittal.in/',
    email: 'bhumikamittal@gatech.edu',
  },

  maintainerNote:
    'Inclusion is not an endorsement. Always confirm dates and eligibility on the official page before you rely on them.',
};

export default SITE;
