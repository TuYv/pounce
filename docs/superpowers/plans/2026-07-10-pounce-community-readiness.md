# Pounce Community Readiness Implementation Plan

> **Status:** Execution record (non-normative). The design spec and final repository files are authoritative.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Pounce straightforward for genuine external contributors to report problems, discuss scoped improvements, run tests, submit pull requests, and report security issues.

**Architecture:** Keep Pounce free of a package-manager install step and add only repository-native community files, GitHub Issue Forms, and a GitHub Actions workflow that runs the existing Node.js test suite. Content changes land through one pull request. After explicit user approval, enable and verify Discussions and private vulnerability reporting before merging; after merge, add topics, labels, and seed issues.

**Tech Stack:** Markdown, GitHub Issue Forms YAML, GitHub Actions YAML, Node.js built-in test runner, GitHub CLI

---

## File Map

- Create `CONTRIBUTING.md`: contributor workflow, local setup, testing, coding conventions, and scope policy.
- Create `SECURITY.md`: supported version and private reporting instructions.
- Create `CODE_OF_CONDUCT.md`: Contributor Covenant 2.1 with a private GitHub reporting channel.
- Delete `.github/ISSUE_TEMPLATE/issue.md`: remove the combined legacy issue template.
- Create `.github/ISSUE_TEMPLATE/bug_report.yml`: structured bug reports.
- Create `.github/ISSUE_TEMPLATE/feature_request.yml`: problem-focused enhancement proposals.
- Create `.github/ISSUE_TEMPLATE/config.yml`: security and discussion links; disable blank issues.
- Create `.github/pull_request_template.md`: PR evidence and permission checklist.
- Create `.github/workflows/test.yml`: Node.js 22/24 test matrix.
- Modify `AGENTS.md`: document the actual automated test suite and commit guidance reflected in repository history.
- Modify `README.md`: add community, contribution, roadmap, and security entry points.
- Modify `README.zh-CN.md`: add equivalent Chinese entry points.
- Modify `docs/superpowers/specs/2026-07-10-pounce-community-profile-design.md`: mark the reviewed design approved.

### Task 1: Record Design Approval and Baseline

**Files:**
- Modify: `docs/superpowers/specs/2026-07-10-pounce-community-profile-design.md:4`

- [ ] **Step 1: Confirm the implementation branch starts from merged PR #9**

Run:

```bash
git log -1 --oneline
git status --short --branch
```

Expected: `master` history contains merge commit `34d3ef3` or a descendant, and the implementation branch is clean before edits.

- [ ] **Step 2: Run the existing test suite**

Run:

```bash
node --test tests/*.test.js
```

Expected: `tests 128`, `pass 128`, `fail 0`.

- [ ] **Step 3: Record the design approval and implementation amendment separately**

Apply:

```diff
-**Status:** Pending user review
+**Status:** Approved on 2026-07-10 via merged PR #9
+**Implementation amendment:** During PR #10, the CI matrix was corrected from Node.js 20/22 to 22/24 after verifying the [official Node.js release schedule](https://github.com/nodejs/Release/blob/main/schedule.json) showed Node.js 20 is end-of-life. This implementation amendment was not part of PR #9's design approval.
```

- [ ] **Step 4: Commit the approval record with the implementation plans**

Run after both plan files exist:

```bash
git add docs/superpowers/specs/2026-07-10-pounce-community-profile-design.md docs/superpowers/plans/
git commit -m "docs: add community readiness implementation plans"
```

Expected: one documentation commit containing the approved status and both implementation plans.

### Task 2: Add Contributor and Security Documentation

**Files:**
- Create: `CONTRIBUTING.md`
- Create: `SECURITY.md`
- Create: `CODE_OF_CONDUCT.md`

- [ ] **Step 1: Create `CONTRIBUTING.md`**

Use this complete content:

```markdown
# Contributing to Pounce

Thanks for helping improve Pounce. The project is intentionally conservative about scope, but well-scoped fixes and improvements are welcome.

## Before you start

- Search existing Issues and Discussions first.
- Open an Issue or Discussion before large features, architecture changes, or changes to `manifest.json` permissions.
- Keep pull requests focused on one problem.
- Do not include browsing data, private URLs, credentials, or other personal information in reports or screenshots.

## Local development

Pounce requires no package-manager install step and is built with plain HTML, CSS, and JavaScript.

1. Clone the repository.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable Developer Mode.
4. Choose **Load unpacked** and select the repository directory.
5. Reload the extension after each change.

You can preview `popup.html` and `options.html` directly in a browser. The popup includes a mock `chrome` fallback for local previews.

## Automated tests

Pounce uses Node.js's built-in test runner and has no npm dependencies:

```bash
node --test tests/*.test.js
```

Run the full suite before opening a pull request.

## Manual checks

For behavior changes, verify the affected flows in an unpacked extension. Depending on the change, check:

- Search launch with `Command+K` on macOS or `Alt+K` on Windows/Linux.
- Keyboard navigation, result selection, and Escape handling.
- Popup actions and settings persistence.
- Light, dark, and system theme behavior.
- Restricted pages such as `chrome://` fail gracefully.
- Both English and Simplified Chinese UI text where applicable.

## Code style

- Use 2-space indentation and semicolons.
- Use `camelCase` for variables and functions and `PascalCase` for classes.
- Keep shared module filenames descriptive and kebab-cased.
- Reuse existing helpers instead of duplicating behavior.
- Keep browser permissions minimal and justify every permission change.

## Pull requests

A pull request should include:

- A concise summary and linked Issue or Discussion.
- Automated test results and relevant manual checks.
- Screenshots or GIFs for visible UI changes.
- Documentation and localization changes when user-facing behavior changes.
- A clear statement about whether `manifest.json` or browser permissions changed.

Maintainers may decline changes that add broad scope, duplicate existing behavior, or increase permissions without enough user benefit.
```

- [ ] **Step 2: Create `SECURITY.md`**

Use this complete content:

```markdown
# Security Policy

## Supported version

Security fixes are applied to the latest version available from the Chrome Web Store. Older releases are not maintained separately.

## Reporting a vulnerability

Please do not disclose security vulnerabilities in public Issues or Discussions.

Use GitHub's **Report a vulnerability** flow in the repository Security tab. Include:

- The affected Pounce version and browser.
- Reproduction steps or a minimal proof of concept.
- The expected security boundary and observed behavior.
- Any suggested mitigation, if known.

Avoid including real browsing history, private URLs, credentials, or personal data. The maintainer will review the report and respond as availability permits; no fixed response or remediation timeline is promised.
```

- [ ] **Step 3: Create `CODE_OF_CONDUCT.md`**

Use this complete content:

```markdown
# Contributor Covenant Code of Conduct

## Our Pledge

We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone, regardless of age, body size, visible or invisible disability, ethnicity, sex characteristics, gender identity and expression, level of experience, education, socio-economic status, nationality, personal appearance, race, caste, color, religion, or sexual identity and orientation.

We pledge to act and interact in ways that contribute to an open, welcoming, diverse, inclusive, and healthy community.

## Our Standards

Examples of behavior that contributes to a positive environment for our community include:

* Demonstrating empathy and kindness toward other people
* Being respectful of differing opinions, viewpoints, and experiences
* Giving and gracefully accepting constructive feedback
* Accepting responsibility and apologizing to those affected by our mistakes, and learning from the experience
* Focusing on what is best not just for us as individuals, but for the overall community

Examples of unacceptable behavior include:

* The use of sexualized language or imagery, and sexual attention or advances of any kind
* Trolling, insulting or derogatory comments, and personal or political attacks
* Public or private harassment
* Publishing others' private information, such as a physical or email address, without their explicit permission
* Other conduct which could reasonably be considered inappropriate in a professional setting

## Enforcement Responsibilities

Community leaders are responsible for clarifying and enforcing our standards of acceptable behavior and will take appropriate and fair corrective action in response to any behavior that they deem inappropriate, threatening, offensive, or harmful.

Community leaders have the right and responsibility to remove, edit, or reject comments, commits, code, wiki edits, issues, and other contributions that are not aligned to this Code of Conduct, and will communicate reasons for moderation decisions when appropriate.

## Scope

This Code of Conduct applies within all community spaces, and also applies when an individual is officially representing the community in public spaces. Examples of representing our community include using an official email address, posting via an official social media account, or acting as an appointed representative at an online or offline event.

## Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be reported privately through the repository's **Report a vulnerability** form. Prefix the report title with `[Conduct]`. All complaints will be reviewed and investigated promptly and fairly to the extent maintainer availability permits.

Community leaders are obligated to respect the privacy and security of the reporter of any incident.

## Enforcement Guidelines

Community leaders will follow these Community Impact Guidelines in determining the consequences for any action they deem in violation of this Code of Conduct:

### 1. Correction

**Community Impact**: Use of inappropriate language or other behavior deemed unprofessional or unwelcome in the community.

**Consequence**: A private, written warning from community leaders, providing clarity around the nature of the violation and an explanation of why the behavior was inappropriate. A public apology may be requested.

### 2. Warning

**Community Impact**: A violation through a single incident or series of actions.

**Consequence**: A warning with consequences for continued behavior. No interaction with the people involved, including unsolicited interaction with those enforcing the Code of Conduct, for a specified period of time. This includes avoiding interactions in community spaces as well as external channels like social media. Violating these terms may lead to a temporary or permanent ban.

### 3. Temporary Ban

**Community Impact**: A serious violation of community standards, including sustained inappropriate behavior.

**Consequence**: A temporary ban from any sort of interaction or public communication with the community for a specified period of time. No public or private interaction with the people involved, including unsolicited interaction with those enforcing the Code of Conduct, is allowed during this period. Violating these terms may lead to a permanent ban.

### 4. Permanent Ban

**Community Impact**: Demonstrating a pattern of violation of community standards, including sustained inappropriate behavior, harassment of an individual, or aggression toward or disparagement of classes of individuals.

**Consequence**: A permanent ban from any sort of public interaction within the community.

## Attribution

This Code of Conduct is adapted from the [Contributor Covenant][homepage], version 2.1, available at [https://www.contributor-covenant.org/version/2/1/code_of_conduct.html][v2.1].

Community Impact Guidelines were inspired by [Mozilla's code of conduct enforcement ladder][Mozilla CoC].

For answers to common questions about this code of conduct, see the FAQ at [https://www.contributor-covenant.org/faq][FAQ]. Translations are available at [https://www.contributor-covenant.org/translations][translations].

[homepage]: https://www.contributor-covenant.org
[v2.1]: https://www.contributor-covenant.org/version/2/1/code_of_conduct.html
[Mozilla CoC]: https://github.com/mozilla/diversity
[FAQ]: https://www.contributor-covenant.org/faq
[translations]: https://www.contributor-covenant.org/translations
```

- [ ] **Step 4: Verify the documentation has no public email or unsupported promise**

Run:

```bash
rg -n '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[A-Za-z]{2,}|guarantee|within [0-9]+ (hours|days)' CONTRIBUTING.md SECURITY.md CODE_OF_CONDUCT.md
```

Expected: no matches.

- [ ] **Step 5: Commit the community policies**

Run:

```bash
git add CONTRIBUTING.md SECURITY.md CODE_OF_CONDUCT.md
git commit -m "docs: add contribution and security policies"
```

### Task 3: Replace Issue and Pull Request Templates

**Files:**
- Delete: `.github/ISSUE_TEMPLATE/issue.md`
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/feature_request.yml`
- Create: `.github/ISSUE_TEMPLATE/config.yml`
- Create: `.github/pull_request_template.md`

- [ ] **Step 1: Remove the legacy combined template**

Run through `apply_patch`:

```diff
*** Delete File: .github/ISSUE_TEMPLATE/issue.md
```

- [ ] **Step 2: Create `.github/ISSUE_TEMPLATE/bug_report.yml`**

Use this complete content:

```yaml
name: Bug report
description: Report a reproducible problem in Pounce.
title: "[Bug]: "
labels:
  - bug
body:
  - type: markdown
    attributes:
      value: |
        Thanks for helping improve Pounce.

        Reports may be submitted in English or 中文.

        **Privacy and security:** Remove personal or sensitive information, including private URLs, browsing history, credentials, and access tokens, from logs, screenshots, and recordings. If this may be a security vulnerability, report it privately through [GitHub Security Advisories](https://github.com/TuYv/pounce/security/advisories/new) instead of opening a public Issue.

  - type: input
    id: pounce-version
    attributes:
      label: Pounce version
      description: Find the version on the extension details page or in `manifest.json`.
      placeholder: e.g. 1.2.3
    validations:
      required: true

  - type: dropdown
    id: browser
    attributes:
      label: Browser
      options:
        - Chrome
        - Microsoft Edge
        - Other Chromium browser
    validations:
      required: true

  - type: input
    id: browser-version
    attributes:
      label: Browser version
      placeholder: e.g. 126.0.6478.127
    validations:
      required: true

  - type: input
    id: operating-system
    attributes:
      label: Operating system
      placeholder: e.g. Windows 11, macOS 15, or Ubuntu 24.04
    validations:
      required: true

  - type: textarea
    id: problem
    attributes:
      label: Problem
      description: What happened? Include any error messages and relevant context.
    validations:
      required: true

  - type: textarea
    id: steps-to-reproduce
    attributes:
      label: Steps to reproduce
      description: Provide the smallest reliable sequence that triggers the problem.
      placeholder: |
        1. Go to ...
        2. Click ...
        3. Observe ...
    validations:
      required: true

  - type: textarea
    id: expected-behavior
    attributes:
      label: Expected behavior
      description: What did you expect Pounce to do?
    validations:
      required: true

  - type: textarea
    id: screenshots-or-recordings
    attributes:
      label: Screenshots or recordings
      description: Optional. Drag files here if they help explain the problem. Remove personal or sensitive information, including private URLs, browsing history, credentials, and access tokens, before uploading.

  - type: checkboxes
    id: confirmation
    attributes:
      label: Confirmation
      options:
        - label: I searched existing Issues and Discussions for similar reports.
          required: true
        - label: This report is not about a security vulnerability.
          required: true
```

- [ ] **Step 3: Create `.github/ISSUE_TEMPLATE/feature_request.yml`**

Use this complete content:

```yaml
name: Feature or improvement
description: Propose a focused improvement to Pounce.
title: "[Idea]: "
labels:
  - enhancement
body:
  - type: markdown
    attributes:
      value: |
        Pounce is conservatively maintained. Ideas may be declined to keep the project's scope and permissions focused.

        Proposals may be submitted in English or 中文.

  - type: textarea
    id: problem-or-limitation
    attributes:
      label: Problem or limitation
      description: What problem are you trying to solve, and who encounters it?
    validations:
      required: true

  - type: textarea
    id: desired-outcome
    attributes:
      label: Desired outcome
      description: Describe the result you want, without assuming a particular implementation.
    validations:
      required: true

  - type: textarea
    id: proposed-approach
    attributes:
      label: Proposed approach
      description: Explain a focused way Pounce could address the problem, including alternatives you considered.
    validations:
      required: true

  - type: textarea
    id: scope-and-non-goals
    attributes:
      label: Scope and non-goals
      description: What does this proposal include, and what does it intentionally exclude?
    validations:
      required: true

  - type: dropdown
    id: permissions
    attributes:
      label: Would this require new browser permissions?
      options:
        - "No"
        - Unsure
        - "Yes"
    validations:
      required: true

  - type: dropdown
    id: willingness
    attributes:
      label: Would you be willing to contribute this change?
      options:
        - "Yes"
        - Maybe with guidance
        - "No"
    validations:
      required: true

  - type: checkboxes
    id: confirmation
    attributes:
      label: Confirmation
      options:
        - label: I searched existing Issues and Discussions for similar ideas.
          required: true
```

- [ ] **Step 4: Create `.github/ISSUE_TEMPLATE/config.yml`**

Use this complete content:

```yaml
blank_issues_enabled: false
contact_links:
  - name: Design question or early idea
    url: https://github.com/TuYv/pounce/discussions
    about: Discuss an idea before turning it into a scoped feature request.
  - name: Security vulnerability
    url: https://github.com/TuYv/pounce/security/policy
    about: Report vulnerabilities privately. Do not open a public Issue.
```

- [ ] **Step 5: Create `.github/pull_request_template.md`**

Use this complete content:

```markdown
## Summary

<!-- Concisely describe the problem and how this change addresses it. -->

## Related work

<!-- Link an Issue or Discussion; enter N/A if none. Use `Closes #...` when appropriate. -->

Related Issue or Discussion:

## Verification

- [ ] `node --test tests/*.test.js` passes locally.
- [ ] I completed the relevant manual browser checks in Chrome or Microsoft Edge.
- [ ] I added or updated tests where practical.

Automated test output:

<!-- Paste or summarize the automated test command and result, including pass/fail counts. -->

Manual check results:

<!-- List the browsers, operating systems, flows checked, and results; enter N/A with a reason when no browser check applies. -->

## User-facing changes

- [ ] I described the user-facing impact below and attached screenshots/GIFs for visible UI changes.
- [ ] I updated both English and Simplified Chinese user-facing text where applicable.

User-facing impact:

## Manifest and permissions

- [ ] I declared manifest and browser-permission impact below.

Impact: Unchanged / Changed — explanation:

## Scope

- [ ] This change is focused and avoids unrelated refactors.
- [ ] I updated relevant documentation where needed.

<!-- Note any intentionally deferred or out-of-scope work. -->
```

- [ ] **Step 6: Validate YAML syntax**

Run:

```bash
ruby -e 'require "yaml"; ARGV.each { |f| YAML.load_file(f); puts "OK #{f}" }' .github/ISSUE_TEMPLATE/*.yml
```

Expected: one `OK` line for each YAML file and exit code 0.

- [ ] **Step 7: Commit the GitHub templates**

Run:

```bash
git add .github/ISSUE_TEMPLATE .github/pull_request_template.md
git commit -m "chore: add structured contribution templates"
```

### Task 4: Add CI Without an npm Install Step and Correct Repository Guidance

**Files:**
- Create: `.github/workflows/test.yml`
- Modify: `AGENTS.md`

- [ ] **Step 1: Create `.github/workflows/test.yml`**

Use this complete content:

```yaml
name: Tests

on:
  push:
    branches:
      - master
  pull_request:
    branches:
      - master

permissions:
  contents: read

jobs:
  node-tests:
    name: Node.js ${{ matrix.node-version }} tests
    runs-on: ubuntu-latest
    timeout-minutes: 5
    strategy:
      fail-fast: false
      matrix:
        node-version:
          - 22
          - 24
    steps:
      - name: Check out repository
        uses: actions/checkout@v4
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - name: Run tests
        run: node --test tests/*.test.js
```

- [ ] **Step 2: Replace the outdated `AGENTS.md` testing section**

Replace the complete existing `## Testing Guidelines` section, stopping before `## Commit & Pull Request Guidelines`, with:

````markdown
## Testing Guidelines
Pounce uses Node.js's built-in test runner and has no npm dependencies. Run the full automated test suite with:

```sh
node --test tests/*.test.js
```

Add focused regression tests under `tests/` for shared JavaScript behavior. Manual browser checks remain required for extension integration and UI changes:

- Verify URL add/remove/save flows in `options.html`.
- Verify popup actions, especially “Open All” and search launch.
- Verify the overlay on a normal web page with `Alt+K` or `Command+K`.
- Re-check theme switching across popup, options, and overlay.
- Confirm restricted pages fail gracefully.
````

- [ ] **Step 3: Correct the commit guidance**

Replace the existing paragraph under `## Commit & Pull Request Guidelines` with:

```markdown
Follow the existing history's short, scoped commit subjects, such as `docs: ...` and `ci: ...`. Keep commits focused and use an imperative description after the scope. PRs should include a brief summary, manual test steps, linked issue or task if applicable, and screenshots or GIFs for popup, options, or overlay UI changes.
```

- [ ] **Step 4: Run the full test suite**

Run:

```bash
node --test tests/*.test.js
```

Expected: 128 tests pass and 0 fail.

- [ ] **Step 5: Commit CI and guidance**

Run:

```bash
git add .github/workflows/test.yml AGENTS.md
git commit -m "ci: run tests on supported Node versions"
```

### Task 5: Add Community Entry Points to Both READMEs

**Files:**
- Modify: `README.md`
- Modify: `README.zh-CN.md`

- [ ] **Step 1: Add the English sections before `## License`**

Insert:

```markdown
## Community

Pounce is maintained conservatively to keep it fast, private, and focused. Bug fixes and well-scoped improvements are welcome. Use [Issues](https://github.com/TuYv/pounce/issues) for reproducible problems and concrete proposals, or start with [Discussions](https://github.com/TuYv/pounce/discussions) for an early design question.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, tests, coding conventions, and pull request expectations. New contributors can start with [`good first issue`](https://github.com/TuYv/pounce/labels/good%20first%20issue) or [`help wanted`](https://github.com/TuYv/pounce/labels/help%20wanted).

## Roadmap

Current improvement areas include accessibility, automated test coverage, localization quality, and compatibility across Chromium-based browsers. These are direction areas rather than promised release dates.

## Security

Please report vulnerabilities privately. See [SECURITY.md](SECURITY.md) and do not disclose security details in public Issues or Discussions.
```

- [ ] **Step 2: Add the equivalent Chinese sections before `## 许可`**

Insert:

```markdown
## 社区

Pounce 会保持克制维护，以确保它快速、注重隐私且功能聚焦。我们欢迎 Bug 修复和经过讨论、范围清晰的改进。可通过 [Issues](https://github.com/TuYv/pounce/issues) 提交可复现的问题和具体建议；尚未成形的设计想法可以先在 [Discussions](https://github.com/TuYv/pounce/discussions) 讨论。

## 参与贡献

本地开发、测试命令、代码规范和 Pull Request 要求请见 [CONTRIBUTING.md](CONTRIBUTING.md)。新贡献者可从 [`good first issue`](https://github.com/TuYv/pounce/labels/good%20first%20issue) 或 [`help wanted`](https://github.com/TuYv/pounce/labels/help%20wanted) 开始。

## 路线图

当前改进方向包括无障碍体验、自动化测试覆盖、多语言质量，以及 Chromium 系浏览器兼容性。这些是方向说明，不代表承诺的发布日期。

## 安全

请私下报告安全漏洞。参见 [SECURITY.md](SECURITY.md)，不要在公开 Issue 或 Discussion 中披露漏洞细节。
```

- [ ] **Step 3: Check durable metrics and links**

Run:

```bash
rg -n '1,000|1000|59 stars|core contributor|open-design|[[:alnum:]._%+-]+@[[:alnum:].-]+\.[A-Za-z]{2,}' README.md README.zh-CN.md
```

Expected: no matches.

Run:

```bash
for f in CONTRIBUTING.md SECURITY.md LICENSE CHANGELOG.md CHANGELOG.zh-CN.md; do test -f "$f" || exit 1; done
```

Expected: exit code 0.

- [ ] **Step 4: Commit bilingual README updates**

Run:

```bash
git add README.md README.zh-CN.md
git commit -m "docs: add community contribution entry points"
```

### Task 6: Verify and Open the Pounce Pull Request

**Files:**
- Verify all files changed in Tasks 1–5.

- [ ] **Step 1: Run repository verification**

Run:

```bash
node --test tests/*.test.js
ruby -e 'require "yaml"; ARGV.each { |f| YAML.load_file(f) }' .github/ISSUE_TEMPLATE/*.yml .github/workflows/test.yml
git diff --check origin/master...HEAD
```

Expected: 128 tests pass, YAML parsing succeeds, and `git diff --check` emits no output.

- [ ] **Step 2: Review the final change set**

Run:

```bash
git status --short
git diff --stat origin/master...HEAD
git diff --name-status origin/master...HEAD
```

Expected: only the mapped documentation, template, workflow, README, spec, and plan files are present.

- [ ] **Step 3: Push the branch**

Run:

```bash
git push -u origin feat/oss-community-readiness
```

- [ ] **Step 4: Open a draft pull request**

Run:

```bash
gh pr create --repo TuYv/pounce --base master --head feat/oss-community-readiness --draft \
  --title "chore: make Pounce community-ready" \
  --body "## Design

- approved design: https://github.com/TuYv/pounce/pull/9
- design spec: https://github.com/TuYv/pounce/blob/master/docs/superpowers/specs/2026-07-10-pounce-community-profile-design.md

## Summary

- add contribution, security, and conduct policies
- add structured Issue Forms and a pull request template
- add a Node.js 22/24 CI matrix with no npm install step
- add bilingual community, roadmap, contribution, and security entry points

## Verification

- node --test tests/*.test.js: 128 passed, 0 failed
- Issue Form and workflow YAML parsed successfully with Ruby
- GitHub checks passed: Node.js 22, Node.js 24, and GitGuardian
- manifest.json and browser permissions are unchanged
- manual browser checks: not applicable because this PR changes documentation, templates, and CI only

## Hard pre-merge gate

After explicit user approval, but before merge, enable and verify GitHub Discussions and private vulnerability reporting. Merge only after both settings are verified.

## Post-merge follow-up

- add focused repository topics
- add accurate contribution labels
- create five concrete starter issues"
```

Expected: a new draft PR URL.

- [ ] **Step 5: Wait for GitHub Actions**

Run:

```bash
gh pr checks --watch --repo TuYv/pounce
```

Expected: both Node.js matrix jobs pass. Do not merge the PR.

### Task 7: Enable Required Settings and Merge After Explicit Approval

**Files:** None. This task changes GitHub repository settings and merges the approved pull request.

- [ ] **Step 1: Confirm the user explicitly approved merging**

Do not infer approval from silence or from green CI. The user must explicitly say to merge.

- [ ] **Step 2: Enable Discussions**

Run:

```bash
gh repo edit TuYv/pounce --enable-discussions
```

- [ ] **Step 3: Enable private vulnerability reporting**

Run:

```bash
gh api --method PUT repos/TuYv/pounce/private-vulnerability-reporting
```

Expected: HTTP 204. If unavailable, report the exact API error and leave the security policy unchanged.

- [ ] **Step 4: Verify both required settings**

Run:

```bash
gh repo view TuYv/pounce --json hasDiscussionsEnabled --jq .hasDiscussionsEnabled
test "$(gh api repos/TuYv/pounce/private-vulnerability-reporting --jq .enabled)" = true
```

Expected: Discussions reports `true`, and private vulnerability reporting has `enabled: true`; the assertion must exit 0. Do not merge if either verification fails.

- [ ] **Step 5: Merge the Pounce pull request**

Resolve the pull request number from the current branch and merge it:

```bash
pr_number=$(gh pr view --repo TuYv/pounce --json number --jq .number)
gh pr merge "$pr_number" --repo TuYv/pounce --squash --delete-branch
```

Expected: PR state becomes `MERGED`.

### Task 8: Add Topics, Accurate Labels, and Seed Issues After Merge

**Files:** None. This task changes GitHub topics and creates GitHub labels and Issues.

- [ ] **Step 1: Set repository topics**

Run:

```bash
gh api --method PUT repos/TuYv/pounce/topics \
  -H "Accept: application/vnd.github+json" \
  -f 'names[]=chrome-extension' \
  -f 'names[]=browser-extension' \
  -f 'names[]=productivity' \
  -f 'names[]=keyboard-first' \
  -f 'names[]=local-first' \
  -f 'names[]=javascript' \
  -f 'names[]=open-source'
```

Expected: the response lists all seven topics.

- [ ] **Step 2: Create or update contribution labels**

Run:

```bash
gh label create "good first issue" --repo TuYv/pounce --color 7057ff --description "A focused issue suitable for a new contributor" --force
gh label create "help wanted" --repo TuYv/pounce --color 008672 --description "Community contributions are welcome" --force
gh label create documentation --repo TuYv/pounce --color 0075ca --description "Documentation improvements" --force
gh label create testing --repo TuYv/pounce --color bfd4f2 --description "Automated or manual test coverage" --force
gh label create accessibility --repo TuYv/pounce --color 1d76db --description "Keyboard and assistive-technology usability" --force
gh label create localization --repo TuYv/pounce --color c5def5 --description "English and Simplified Chinese localization" --force
```

- [ ] **Step 3: Create the test-coverage starter issue**

Run:

```bash
gh issue create --repo TuYv/pounce \
  --title "test: cover an untested search preference edge case" \
  --label "good first issue,testing,help wanted" \
  --body-file - <<'EOF'
## Goal

Add one focused regression test for an existing search or preference edge case that is not already covered.

## Acceptance criteria

- Identify the uncovered behavior in a comment on this issue before implementation.
- Add the test under `tests/` using `node:test` and `node:assert/strict`.
- Do not change production behavior unless the test exposes a confirmed bug.
- `node --test tests/*.test.js` passes.

## Contributor notes

Please keep the PR focused on one behavior and link this issue.
EOF
```

Expected: GitHub prints the new issue URL.

- [ ] **Step 4: Create the accessibility audit issue**

Run:

```bash
gh issue create --repo TuYv/pounce \
  --title "docs: audit keyboard navigation and accessibility gaps" \
  --label "good first issue,accessibility,documentation,help wanted" \
  --body-file - <<'EOF'
## Goal

Audit Pounce's popup, options page, and search overlay for reproducible keyboard-navigation or screen-reader issues.

## Acceptance criteria

- Test the popup, options page, and search overlay using keyboard-only navigation.
- Record browser, operating system, exact steps, expected behavior, and actual behavior.
- Do not include private browsing data or URLs in screenshots.
- Submit a short Markdown report or a focused fix with tests where practical.
EOF
```

Expected: GitHub prints the new issue URL.

- [ ] **Step 5: Create the contributor debugging documentation issue**

Run:

```bash
gh issue create --repo TuYv/pounce \
  --title "docs: add unpacked-extension debugging tips" \
  --label "good first issue,documentation,help wanted" \
  --body-file - <<'EOF'
## Goal

Improve contributor documentation for loading, reloading, and debugging Pounce as an unpacked extension.

## Acceptance criteria

- Document Chrome and Edge extension reload steps.
- Explain how to inspect popup, options, background service worker, and page-overlay errors.
- Keep the instructions free of package-manager install steps and consistent with `CONTRIBUTING.md`.
- Do not add screenshots containing private browser data.
EOF
```

Expected: GitHub prints the new issue URL.

- [ ] **Step 6: Create the localization review issue**

Run:

```bash
gh issue create --repo TuYv/pounce \
  --title "i18n: review English and Simplified Chinese string consistency" \
  --label "good first issue,localization,help wanted" \
  --body-file - <<'EOF'
## Goal

Review `_locales/en/messages.json` and `_locales/zh_CN/messages.json` for missing keys, inconsistent terminology, or unclear wording.

## Acceptance criteria

- Both locale files retain the same message keys.
- Any wording change includes a brief rationale.
- Placeholder definitions remain compatible across both locales.
- `node --test tests/*.test.js` passes.
EOF
```

Expected: GitHub prints the new issue URL.

- [ ] **Step 7: Create the Edge compatibility issue**

Run:

```bash
gh issue create --repo TuYv/pounce \
  --title "docs: verify and document Microsoft Edge compatibility" \
  --label "good first issue,documentation,testing,help wanted" \
  --body-file - <<'EOF'
## Goal

Verify Pounce's existing Chromium extension in current Microsoft Edge and document any reproducible differences from Chrome.

## Acceptance criteria

- Record the tested Edge, operating system, and Pounce versions.
- Check installation, search launch, popup actions, options persistence, and restricted pages.
- Document confirmed differences; do not speculate about unsupported browsers.
- If code changes are required, open a separate focused issue before implementation.
EOF
```

Expected: GitHub prints the new issue URL.

- [ ] **Step 8: Verify the public community entry points**

Run:

```bash
gh repo view TuYv/pounce --json hasDiscussionsEnabled,repositoryTopics,url
gh issue list --repo TuYv/pounce --limit 20 --json number,title,labels,url
```

Expected: Discussions enabled, seven topics present, and all five concrete issues visible with accurate labels.
