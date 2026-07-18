// Dynamic config layered on top of app.json — lets the dev-client build use
// a different Android application id than the release build, so both can be
// installed side by side without uninstalling one to test the other.
// APP_VARIANT is set per-script in package.json (never inferred from
// NODE_ENV — Expo's own docs warn NODE_ENV isn't reliable for this: `expo
// export` always forces it to "production" regardless of what invoked it).
const IS_DEV = process.env.APP_VARIANT === 'development';

module.exports = ({ config }) => ({
  ...config,
  name: IS_DEV ? `${config.name} (Dev)` : config.name,
  android: {
    ...config.android,
    package: IS_DEV ? `${config.android.package}.dev` : config.android.package,
  },
});
