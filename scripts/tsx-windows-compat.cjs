// Some Node.js Windows builds can fail in os.userInfo(), which tsx only uses to name a temp folder.
if (process.platform === 'win32' && typeof process.geteuid !== 'function') process.geteuid = () => 0;
