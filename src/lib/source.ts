// Where this deployment's code lives. Dependency-free (used by the sync scripts too).

const env = process.env;

/**
 * This deployment's source repo: NEXT_PUBLIC_SOURCE_URL, else the GitHub repo Vercel deployed from
 * (so a fork identifies itself, not us). Null when unknown, e.g. local dev.
 */
export const SOURCE_URL: string | null =
  env.NEXT_PUBLIC_SOURCE_URL ||
  (env.VERCEL_GIT_PROVIDER === "github" && env.VERCEL_GIT_REPO_OWNER && env.VERCEL_GIT_REPO_SLUG
    ? `https://github.com/${env.VERCEL_GIT_REPO_OWNER}/${env.VERCEL_GIT_REPO_SLUG}`
    : null);

/** How the library and Wikidata can reach whoever runs this copy (sent in the User-Agent). */
export const CONTACT_URL: string | null = env.CONTACT_URL || SOURCE_URL;
