# Create Pull Request

**IMPORTANT: Record the start time immediately when this command begins.**

Run this command first to capture the start time:
```bash
echo "PR_START_TIME=$(date +%s)" > /tmp/pr_timing.txt && date "+PR command started at %H:%M:%S %Z"
```

**IMPORTANT: Use TodoWrite to track progress through ALL steps below.**

Before starting, create a todo list with ALL of the following items:
1. Fetch, check status, and rebase early
2. Run parallel: npm install + code review agents
3. Run parallel lint/test/build, then E2E tests
4. Address any issues found in code review or tests
5. Push changes
6. Generate `gh pr create` command for user
7. Display elapsed time

Mark each todo as `in_progress` when you start it and `completed` when done. Do NOT skip any steps.

## Parallelization Strategy

This PR command uses parallelization to reduce total time from ~7-8 minutes to ~3-4 minutes:

1. **Steps 2-6 (Code Review)**: Run as 5 parallel Task agents simultaneously
2. **Step 7 (Lint/Test/Build)**: Run lint, test, and build in parallel Bash calls, then E2E
3. **Overlap**: Start the parallel lint/test/build while reviewing Task agent results

The parallel Task agents will each analyze the code independently and report back findings.

## IMPORTANT: Explain All Decisions

**When you determine that a step requires no action, you MUST explain WHY.** Do not just run a search/Glob command and silently move on. For each step, provide a clear decision statement:

- ✅ **Good**: "No new tests needed because the changes are limited to documentation files (README.md, docs/*.md) which don't require test coverage."
- ✅ **Good**: "Test coverage exists: `useConfig.test.ts` already covers the modified hook, and the changes only affect internal implementation without changing behavior."
- ✅ **Good**: "Documentation updates not needed because this is a bug fix that doesn't change any user-facing behavior or API."
- ❌ **Bad**: *[runs Glob, sees no matches, moves to next step without explanation]*
- ❌ **Bad**: "Checked for test files. Moving on to the next step."

The explanation should include:
1. **What you checked** (files examined, patterns searched)
2. **What you found** (or didn't find)
3. **Your reasoning** for why no action is needed

---

Follow these steps exactly when creating a PR:

## 1. Fetch, Check Status, and Rebase Early

**Rebase early to catch conflicts before wasting time on checks.**

First, fetch and check for uncommitted changes:
```bash
git fetch origin main && git status --short
```

**If there are uncommitted changes**: Stop and ask the user to commit or stash them first. Rebase won't work with uncommitted changes.

**If working tree is clean**: Rebase immediately:
```bash
git rebase origin/main
```

If conflicts occur, resolve them before proceeding. This catches merge conflicts early instead of after running all the checks.

Then get the commit log (useful for writing PR description later):
```bash
git log --oneline origin/main..HEAD
```

---

## PARALLEL EXECUTION: Code Review + Dependency Install

**Run these TWO things in parallel:**

### A. Ensure Dependencies Are Installed (Bash call)

Start this IMMEDIATELY - it runs in the background while code review happens:

```bash
npm --prefix extension/ui install --prefer-offline --no-audit 2>/dev/null || npm --prefix extension/ui install
```

This uses cached packages when possible (`--prefer-offline`) and skips audit for speed. Falls back to full install if cache fails.

### B. Code Review Task Agents (5 parallel agents)

Launch all 5 Task agents simultaneously (see below).

---

## Code Review: Steps 2-6 as Task Agents

**IMPORTANT: Run ALL FIVE code review checks as parallel Task agents in a SINGLE message.**

Use the Task tool to spawn 5 parallel agents. Each agent should:
1. Perform its specific code review check
2. Report findings (issues found or "no issues")
3. Suggest specific fixes if issues are found

Launch all 5 Task agents simultaneously with these prompts:

### Task Agent 1: Test Coverage Check
```
Analyze test coverage for this PR. Run:
git diff origin/main...HEAD --name-only --diff-filter=AM | grep -E '\.(ts|tsx)$' | grep -v '\.test\.'

For each changed code file, check if corresponding tests exist. Report:
- Files that need new tests (and why)
- Files with existing test coverage (name the test files)
- Files that don't need tests (explain why: config-only, types-only, etc.)
```

### Task Agent 2: Test Comment Headers Check
```
Verify test descriptions are accurate. Run:
git diff origin/main...HEAD --name-only --diff-filter=AM | grep -E '\.test\.(ts|tsx)$'

For each changed test file, check if describe() and it() blocks accurately describe what's tested.
Report any outdated descriptions that need updating.
```

### Task Agent 3: Library Reimplementation Check
```
Check for custom implementations that should use npm packages. Run:
git diff origin/main...HEAD --name-only --diff-filter=AM | grep -E '\.(ts|tsx)$' | grep -v '\.test\.'

Look for: custom parsing (use js-yaml, papaparse), custom validation (use zod),
custom deep clone (use lodash/structuredClone), custom HTTP wrappers (use fetch/axios).
Report any reimplementations found.
```

### Task Agent 4: Historical Comments Check
```
Find comments referencing past implementations. Run:
git diff origin/main...HEAD --name-only --diff-filter=AM | grep -E '\.(ts|tsx)$' | xargs grep -l -i -E '(refactor|previous|formerly|used to|was changed|backwards.?compat|migrat|deprecat)' 2>/dev/null

Report any comments that describe historical state rather than current behavior.
```

### Task Agent 5: Dependencies and Documentation Check
```
Check for new dependencies and documentation needs.

For dependencies, run:
git diff origin/main...HEAD --name-only | grep -E '(package\.json|go\.mod|go\.sum)$'
If found, check new deps with: git diff origin/main...HEAD -- '**/package.json' | grep -E '^\+.*"[^"]+":.*"[\^~]?[0-9]'
Verify licenses are Apache 2.0 compatible (MIT, BSD, ISC, Apache-2.0 OK; GPL, AGPL, SSPL not OK).

For documentation, review if changes affect:
- docs/PRD.md, docs/NEXT_STEPS.md, docs/TESTING_PLAN.md (developer docs)
- docs/user-guide/README.md, docs/user-guide/card-types.md (user docs)
- .claude/instructions.md (AI context)

Report any license issues or documentation updates needed.
```

**After all 5 agents complete**: Review their findings. If any agent found issues requiring code changes:
1. Make the necessary fixes
2. Commit the changes
3. Note what was fixed for the PR description

## OVERLAP: Start Tests While Reviewing

**To maximize parallelization**, start the lint/test/build in background BEFORE fully reviewing agent results:

1. **Immediately after agents return**, start lint/test/build in parallel (3 Bash calls):
```bash
npm --prefix extension/ui run lint
```
```bash
npm --prefix extension/ui test
```
```bash
npm --prefix extension/ui run build
```

2. **As soon as build completes**, start E2E (don't wait for lint/test):
```bash
npm --prefix extension/ui run test:e2e
```

3. **While E2E runs**, review agent findings and make any needed fixes

4. **If fixes were made**, check if tests passed:
   - If lint/test/E2E all passed: proceed to rebase
   - If any failed due to your fixes: re-run only the failing command(s)

This overlap can save 2-3 minutes by running E2E concurrently with code review.

---

## Reference: Detailed Check Instructions

The sections below (2-6) provide detailed context for each code review check. The parallel Task agents above will perform these checks. Use these sections as reference when reviewing agent results or if you need to perform checks manually.

---

## 2. Check Test Coverage and Test Comments

**Note: This is performed by Task Agents 1 and 2 in parallel.**

### 2.1 Verify Test Coverage for Code Changes

For any code changes (non-test files), verify that corresponding tests exist:

```bash
git diff origin/main...HEAD --name-only --diff-filter=AM | grep -E '\.(ts|tsx)$' | grep -v '\.test\.'
```

For each changed code file, ask yourself:
- Does this change require new test cases?
- Are there existing tests that need to be updated?
- If this is a new file, does it have corresponding test coverage?

**Decision Required**: After checking, explicitly state your conclusion:
- If tests are needed: Explain what tests you will add and why.
- If tests exist: Name the specific test file(s) that cover the changes.
- If no tests needed: Explain why (e.g., "config-only change", "type definitions only", "documentation files only").

Common patterns for this project:
- `extension/ui/src/utils/foo.ts` → Should have tests in `extension/ui/src/utils/foo.test.ts`
- `extension/ui/src/hooks/useBar.ts` → Should have tests in `extension/ui/src/hooks/useBar.test.ts`
- `extension/ui/src/components/Baz.tsx` → Should have tests in `extension/ui/src/components/Baz.test.tsx`
- New features → Need new test cases
- Bug fixes → Should add regression tests
- Refactoring → Existing tests should still pass and may need updates

### 2.2 Verify Test Comment Headers

For any changed test files, verify the test descriptions are accurate:

```bash
git diff origin/main...HEAD --name-only --diff-filter=AM | grep -E '\.test\.(ts|tsx)$'
```

For each changed test file:
- Check if the `describe()` blocks accurately describe what's tested
- Verify `it()` descriptions match the actual test behavior
- Update descriptions if tests were added, removed, or significantly changed

**Decision Required**: After checking, explicitly state your conclusion:
- If updates needed: Describe what descriptions are outdated and how you'll fix them.
- If no test files changed: State that no test files were modified in this PR.
- If descriptions are accurate: Confirm you reviewed the test file(s) and the descriptions match the test behavior.

## 3. Check for Library Reimplementations

**Note: This is performed by Task Agent 3 in parallel.**

Review the changed files for any custom implementations that should use existing libraries instead:

```bash
git diff origin/main...HEAD --name-only --diff-filter=AM | grep -E '\.(ts|tsx)$' | grep -v '\.test\.'
```

For each changed code file, check for patterns that suggest reimplementation:
- **Custom parsing logic** (YAML, JSON, CSV, URL, date strings) → Use `js-yaml`, `papaparse`, `URL` API, `date-fns`
- **Custom validation schemas** → Use `zod`, `yup`, or `joi`
- **Custom deep clone/merge** → Use `lodash` or `structuredClone`
- **Custom utility functions** for common operations → Check if `lodash` or similar has them
- **Custom HTTP client wrappers** → Use `axios` or built-in `fetch`

If you find reimplementations:
1. Replace them with the appropriate library
2. Add the library as a dependency if not already present
3. Update tests accordingly
4. Commit the fix before proceeding

**Decision Required**: After reviewing the changed files, explicitly state your conclusion:
- If reimplementations found: Describe what was reimplemented and which library should be used instead.
- If no issues found: Explain what you checked in each file and confirm no custom implementations of common functionality were introduced (e.g., "Reviewed `useConfig.ts` - it uses the existing yaml parsing from js-yaml, no custom parsers added").

**Rationale**: See `.claude/instructions.md` Development Guidelines for more details.

## 4. Check for Historical/Refactoring Comments in Code

**Note: This is performed by Task Agent 4 in parallel.**

Search for comments that reference refactoring, previous implementations, API changes, or backwards compatibility:

```bash
git diff origin/main...HEAD --name-only --diff-filter=AM | grep -E '\.(ts|tsx)$' | xargs grep -l -i -E '(refactor|previous|formerly|used to|was changed|backwards.?compat|migrat|deprecat)' 2>/dev/null || echo "No matches found"
```

**Comments to avoid in code:**
- "Refactored to use..." or "Refactored from..."
- "Previously this was..." or "This used to..."
- "Changed from X to Y for..."
- "Migrated from..." or "Migration note..."
- "For backwards compatibility with..."
- "Deprecated: use X instead"
- Any reference to a previous state of the software

**Where historical context belongs:**
- ✅ Commit messages
- ✅ Pull request descriptions
- ✅ CHANGELOG.md entries
- ❌ Code comments (should only describe current behavior)

If you find such comments, remove or rewrite them to describe only the current behavior.

**Decision Required**: After checking, explicitly state your conclusion:
- If historical comments found: List which files and what changes you made to fix them.
- If no issues found: Confirm you searched for historical comments and none were found.

## 5. Check for New Dependencies and License Compatibility

**Note: This is performed by Task Agent 5 in parallel (along with documentation check).**

Check if any dependency files were modified:

```bash
git diff origin/main...HEAD --name-only | grep -E '(package\.json|go\.mod|go\.sum)$'
```

If dependency files were changed, check for newly added dependencies:

```bash
# For package.json changes
git diff origin/main...HEAD -- '**/package.json' | grep -E '^\+.*"[^"]+":.*"[\^~]?[0-9]'

# For go.mod changes
git diff origin/main...HEAD -- '**/go.mod' | grep -E '^\+\s+(require|github\.com|golang\.org)'
```

For each new dependency:
1. **Check the license** using `npm view <package> license` or checking the repository
2. **Verify compatibility** with Apache 2.0 (MIT, BSD, ISC, Apache-2.0 are compatible)
3. **Update the license document** at `docs/reference/license-compatibility.md`

**Incompatible licenses to watch for:**
- GPL-2.0-only (copyleft)
- AGPL-3.0 (network copyleft)
- SSPL (not OSI-approved)
- Proprietary licenses

**Decision Required**: After checking, explicitly state your conclusion:
- If new dependencies found: List each new dependency, its license, and confirm it's compatible. State that you've updated `docs/reference/license-compatibility.md`.
- If dependencies were removed: Note this and update `docs/reference/license-compatibility.md` to remove them.
- If no dependency changes: State that no dependency files were modified.

## 6. Check Documentation

**Note: This is performed by Task Agent 5 in parallel (along with dependency check).**

Review if any documentation needs updates based on the changes:

### Developer Documentation
- `docs/PRD.md` - for feature changes
- `docs/NEXT_STEPS.md` - for roadmap updates
- `docs/TESTING_PLAN.md` - for testing changes
- `docs/README.md` - for documentation index
- `docs/reference/ui-card-architecture.md` - for card system changes
- `docs/reference/license-compatibility.md` - for dependency license changes
- `.claude/instructions.md` - for AI context updates

### User Documentation
- `docs/user-guide/README.md` - for user-facing feature changes
- `docs/user-guide/card-types.md` - for card type additions or setting changes

**Important**: When adding or modifying card types, update BOTH the developer reference
(`docs/reference/ui-card-architecture.md`) AND user guide (`docs/user-guide/card-types.md`).

**Decision Required**: After reviewing the changes against the documentation list above, explicitly state your conclusion:
- If docs need updates: Specify which doc files need changes and what updates are required.
- If no docs needed: Explain why the changes don't warrant documentation updates (e.g., "This is an internal refactor that doesn't change any public APIs or user-facing behavior", "Bug fix for edge case - no new features or behavioral changes to document").

If docs need updates, make the changes and commit before proceeding.

## 7. Run Tests, Linting, Build, and E2E Tests

**IMPORTANT: Run lint, test, and build in PARALLEL using three separate Bash tool calls in a single message.**

**NOTE: Use `--prefix` to avoid working directory issues. Never use `cd extension/ui &&`.**

Execute these three commands simultaneously (in parallel Bash calls):

1. **Lint** (Bash call 1):
```bash
npm --prefix extension/ui run lint
```

2. **Unit Tests** (Bash call 2):
```bash
npm --prefix extension/ui test
```

3. **Build** (Bash call 3):
```bash
npm --prefix extension/ui run build
```

**CRITICAL: Start E2E as soon as build completes** - don't wait for lint/test to finish!

E2E tests only depend on the build output, not on lint or unit tests. As soon as the build Bash call returns successfully:
```bash
npm --prefix extension/ui run test:e2e
```

While E2E runs (~2-3 min), lint and unit tests will likely complete. Check their results after E2E finishes.

This parallel approach saves significant time:
- lint (~10s), test (~30s), and build (~20s) run in parallel
- E2E (~2-3 min) starts immediately after build, overlapping with any still-running lint/test

If any step fails, fix the issues and commit before proceeding.

**Note**: E2E tests require Playwright browsers to be installed. If not installed, run:
```bash
npx --prefix extension/ui playwright install chromium
```

## 8. Push Changes

We already rebased in Step 1, so just push:

```bash
git push -f
```

**Note**: If significant time has passed or you made fixes during the PR process, you may want to rebase again:
```bash
git fetch origin main && git rebase origin/main && git push -f
```

## 9. Create PR Command
Provide a copyable `gh pr create` command using HEREDOC format:

```bash
gh pr create --title "Title here" --body "$(cat <<'EOF'
## Summary
- Bullet points describing changes

## Test plan
- [ ] Test step 1
- [ ] Test step 2
EOF
)"
```

### ⚠️ WARNING: Do NOT Use Triple Backticks in PR Body

The entire `gh pr create` command is wrapped in a code block. If you use triple backticks (```) inside the HEREDOC body, it will terminate the outer code block prematurely and break the command.

**WRONG:**
```bash
gh pr create --body "$(cat <<'EOF'
Summary here

```typescript
// This breaks the outer code block!
const foo = 'bar';
```
EOF
)"
```

**CORRECT - Use 4-space indentation instead:**
```bash
gh pr create --body "$(cat <<'EOF'
Summary here

    // 4-space indentation for code
    const foo = 'bar';
EOF
)"
```

**CORRECT - Use inline backticks for short snippets:**
```bash
gh pr create --body "$(cat <<'EOF'
Summary here

Updated the `foo()` function to handle edge cases.
EOF
)"
```

## Important
- Always provide the `gh pr create` command for the user to copy/paste
- Use HEREDOC format for the body to preserve formatting
- Include a test plan with checkboxes
- Keep summary concise (3-5 bullet points)
- **NEVER use triple backticks (```) inside the PR body** - use 4-space indentation or inline backticks instead

## 10. Display Elapsed Time
After generating the PR command, display how long the PR process took:

```bash
source /tmp/pr_timing.txt && END_TIME=$(date +%s) && ELAPSED=$((END_TIME - PR_START_TIME)) && MINUTES=$((ELAPSED / 60)) && SECONDS=$((ELAPSED % 60)) && echo "✅ PR command completed in ${MINUTES}m ${SECONDS}s"
```
