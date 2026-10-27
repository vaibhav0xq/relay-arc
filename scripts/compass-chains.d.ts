/**
 * Type declarations for '@circlefin/compass-chains'.
 *
 * Why this file exists
 * ====================
 * `scripts/compass-deploy.ts` imports `getChain` from '@circlefin/compass-chains'.
 * That package is a PRIVATE Circle package: it is not on the public npm registry,
 * it is not listed in this project's package.json, and it is not vendored in
 * node_modules. It is present only inside the Arc Studio sandbox, which is also
 * the only place `compass-deploy.ts` can run at all — that script hardcodes
 * `WORK_DIR = '/home/user/app'`, an Arc Studio path.
 *
 * Without these declarations `tsc` fails the whole project with TS2307 on an
 * import it cannot resolve, which masks every other diagnostic behind one
 * environmental error. This file supplies the missing types the same way an
 * @types/* package would, so the repository typechecks outside Arc Studio.
 *
 * What this file deliberately does NOT do
 * =======================================
 * It does not use `any`, `@ts-ignore`, `skipLibCheck` or a tsconfig exclusion,
 * so no real error is suppressed. The shape below is narrowed to exactly the
 * three fields `compass-deploy.ts` reads. If that script starts using another
 * field, or the upstream shape changes, tsc will say so instead of staying
 * quiet.
 *
 * What it does not fix
 * ====================
 * `compass-deploy.ts` still cannot RUN anywhere but Arc Studio, because the
 * package is genuinely absent at runtime and the paths are hardcoded. Types are
 * not a substitute for the dependency. If this script is meant to run in this
 * repo, the package has to be published or vendored; if it is not, the script
 * and its two sibling helpers belong in Arc Studio rather than here.
 */
declare module '@circlefin/compass-chains' {
  /** The fields `scripts/compass-deploy.ts` reads off a Compass chain definition. */
  export interface CompassChain {
    /** Human-readable chain name, e.g. "Arc Testnet". */
    name: string;
    /** Block explorer base URL. Absent for chains with no explorer. */
    explorerUrl?: string;
    nativeCurrency: {
      symbol: string;
    };
  }

  /**
   * Look up a Compass chain definition by its Compass id, e.g. "Arc_Testnet"
   * or "Base_Sepolia". Throws for an unknown id.
   */
  export function getChain(compassChain: string): CompassChain;
}
