import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * The React Hooks check that CI runs: `npx eslint -c eslint.hooks.config.js src`.
 *
 * Only the two classic rules, nothing else, so it can be strict. Every file is held to
 * "error" (the build fails) EXCEPT the files below, which already had findings when the
 * plugin was installed (2026-10-13). They are reported as warnings so the debt stays
 * visible; removing a file from the list once it is clean is the way to ratchet. Do not
 * add a file to this list to make CI pass: fix the hook instead.
 *
 * Findings in the list include real defects: hooks called after an early return in
 * src/pages/Dashboard.tsx and src/pages/ReportIssue.tsx (public pages, awaiting an
 * owner decision to touch them, see docs/CI_REMEDIATION.md).
 */
export const LEGACY_HOOK_DEBT = [
  "src/App.tsx",
  "src/components/AdBanner.tsx",
  "src/components/FloatingSupportBot.tsx",
  "src/components/ForumProfileModal.tsx",
  "src/components/SocialFeed.tsx",
  "src/components/admin/AdminAgents.tsx",
  "src/components/admin/AdminReports.tsx",
  "src/components/debate/DebatePosts.tsx",
  "src/components/forum/DirectMessagesModal.tsx",
  "src/components/forum/ForumProfileTab.tsx",
  "src/components/forum/ForumSettingsPanel.tsx",
  "src/components/forum/ForumStories.tsx",
  "src/components/forum/ReelEditor.tsx",
  "src/components/forum/ReelsViewer.tsx",
  "src/pages/Dashboard.tsx",
  "src/pages/DashboardOriginalBackup.tsx",
  "src/pages/ForumPage.tsx",
  "src/pages/HealthRegistryPage.tsx",
  "src/pages/LajmePage.tsx",
  "src/pages/LoginPage.tsx",
  "src/pages/MonitoringPage.tsx",
  "src/pages/ReportIssue.tsx",
  "src/pages/StatisticsPage.tsx"
];

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  tseslint.configs.base,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error'
    }
  },
  {
    files: LEGACY_HOOK_DEBT,
    rules: {
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn'
    }
  }
];
