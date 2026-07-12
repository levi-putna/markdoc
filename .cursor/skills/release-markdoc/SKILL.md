---
name: release-markdoc
description: >-
  Cuts a new MarkDoc release end-to-end: shows the current version, confirms
  the new version number and release notes with the user, then bumps the
  version, builds, signs/notarizes, and publishes the GitHub release via
  electron-builder. Use when the user asks to release, cut a release, ship a
  new version, publish an update, or run `yarn release` for the MarkDoc app.
---

# Releasing MarkDoc

End-to-end workflow for shipping a new MarkDoc version, per `README.md`'s
"Releasing an update" section and the `build`/`scripts` config in
`package.json`. Follow the steps in order — each gate must be confirmed by
the user before moving to the next.

```
Release progress:
- [ ] 1. Show current version
- [ ] 2. Confirm new version
- [ ] 3. Confirm release notes
- [ ] 4. Preflight checks
- [ ] 5. Bump version
- [ ] 6. Commit and push the version bump
- [ ] 7. Build, sign, notarize, publish (draft)
- [ ] 8. Set release notes
- [ ] 9. Confirm and publish (undraft)
```

## 1. Show current version

Report both of these before asking anything:

- **`package.json` version**: `"version"` field — the last version bumped in the repo (may already be ahead of what's actually released).
- **Latest published release**: `git fetch --tags && git tag --list --sort=-v:refname | head -1` (also check `git ls-remote --tags origin` in case local tags are stale). If none exist, say so — this is the first release.

## 2. Confirm the new version

Suggest a semver bump from whichever of the two above is higher (default: patch bump). Use `AskQuestion` with options for the suggested patch bump, the suggested minor bump, and "Other" (custom version) — do not proceed until the user picks one.

## 3. Confirm release notes

Draft notes from commits since the last tag (`git log <last-tag>..HEAD --oneline`, or full history if there's no prior tag). Present the draft to the user and get explicit confirmation or edits before proceeding — release notes are user-facing, don't invent features that aren't in the log.

## 4. Preflight checks

Run all of these before touching `package.json`. Stop and report every failing check together (don't stop at the first one) so the user can fix them all in one pass:

- **Clean working tree**: `git status --porcelain` must be empty, and there must be no unpushed local commits the user hasn't acknowledged (`git status` "ahead of origin"). Packaging builds from the working directory, not git, but the GitHub release tag is created against the current commit — if the tree is dirty or unpushed, the tag won't reflect what's actually in the shipped binary. Stop and ask the user to commit/push or explicitly confirm they want to release with those changes.
- **Signing/publish env vars**: `GH_TOKEN`, `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` (electron-builder/`@electron/notarize` read these automatically). Missing any of these breaks auto-update for anyone on a properly signed prior version (see `src/main/auto-updater.ts`) — do not fall back to an unsigned build.
- **Quick Look extension build tooling** (`yarn release` chains `yarn build:quicklook`, which needs `xcodebuild`):
  - Full Xcode must be selected, not just Command Line Tools: `xcode-select -p` must NOT point at `.../CommandLineTools`, and `xcodebuild -version` must succeed. If Xcode.app isn't installed at all, this can't be fixed from the terminal — the user has to install it from the App Store themselves.
  - `xcodegen` must be on `PATH` (`which xcodegen`); install with `brew install xcodegen` if missing.
- **`gh` CLI installed and authenticated** (`which gh`, `gh auth status`) — needed for steps 8-9. Install with `brew install gh` then `gh auth login` if missing.
- **CI gates**: run `yarn lint`, `yarn typecheck`, `yarn test`. Stop and report failures rather than releasing on a red build.

## 5. Bump version

Edit `"version"` in `package.json` to the confirmed number from step 2. This is what `electron-updater` compares against, so it must change before packaging.

## 6. Commit and push the version bump

```bash
git commit -am "chore: bump version to vX.Y.Z"
git push
```

Do this before building — the release tag in step 7 is created against the current commit, so that commit must actually contain the version bump (and be on the remote, in case anyone needs to trace the tag back to source).

## 7. Build, sign, notarize, publish (draft)

Run:

```bash
GH_TOKEN=$GH_TOKEN yarn release
```

This runs `electron-builder --mac --publish always`, which builds, code-signs, notarizes, and uploads the `.dmg`/`.zip`/`latest-mac.yml` to a new **draft** GitHub Release tagged `vX.Y.Z` on `levi-putna/markdoc`. This step can take several minutes (notarization involves an Apple round-trip) — run it in the background and poll rather than blocking.

## 8. Set release notes

```bash
gh release edit vX.Y.Z --notes "<confirmed notes from step 3>"
```

(`gh` availability was already confirmed in step 4, so this should never be the first place a missing-`gh` failure surfaces.)

## 9. Confirm and publish (undraft)

Use `AskQuestion` to confirm the user is happy with the draft before flipping it live — never undraft without explicit confirmation:

```bash
gh release edit vX.Y.Z --draft=false
```

Report the final release URL. Existing installs pick it up on their next background check (every 4 hours) or immediately via **MarkDoc → Check for Updates…**.

## Hard rules

- Never skip the version-confirm or release-notes-confirm steps, even if the user says "just release it" — at minimum, state what you're about to do and give a beat for the user to object.
- Never force-push tags, delete existing releases, or undraft a release without explicit confirmation.
- Never release on top of failing lint/typecheck/test.
- If signed/notarized env vars are missing, stop rather than producing an ad-hoc/unsigned build — see "Signing consistency" in `README.md`.
