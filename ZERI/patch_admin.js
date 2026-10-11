const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminPanel.tsx', 'utf8');
code = code.replace(
  `    if (currentUser.role === 'admin' || currentUser.email === 'admin@kosova.com') {
      return allSystemTabs;
    }`,
  `    if (currentUser.role === 'admin' || currentUser.email === 'admin@kosova.com' || currentUser.email === 'approval@ks.com' || currentUser.role === 'approver') {
      return allSystemTabs;
    }`
);
code = code.replace(
  `      // Legacy fallback roles if permissions aren't fully configured
      if (currentUser.role === 'approver') {
        return ['reports', 'categories', 'discussions', 'chat', 'notifications', 'polls'].includes(tab.id);
      }`,
  `      // Legacy fallback roles if permissions aren't fully configured
      if (currentUser.role === 'approver') {
        return true;
      }`
);
code = code.replace(
  `      if (currentUser.role === 'adsadmin') {`,
  `      if (currentUser.role === 'adsadmin' || currentUser.email === 'reklama@kosova.com' || currentUser.email === 'reklama@ks.com') {`
);
fs.writeFileSync('src/pages/AdminPanel.tsx', code);
