# GitHub Profile README Implementation Plan

> **Status:** Execution record (non-normative). The design spec and final repository files are authoritative.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a concise, evidence-based GitHub Profile README that highlights TuYv's maintained projects and verified merged external contributions without exposing private contact information.

**Architecture:** Create the special `TuYv/TuYv` repository privately with a minimal default-branch README, then develop the complete profile on a feature branch and open a pull request. Keep the repository private until the user explicitly approves and merges the profile pull request; then make it public and verify GitHub renders it on the profile.

**Tech Stack:** GitHub special profile repository, Markdown, GitHub CLI, dynamic Shields.io badges

---

## File Map

- Create `README.md` in `TuYv/TuYv`: English-first profile with a short Chinese introduction, featured projects, verified external contributions, current focus, and contact paths.

### Task 1: Create the Private Profile Repository and Review Branch

**Files:**
- Create: `README.md` on the repository default branch with a minimal private-review note.
- Replace: `README.md` on branch `feat/profile-readme` with the complete profile.

- [ ] **Step 1: Confirm the profile repository does not already exist**

Run:

```bash
gh repo view TuYv/TuYv --json nameWithOwner,visibility,url
```

Expected before creation: GitHub reports that the repository is not found. If it exists, stop and inspect it instead of overwriting it.

- [ ] **Step 2: Create the private repository**

Run:

```bash
gh repo create TuYv/TuYv --private --description "GitHub profile README for TuYv" --add-readme --clone
```

Run from `/tmp` so the clone is created outside the agent workspace.

Expected: a private repository at `https://github.com/TuYv/TuYv` with `main` as its default branch.

- [ ] **Step 3: Replace the generated base README with a neutral review note**

Use `apply_patch` so the default branch contains exactly:

```markdown
# TuYv

Profile README under review.
```

Commit and push:

```bash
git add README.md
git commit -m "docs: initialize profile repository"
git push origin main
```

- [ ] **Step 4: Create the profile feature branch**

Run:

```bash
git switch -c feat/profile-readme
```

### Task 2: Write the Evidence-Based Profile README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace `README.md` with the complete profile**

Use this complete content:

```markdown
# Hi, I'm Tu Yu (涂瑜) 👋

I build and maintain open-source tools for browser productivity, developer workflows, and AI-assisted coding. I care about focused products, local-first privacy, reliable releases, and contributor-friendly projects.

你好，我是涂瑜。我主要开发和维护浏览器效率工具、开发者工具和 AI 编程相关的开源项目，重视隐私、稳定性与真实的社区协作。

## Featured projects

### [Pounce](https://github.com/TuYv/pounce)

[![Chrome Web Store users](https://img.shields.io/chrome-web-store/users/clgpmlhecjlekgipngaopglbfdkonjdf?label=Chrome%20users&color=4285F4)](https://chromewebstore.google.com/detail/clgpmlhecjlekgipngaopglbfdkonjdf)
[![GitHub stars](https://img.shields.io/github/stars/TuYv/pounce?style=flat&color=yellow)](https://github.com/TuYv/pounce/stargazers)
[![License](https://img.shields.io/github/license/TuYv/pounce)](https://github.com/TuYv/pounce/blob/master/LICENSE)

A privacy-first, keyboard-driven Chrome extension that searches open tabs, bookmarks, history, and top sites without sending browsing data to a server.

### [ccpm](https://github.com/TuYv/ccpm)

A preset manager for browsing and activating community configurations for Claude Code.

### [CodePlanGUI](https://github.com/TuYv/CodePlanGUI)

IDE-oriented developer tooling for configurable AI chat, commit-message generation, and tool-assisted workflows.

## Selected open-source contributions

- **[cc-switch](https://github.com/farion1231/cc-switch)**
  - [#2184](https://github.com/farion1231/cc-switch/pull/2184) — added cached provider-usage information to the system tray.
  - [#2211](https://github.com/farion1231/cc-switch/pull/2211) — fixed duplicate Skill imports caused by repeated clicks.
  - [#2420](https://github.com/farion1231/cc-switch/pull/2420) — corrected weekly coding-plan tier labeling.
- **[html-anything](https://github.com/nexu-io/html-anything)**
  - [#93](https://github.com/nexu-io/html-anything/pull/93) — contributed three community-sourced visual templates.

## Current focus

- Maintaining Pounce and making it easier for external contributors to participate.
- Improving automated tests, keyboard accessibility, localization, and Chromium-browser compatibility.
- Building focused developer tools around AI-assisted coding workflows.

## Open source & collaboration

For bugs, proposals, or collaboration, please use the relevant project's GitHub Issues or Discussions:

- [Pounce Issues](https://github.com/TuYv/pounce/issues)
- [Pounce Discussions](https://github.com/TuYv/pounce/discussions)
- [My public repositories](https://github.com/TuYv?tab=repositories)
```

- [ ] **Step 2: Verify every contribution is merged and public**

Run:

```bash
for pr in \
  farion1231/cc-switch#2184 \
  farion1231/cc-switch#2211 \
  farion1231/cc-switch#2420 \
  nexu-io/html-anything#93; do
  repo=${pr%#*}
  number=${pr#*#}
  gh pr view "$number" --repo "$repo" --json state,mergedAt,url --jq 'select(.state == "MERGED" and .mergedAt != null) | .url'
done
```

Expected: all four PR URLs are printed.

- [ ] **Step 3: Scan for prohibited claims and private data**

Run:

```bash
rg -n 'core contributor|open-design|20x|Claude Max|1,000|1000|59 stars|[[:alnum:]._%+-]+@[[:alnum:].-]+\.[A-Za-z]{2,}' README.md
```

Expected: no matches.

- [ ] **Step 4: Verify linked repositories are public**

Run:

```bash
for repo in TuYv/pounce TuYv/ccpm TuYv/CodePlanGUI farion1231/cc-switch nexu-io/html-anything; do
  gh repo view "$repo" --json visibility,url --jq 'select(.visibility == "PUBLIC") | .url'
done
```

Expected: all five repository URLs are printed.

- [ ] **Step 5: Render the README through GitHub's Markdown API**

Run:

```bash
gh api markdown -F text=@README.md -f mode=gfm -f context=TuYv/TuYv | rg -n 'Featured projects|Pounce|Selected open-source contributions|Open source &amp; collaboration'
```

Expected: all four profile sections appear in the rendered HTML.

- [ ] **Step 6: Commit the profile README**

Run:

```bash
git add README.md
git commit -m "docs: add GitHub profile README"
```

### Task 3: Open and Review the Private Profile Pull Request

**Files:**
- Verify: `README.md`

- [ ] **Step 1: Review the final diff**

Run:

```bash
git diff --check main...HEAD
git diff --stat main...HEAD
git diff main...HEAD -- README.md
```

Expected: only `README.md` changes and no whitespace errors appear.

- [ ] **Step 2: Push the feature branch**

Run:

```bash
git push -u origin feat/profile-readme
```

- [ ] **Step 3: Open a draft pull request**

Run:

```bash
gh pr create --repo TuYv/TuYv --base main --head feat/profile-readme --draft \
  --title "docs: add GitHub profile README" \
  --body "## Summary

- introduce Tu Yu / 涂瑜 in English with a short Chinese summary
- feature Pounce, ccpm, and CodePlanGUI
- link four verified merged external pull requests
- direct collaboration to GitHub Issues and Discussions

## Privacy and accuracy

- no public email address
- no visitor counters or third-party statistics cards
- no unmerged PRs or unsupported contribution claims"
```

Expected: a private draft PR URL accessible to the repository owner.

- [ ] **Step 4: Stop for user review**

Do not merge and do not make the repository public. Provide the PR URL and wait for explicit approval.

### Task 4: Publish the Profile After Explicit Approval

**Files:** None beyond the approved `README.md`.

- [ ] **Step 1: Confirm explicit user approval**

The user must explicitly approve the profile pull request and publication.

- [ ] **Step 2: Merge the profile pull request**

Resolve the profile pull request number from the current branch and merge it:

```bash
pr_number=$(gh pr view --repo TuYv/TuYv --json number --jq .number)
gh pr merge "$pr_number" --repo TuYv/TuYv --squash --delete-branch
```

- [ ] **Step 3: Make the repository public**

Run:

```bash
gh repo edit TuYv/TuYv --visibility public --accept-visibility-change-consequences
```

- [ ] **Step 4: Verify GitHub recognizes the profile repository**

Run:

```bash
gh repo view TuYv/TuYv --json visibility,url,defaultBranchRef --jq '{visibility,url,defaultBranch:.defaultBranchRef.name}'
curl -sL https://github.com/TuYv | rg -n 'Featured projects|Pounce|Selected open-source contributions'
```

Expected: repository visibility is `PUBLIC`, default branch is `main`, and the profile page contains the new README sections.
