try {
  require('child_process').execSync('npx tsx server.ts', {stdio: 'inherit', env: {...process.env, PORT: 3005}});
} catch(e) {
  console.log("FAILED TO START");
}
