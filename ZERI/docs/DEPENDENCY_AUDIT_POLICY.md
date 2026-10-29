# Dependency audit and upgrade policy

The production dependency gate is:

```sh
npm audit --omit=dev --audit-level=high
```

This gate blocks high and critical vulnerabilities in dependencies shipped with the application. The lockfile remediation in the current dependency update branch applies compatible, non-breaking fixes and consolidates the React DOM and Zustand patch updates.

Do not use `npm audit fix --force` as an unattended fix. The audit also reports advisories in development tools whose automatic fix requires major upgrades (including the Firebase CLI and Vitest). Upgrade those separately with a coordinated toolchain change and rerun the emulator, coverage, build, bundle-budget, and Playwright suites.

Known upgrade constraints from the October 2026 review:

- Firebase SDK 13 increased the initial gzip JavaScript bundle above the current 440 KB budget; retain Firebase 12 until the bundle is re-optimized.
- `@vitejs/plugin-react` 6 requires Vite 8, while this project uses Vite 6; treat it as a coordinated Vite migration.
- `lucide-react` 1.x is a major upgrade from 0.x; test it in a dedicated migration.
