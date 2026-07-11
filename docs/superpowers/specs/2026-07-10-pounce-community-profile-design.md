# Pounce Community Readiness and GitHub Profile Design

**Date:** 2026-07-10
**Status:** Approved on 2026-07-10 via merged PR #9
**Implementation amendment:** During PR #10, the CI matrix was corrected from Node.js 20/22 to 22/24 after verifying the [official Node.js release schedule](https://github.com/nodejs/Release/blob/main/schedule.json) showed Node.js 20 is end-of-life. This implementation amendment was not part of PR #9's design approval.

## Summary

This change will make Pounce easier for real external contributors to understand, test, and improve, while presenting TuYv's verified open-source work clearly on GitHub. It covers two repositories:

1. `TuYv/pounce`, updated through a feature branch and pull request.
2. A new `TuYv/TuYv` profile repository, initially kept private so its full README can be reviewed in a pull request before it becomes public.

The work must improve genuine community readiness. It must not manufacture activity, overstate project impact, expose private contact details, or describe open pull requests as completed contributions.

## Goals

- Give prospective contributors a clear path from idea or bug report to an accepted pull request.
- Add automated verification for the existing Node.js test suite without introducing a package manager or third-party runtime dependency.
- Make security reporting, project scope, and maintainer expectations explicit.
- Invite carefully scoped community improvements while keeping maintainer commitments conservative.
- Present TuYv as an open-source maintainer and contributor using only publicly verifiable evidence.
- Deliver repository content changes through pull requests for review before merge.

## Non-goals

- Promising active development of every proposed feature.
- Creating artificial contributor activity, placeholder issues, or trivial pull requests.
- Adding analytics, visitor counters, third-party GitHub statistics widgets, or contribution animations.
- Publishing an email address or other personal contact information.
- Claiming contribution to `nexu-io/open-design` without a verifiable pull request under the `TuYv` account.
- Adding a package manager, bundler, coverage service, or release automation solely for presentation.
- Changing Pounce product behavior as part of this work.

## Pounce Repository Design

### Community documentation

Add the following root-level files:

- `CONTRIBUTING.md`
  - Explain how to load the unpacked extension in Chrome or Edge.
  - Document the test command: `node --test tests/*.test.js`.
  - Summarize the existing plain HTML, CSS, and JavaScript conventions.
  - Require an issue or discussion before large features, permission changes, or architectural changes.
  - Explain expectations for focused commits, screenshots for UI changes, localization updates, and browser-permission justification.
  - State that the maintainer is deliberately conservative about scope but welcomes discussed, well-scoped community improvements.

- `SECURITY.md`
  - Ask reporters not to disclose vulnerabilities in public issues.
  - Direct reports to GitHub private vulnerability reporting.
  - Define the currently supported release as the latest Chrome Web Store version.
  - Avoid promising a fixed response or remediation timeline.

- `CODE_OF_CONDUCT.md`
  - Use Contributor Covenant 2.1.
  - Direct sensitive enforcement reports to GitHub private vulnerability reporting with a clear `[Conduct]` prefix, providing a private channel without publishing an email address.

### Issue and pull request intake

Replace the current combined Markdown issue template with GitHub Issue Forms:

- `bug_report.yml`
  - Browser, Pounce version, operating system, reproduction steps, expected behavior, actual behavior, and optional screenshots.
- `feature_request.yml`
  - Problem, proposed outcome, alternatives, scope, and willingness to contribute.
  - Explain that proposals may be declined to keep Pounce focused.
- `config.yml`
  - Link security reports to the repository security policy.
  - Link open-ended design questions to GitHub Discussions after Discussions is enabled.
  - Keep blank issues disabled so reports use the appropriate path.

Add `.github/pull_request_template.md` requiring:

- A concise summary and linked issue or discussion.
- Test command output and manual browser checks.
- Screenshots or GIFs for visible UI changes.
- An explicit declaration of manifest or permission changes.
- Documentation and localization updates where applicable.

### Continuous integration

Add `.github/workflows/test.yml` with the following behavior:

- Trigger on pull requests and pushes to `master`.
- Run on Ubuntu with active Node.js LTS versions 22 and 24.
- Check out the repository and run `node --test tests/*.test.js` directly.
- Use no npm install step because the test workflow has no npm dependencies.
- Keep job and check names stable so branch protection can adopt them later if desired.

The existing `AGENTS.md` testing section must be corrected because the repository now contains automated tests even though it has no package manager.

### README changes

Update both `README.md` and `README.zh-CN.md` with equivalent sections:

- **Community / 社区**: link Issues and Discussions and describe the conservative-but-welcoming maintenance model.
- **Contributing / 参与贡献**: link `CONTRIBUTING.md` and highlight good first issues.
- **Roadmap / 路线图**: describe categories rather than promise dates: accessibility, test coverage, localization, and browser compatibility.
- **Security / 安全**: link `SECURITY.md` and warn against public vulnerability reports.

Existing dynamic Chrome Web Store user, rating, version, GitHub star, and license badges remain. No user count or star count will be hard-coded into prose.

### Publication sequence and repository settings

Publish the Pounce changes in this order:

1. Obtain explicit user approval.
2. Before merging, enable and verify GitHub Discussions and private vulnerability reporting.
3. Merge the content pull request.
4. After the merge, set focused repository topics and create accurate labels and seed issues.

The live-settings step must:

- Verify GitHub Discussions is enabled.
- Verify private vulnerability reporting is enabled.
- Keep Issues enabled.
- Do not enable settings that require paid features or change repository visibility.

Post-merge topics should include `chrome-extension`, `browser-extension`, `productivity`, `keyboard-first`, `local-first`, `javascript`, and `open-source`.

### Seed contribution opportunities

After the content pull request is merged and its links are live, create a small set of actionable issues. Each issue must describe acceptance criteria and an appropriate verification method. Initial candidates are:

1. Add focused tests for an under-tested search or preference edge case.
2. Audit keyboard navigation and document reproducible accessibility gaps.
3. Improve contributor documentation for loading and debugging the unpacked extension.
4. Review English and Simplified Chinese strings for missing or inconsistent localization.
5. Document and test Edge compatibility using the existing Chromium extension.

Use labels such as `good first issue`, `help wanted`, `documentation`, `testing`, `accessibility`, and `localization` only when they accurately describe the issue. Do not create an issue merely to increase issue count.

## GitHub Profile Repository Design

### Delivery workflow

Create `TuYv/TuYv` as a private repository with a minimal base commit. Create a feature branch containing the complete profile README and open a pull request against the default branch. After the user reviews and approves the pull request:

1. Merge the pull request.
2. Change the repository visibility to public.
3. Confirm that the README appears on `github.com/TuYv`.

This avoids displaying an unfinished profile while preserving pull-request review.

### Profile content

The README will be English-first with a short Chinese introduction. It will contain:

- A concise introduction using the name `Tu Yu / 涂瑜` and GitHub handle `TuYv`.
- A positioning statement focused on open-source maintenance, browser productivity, and developer tooling.
- A short Chinese paragraph expressing the same positioning without duplicating the entire document.
- A **Featured Projects** section:
  - `TuYv/pounce`: privacy-first, keyboard-driven browser search; include links to the repository and Chrome Web Store plus dynamic user and star badges.
  - `TuYv/ccpm`: Claude Code preset management tooling.
  - `TuYv/CodePlanGUI`: IDE-oriented developer tooling.
- A **Selected Open Source Contributions** section containing only verified merged external pull requests:
  - `farion1231/cc-switch` pull requests [#2184](https://github.com/farion1231/cc-switch/pull/2184), [#2211](https://github.com/farion1231/cc-switch/pull/2211), and [#2420](https://github.com/farion1231/cc-switch/pull/2420).
  - `nexu-io/html-anything` pull request [#93](https://github.com/nexu-io/html-anything/pull/93).
- A **Current Focus** section covering Pounce maintenance, contributor onboarding, testing, accessibility, localization, and browser compatibility.
- An **Open Source & Collaboration** section directing contact to project Issues and Discussions.

The profile will not call TuYv a core contributor to these external projects and will not list open or closed-unmerged pull requests as completed work.

### Presentation constraints

- Use accessible Markdown with a simple reading order.
- Keep decorative badges limited to useful live project facts.
- Avoid giant technology badge walls, GitHub statistics cards, visitor counters, trophy widgets, and generated contribution animations.
- Do not publish the GitHub profile email address.
- Keep claims durable and easy to verify from linked repositories and pull requests.

## Verification

Before opening the implementation pull requests:

- Run `node --test tests/*.test.js` locally and record the result in the Pounce pull request.
- Validate GitHub Actions and Issue Form YAML syntax.
- Check every new relative link against the final repository paths.
- Review English and Chinese README sections for equivalent meaning.
- Confirm no text contains a hard-coded store-user count, star count, unsupported title, private email address, or unverified project contribution.
- Preview the profile README as rendered Markdown before opening its pull request.

After pull requests are opened:

- Wait for Pounce CI to pass before marking the pull request ready for merge.
- Confirm both pull requests contain only the intended files.
- Do not merge either pull request until the user explicitly approves it.

## Failure Handling

- If a required pre-merge repository setting cannot be enabled through the GitHub API, leave repository content intact, report the exact manual setting required, and do not merge while the gate is unmet.
- If private vulnerability reporting is unavailable, keep `SECURITY.md`, do not claim the private form is enabled, and stop before merge for user direction.
- If any existing test fails before the change, stop and report the baseline failure rather than weakening or deleting the test.
- If a proposed seed issue cannot be made concrete, omit it instead of publishing a vague placeholder.
- If profile-repository visibility prevents pull-request review, keep it private and provide the pull request URL; do not publish the unfinished README.

## Delivery Boundaries

- The design document is committed first for review.
- Implementation begins only after this design is approved.
- Pounce content changes and the GitHub profile README use separate pull requests.
- Pounce Discussions and private vulnerability reporting are enabled and verified only after explicit user approval and before merge.
- Pounce topics, labels, and seed issues are added only after the corresponding content is merged and links are valid.
- No pull request is merged without explicit user approval.
