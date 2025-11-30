# Create Pull Request

**IMPORTANT: Use TodoWrite to track progress through ALL steps below.**

Before starting, create a todo list with ALL of the following items:
1. Gather information (fetch, status, log, diff)
2. Check test coverage for code changes
3. Verify test comment headers are up-to-date
4. Check for library reimplementations
5. Check if documentation needs updates
6. Run tests, lint, and build
7. Rebase on main branch
8. Push changes
9. Generate `gh pr create` command for user

Mark each todo as `in_progress` when you start it and `completed` when done. Do NOT skip any steps.

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

## 1. Gather Information
First, fetch the base branch:
```bash
git fetch origin main
```

Then gather info (can run in parallel):
- `git status` - check for uncommitted changes
- `git log --oneline origin/main..HEAD` - see all commits to include
- `git diff origin/main...HEAD --stat` - summary of all changes

## 2. Check Test Coverage and Test Comments

**IMPORTANT: Do this BEFORE running tests.**

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

## 4. Check Documentation
Review if any documentation needs updates based on the changes:

### Developer Documentation
- `docs/PRD.md` - for feature changes
- `docs/NEXT_STEPS.md` - for roadmap updates
- `docs/TESTING_PLAN.md` - for testing changes
- `docs/README.md` - for documentation index
- `docs/reference/ui-card-architecture.md` - for card system changes
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

## 5. Run Tests, Linting, and Build
Run the checks from the extension/ui directory:

```bash
cd extension/ui && npm run lint && npm test && npm run build
```

This will:
- Run ESLint to check code quality
- Run all Vitest tests
- Build the TypeScript project

If any step fails, fix the issues and commit before proceeding.

## 6. Rebase on Main
Rebase your branch on the latest main:

```bash
git fetch origin main && git rebase origin/main
```

If conflicts occur, resolve them, then:
```bash
git add . && git rebase --continue
```

## 7. Push Changes
Push your rebased branch:

```bash
git push -f
```

## 8. Create PR Command
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
