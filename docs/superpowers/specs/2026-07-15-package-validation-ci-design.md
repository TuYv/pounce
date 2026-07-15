# Pounce Package Validation CI Design

**Date:** 2026-07-15
**Status:** Approved in conversation on 2026-07-14

## Summary

Pounce will add a reproducible release-package validation layer around the existing `build.sh` workflow. Pull requests targeting `master` and pushes to `master` will build the same ZIP structure used for Chrome Web Store uploads, validate its contents and project metadata, and upload the verified ZIP as a GitHub Actions artifact for seven days.

The change must preserve `build.sh` as the only packaging entry point, introduce no package manager or third-party runtime dependency, and avoid automating Chrome Web Store publication.

## Goals

- Detect missing runtime files before a release reaches the Chrome Web Store.
- Verify that the generated ZIP has a valid root structure and contains every required manifest-referenced file.
- Prevent tests, repository automation, local state, and contributor-only files from entering the store package.
- Verify English and Simplified Chinese locale key and placeholder compatibility.
- Verify that the repository retains the deployed public privacy policy and its canonical URL.
- Produce a downloadable ZIP that corresponds exactly to the checked-out CI commit.
- Keep validation usable locally without `npm install`.
- Expose one stable GitHub status check named `Package validation` for later branch-ruleset enforcement.

## Non-goals

- Replacing `build.sh` with a new packager.
- Automatically publishing to the Chrome Web Store or creating GitHub Releases.
- Automatically changing the extension version, changelog, tags, or permissions.
- Adding npm, a bundler, a ZIP library, or any third-party validation dependency.
- Requiring the new check in the `master` ruleset before the workflow has merged and completed successfully on `master`.
- Changing Pounce product behavior or extension permissions.

## Existing Packaging Contract

`build.sh` remains the only command that creates release archives. It already:

- Uses an explicit packaged-file allowlist.
- Fails when a required packaged path is missing.
- Checks that files injected by `background.js` are included.
- Reads the version from `manifest.json` unless a version is passed explicitly.
- Requires matching version headings in both changelogs.
- Creates `pounce-<version>.zip` with extension files at the archive root.
- Creates a Git tag only when invoked without an explicit version argument.

CI must invoke `build.sh` with the manifest version as an explicit argument. This preserves all build checks while preventing CI from creating a local release tag.

As part of this change, the existing allowlist will move without semantic changes from the Bash array to `scripts/package-files.txt`. `build.sh` will read that file before performing its existing missing-path, injected-file, changelog, ZIP, retention, and optional-tag behavior. The validator will read the same file, making it the single machine-readable source of truth for both archive creation and archive verification.

## Components

### Shared package allowlist

Create `scripts/package-files.txt` containing the current `build.sh` packaged paths, one path per line. Blank lines and lines beginning with `#` are ignored.

`build.sh` will populate its existing `FILES` array from this file. The validator will use the same entries to require every listed file or directory in the finished archive. This covers runtime assets that are referenced by HTML or JavaScript rather than directly by `manifest.json`, including popup/options scripts and vendor code, without duplicating or heuristically parsing every source-language reference.

### Release validator

Create `scripts/validate-release.js` using only Node.js built-ins and the existing system `unzip` command. It will inspect the finished ZIP with `unzip -t`, `unzip -Z1`, and `unzip -p`, and support direct CLI use:

```sh
node scripts/validate-release.js pounce-1.6.1.zip
```

The module will expose focused functions for unit testing and run the complete validation when invoked as the main script.

The validator will check:

1. **Archive integrity and manifest structure**
   - `unzip -t` reports a structurally valid archive.
   - The validator reads `manifest.json` from the ZIP rather than from the working tree, and it parses successfully.
   - `manifest_version` is `3`.
   - `version` follows Chrome's numeric dotted-version format.
   - `default_locale` resolves to an existing locale directory.

2. **Complete packaged-file coverage**
   - Every entry in `scripts/package-files.txt` resolves to a file or directory prefix in the ZIP.
   - Every non-directory ZIP entry is covered by the shared allowlist; unexpected files fail validation even if they are not on the explicit forbidden-path list.
   - A missing non-manifest runtime asset, such as an options/popup script or vendor file, fails validation just as a missing manifest-referenced file does.

3. **Manifest-referenced package files and localization keys**
   - The background service worker, action popup, options page, icons, and concrete web-accessible resources exist in the ZIP.
   - Wildcard web-accessible resources resolve to at least one packaged file when they refer to project files.
   - Chrome's built-in `_favicon/*` resource namespace is treated as a browser-provided special case and does not require a physical `_favicon` directory.
   - Every `__MSG_key__` reference in the archived manifest resolves in the archived default locale. Because locale key parity is also required, the same key must consequently exist in both locales.

4. **Archive layout**
   - `manifest.json` is at the archive root rather than inside a parent folder.
   - Archive entries use relative paths and contain no parent traversal.
   - Required runtime directories and files are present.
   - Forbidden development paths are absent, including `.git/`, `.github/`, `.devstate/`, `tests/`, `docs/`, `node_modules/`, `notes/`, and local design/tool directories.
   - Contributor and build-only root files such as `AGENTS.md`, `CONTRIBUTING.md`, `build.sh`, and repository README/changelog files are absent.

5. **Locale compatibility**
   - The validator reads `_locales/en/messages.json` and `_locales/zh_CN/messages.json` from the ZIP rather than from the working tree, and both parse successfully.
   - Both locale files contain the same message keys.
   - Matching messages define the same placeholder names.
   - Matching placeholders use compatible `content` definitions.
   - Every declared placeholder is referenced by its exact `$name$` token in the corresponding message, and every named message token has a declaration. This catches regressions such as replacing `$search$` and `$batch$` with escaped dollar signs while leaving the placeholder definitions unchanged.

6. **Privacy policy source**
   - `docs/privacy.html` exists in the repository and is intentionally excluded from the extension ZIP.
   - `README.md` contains the canonical hosted policy URL: `https://tuyv.github.io/pounce/privacy.html`.

Repository-source reads are limited to `scripts/package-files.txt` and the privacy-policy source checks. Manifest, locale, and runtime package validation must use the actual ZIP contents.

Validation failures must identify the failing category and list the specific missing, forbidden, or incompatible paths or keys.

### Automated tests

Create `tests/package-validation.test.js` using `node:test` and `node:assert/strict`. Focused unit tests will exercise exported validator functions with temporary directories and synthetic archive-entry lists. Integration tests will create small real ZIP fixtures with the system `zip` command and invoke the validator CLI as a child process, proving that the command-line entry point runs the complete validation path and returns the correct exit status.

Coverage will include:

- A valid manifest, archive list, locale pair, and privacy-policy source.
- A missing manifest-referenced runtime file.
- A missing allowlisted non-manifest runtime file.
- A ZIP nested under an unexpected parent directory.
- A forbidden development path in the archive.
- Locale key mismatch.
- Locale placeholder-name, placeholder-content, or message-token mismatch, including escaped or missing `$name$` tokens.
- A manifest `__MSG_key__` with no archived locale definition.
- A missing or incorrect canonical privacy-policy URL.
- The `_favicon/*` special case.
- A real invalid ZIP fixture whose CLI process exits nonzero with a specific error.

The complete existing test suite remains `node --test tests/*.test.js` and must pass on Node.js 22 and 24 through the existing workflow.

### GitHub Actions workflow

Create `.github/workflows/package.yml` with these triggers:

- `pull_request` targeting `master`.
- `push` to `master`.

The workflow will use read-only repository permissions and one job with the stable job name `Package validation`. The job will:

1. Check out the exact GitHub Actions commit.
2. Set up Node.js 24.
3. Read the version from `manifest.json`.
4. Run `./build.sh <version>` to avoid tag creation.
5. Run `node scripts/validate-release.js pounce-<version>.zip`.
6. Upload `pounce-<version>.zip` with an artifact name containing the workflow commit SHA.
7. Retain the artifact for seven days and fail if the ZIP is missing.

The workflow will not run on arbitrary branch pushes, releases, schedules, or manual publication events.

## Data Flow

```text
checked-out commit
      |
      v
build.sh shared allowlist and existing guards
      |
      v
pounce-<version>.zip
      |
      +--> validate archive integrity, shared allowlist and manifest references
      +--> read and validate manifest/locales from inside the ZIP
      +--> validate hosted privacy-policy source and link
      |
      v
7-day GitHub Actions artifact
```

The artifact is evidence of the exact package that passed validation. It is not a signed release and is not automatically submitted to any store.

## Failure Handling

- If `build.sh` fails, the workflow stops and preserves its existing actionable error output.
- If `zip` or `unzip` is unavailable, validation fails with a clear tool-missing error rather than silently skipping archive checks.
- If the shared allowlist or manifest refers to a missing file, validation prints every missing path before exiting nonzero.
- If locale keys or placeholders differ, validation prints the affected message keys and both definitions.
- If a forbidden path appears, validation prints the complete offending archive entries.
- Artifact upload runs only after build and validation succeed.
- No failure path creates tags, releases, store submissions, or commits.

## Security and Privacy

- Workflow permissions remain `contents: read`.
- No secrets, store credentials, or deployment tokens are used.
- Fork workflow runs follow the repository's configured GitHub Actions approval policy. The package job remains safe for untrusted code because it receives read-only repository permission and no secrets.
- The artifact contains only already-public extension source files selected by `build.sh`.
- The validator does not print private environment data or inspect browser profiles.

## Branch Ruleset Sequence

The current `Protect master` ruleset continues to require only `Node.js 22 tests` and `Node.js 24 tests` while this Draft PR is under review.

After the PR is merged:

1. Confirm `Package validation` succeeds on the resulting `master` commit.
2. Update ruleset `18852815` to require the exact `Package validation` status context.
3. Re-read the effective rules for `master` and confirm all three checks are active.

This ordering prevents a required-check deadlock before GitHub has observed the new check context.

## Delivery Workflow

1. Commit this design document on branch `ci/package-validation`.
2. Obtain user approval of the written specification.
3. Write and commit a detailed TDD implementation plan.
4. Implement validator tests first and verify each intended failure.
5. Implement the minimum validator behavior needed to pass.
6. Add the workflow and documentation changes.
7. Run the complete tests, real package build, validator, YAML checks, and `git diff --check`.
8. Perform independent specification and quality reviews.
9. Push the branch and open a Draft PR against `master`.
10. Do not mark ready or merge without explicit user approval.

## Acceptance Criteria

- `node --test tests/*.test.js` passes locally with the new package-validation tests.
- `./build.sh "$(node -p "require('./manifest.json').version")"` creates the expected ZIP without creating a tag.
- `build.sh` and the validator both consume `scripts/package-files.txt`, whose initial paths are semantically identical to the current Bash allowlist.
- The validator reads the manifest and locales from the real ZIP, accepts the valid package, and rejects tested integrity, allowlist, manifest-reference, missing `__MSG_key__`, forbidden-path, locale, placeholder, archive-root, and privacy-link failures.
- At least one real invalid ZIP fixture causes the validator CLI process to exit nonzero for the expected reason.
- `.github/workflows/package.yml` is valid YAML, uses read-only permissions, and exposes the check name `Package validation`.
- A PR run uploads one ZIP artifact retained for seven days.
- The workflow also succeeds after merge on `master`.
- Only after successful merge verification is `Package validation` added to the active `master` ruleset.
- The Draft PR contains no product behavior, manifest permission, store publication, or unrelated refactoring changes.
