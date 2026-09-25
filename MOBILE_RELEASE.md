# Android release setup

The `Build Android Release` workflow runs for version tags such as `v4.2.0` and can also be started manually. It uses the same `npm run android:build:release` command as a local Windows build. Stable signing credentials are required so users can install future versions over the existing app without losing app-local downloads.

## Android secrets

- `ANDROID_KEYSTORE_BASE64`: base64-encoded `.jks`/keystore file.
- `ANDROID_KEYSTORE_PASSWORD`: keystore password.
- `ANDROID_KEY_ALIAS`: signing key alias.
- `ANDROID_KEY_PASSWORD`: signing key password.

Generate the base64 value without line wrapping and add it as a GitHub Actions repository secret. Keep the original keystore backed up permanently. Losing or changing it prevents users from installing updates over earlier builds.

## Publishing

After configuring secrets, publish with:

```bash
git tag v4.2.0
git push origin v4.2.0
```

The desktop and Android workflows attach their platform artifacts to the same GitHub Release and use `RELEASE_NOTES_v4.2.0.md` as its release body.
