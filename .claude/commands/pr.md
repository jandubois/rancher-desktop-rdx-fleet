# Create Pull Request

**IMPORTANT: Record the start time immediately when this command begins.**

Run this command first to capture the start time:
```bash
echo "PR_START_TIME=$(date +%s)" > /tmp/pr_timing.txt && date "+PR command started at %H:%M:%S %Z"
```

**IMPORTANT: Use TodoWrite to track progress through ALL steps below.**

Before starting, create a todo list with ALL of the following items:
1. Fetch, check status, and rebase early
2. Start npm install in background
3. Check test coverage for code changes
4. Verify test comment headers are up-to-date
5. Check for library reimplementations
6. Check for historical/refactoring comments in code
7. Check for new dependencies and license compatibility
8. Check if documentation needs updates
9. Run parallel lint/test/build, then E2E tests
10. Push changes
11. Generate `gh pr create` command for user
12. Display elapsed time

Mark each todo as `in_progress` when you start it and `completed` when done. Do NOT skip any steps.

## Parallelization Strategy

This PR command uses parallelization to reduce total time:

1. **npm install**: Runs in background while code review happens (Step 2)
2. **lint + test + build/E2E**: Run in parallel (Step 8)
   - lint (~10s) runs as a Bash call
   - test (~60s) runs as a Bash call
   - build+E2E runs in a Task agent (build ~8s, then E2E ~60s)
   - E2E starts immediately after build, runs in parallel with unit tests

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

## 2. Start npm install in Background

**Start this IMMEDIATELY after rebase** - it runs while you do code review:

```bash
npm --prefix extension/ui install --prefer-offline --no-audit 2>/dev/null || npm --prefix extension/ui install
```

This uses cached packages when possible (`--prefer-offline`) and skips audit for speed. Falls back to full install if cache fails.

**Continue with code review steps (3-8) while npm install runs in the background.**

---

## 3. Check Test Coverage and Test Comments

**IMPORTANT: Do this BEFORE running tests.**

### 3.1 Verify Test Coverage for Code Changes

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

### 3.2 Verify Test Comment Headers

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

## 4. Check for Library Reimplementations

**IMPORTANT: Verify that no functionality has been reimplemented that is already available in popular npm packages.**

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

## 5. Check for Historical/Refactoring Comments in Code

**IMPORTANT: Code comments should only describe the current state of the code, not its history.**

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

## 6. Check for New Dependencies and License Compatibility

**IMPORTANT: Verify that any newly added dependencies are compatible with our Apache 2.0 license.**

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

## 7. Check Documentation

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

## 8. Run Tests, Linting, Build, and E2E Tests

**IMPORTANT: Run lint, test, and build+E2E in PARALLEL using a combination of Bash and Task tool calls.**

**NOTE: Use `--prefix` to avoid working directory issues. Never use `cd extension/ui &&`.**

Execute these three operations simultaneously in a single message:

1. **Lint** (Bash call):
```bash
npm --prefix extension/ui run lint
```

2. **Unit Tests** (Bash call):
```bash
npm --prefix extension/ui test
```

3. **Build + E2E** (Task agent with subagent_type=general-purpose):
Use a Task agent to run build followed by E2E tests. This allows E2E to start immediately after build (~8s) without waiting for unit tests (~60s) to complete.

Prompt for the Task agent:
```
Run the build and E2E tests for the extension/ui project. Do NOT do any code review or analysis.

1. First run the build:
   npm --prefix extension/ui run build

2. If build succeeds, immediately run E2E tests:
   npm --prefix extension/ui run test:e2e

3. Report back:
   - Build result (success/failure, any errors)
   - E2E result (success/failure, test summary)
   - If E2E fails due to missing Playwright browsers, note this for the user

Do not attempt to fix any failures - just report them.
```

This parallel approach saves significant time:
- lint (~10s) runs in parallel with everything
- test (~60s) runs in parallel with build+E2E
- build (~8s) + E2E (~60s) runs in the subagent, overlapping with unit tests

If any step fails, fix the issues and commit before proceeding.

**Note**: E2E tests require Playwright browsers to be installed. If not installed, run:
```bash
npx --prefix extension/ui playwright install chromium
```

## 9. Push Changes

We already rebased in Step 1, so just push:

```bash
git push -f
```

**Note**: If significant time has passed or you made fixes during the PR process, you may want to rebase again:
```bash
git fetch origin main && git rebase origin/main && git push -f
```

## 10. Create PR Command
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

## 11. Display Elapsed Time
After generating the PR command, display how long the PR process took:

```bash
source /tmp/pr_timing.txt && END_TIME=$(date +%s) && ELAPSED=$((END_TIME - PR_START_TIME)) && MINUTES=$((ELAPSED / 60)) && SECONDS=$((ELAPSED % 60)) && echo "✅ PR command completed in ${MINUTES}m ${SECONDS}s"
```
