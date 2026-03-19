---
name: remember
description: Update long-term memory context files in .claude/contexts/ based on recent git commits. Use this skill whenever the user says "remember", "update contexts", "sync contexts", "update long-term memory", "장기 기억 업데이트", "컨텍스트 업데이트", "기억 갱신", or after significant code changes when the context documentation may be stale. Also trigger when the user asks to keep documentation in sync with code changes.
---

# Remember — Context Memory Synchronization

This skill keeps `.claude/contexts/` documentation in sync with actual code changes by analyzing git history since the last sync point.

## Why This Exists

As code evolves through commits, the long-term context documents in `.claude/contexts/` can become stale. Rather than manually reviewing every document after each coding session, this skill automates the detection of what changed and intelligently updates only the affected documents. This ensures future conversations always have accurate context about the project.

## Cache File

The sync state is tracked in `.claude/contexts/.remember-cache`:

```
LAST_COMMIT_HASH=<sha>
LAST_UPDATED=<ISO 8601 timestamp>
```

If this file doesn't exist, treat it as a first run — analyze the last 20 commits (or all commits if fewer than 20) to build initial context awareness.

## Execution Steps

### Step 1: Read Cache and Determine Diff Range

```bash
# Read the cache file
cat .claude/contexts/.remember-cache 2>/dev/null

# Get current HEAD
git rev-parse HEAD

# If cache exists, get commits since last sync
git log --oneline <cached_hash>..HEAD

# If no cache, get last 20 commits
git log --oneline -20
```

If the cached hash no longer exists in history (force push, rebase), fall back to the last 20 commits and warn the user.

### Step 2: Analyze Changes

For the commit range identified, gather detailed change information:

```bash
# Summary of files changed
git diff --stat <cached_hash>..HEAD

# Detailed diff (use this to understand WHAT changed)
git diff <cached_hash>..HEAD

# Commit messages (use these to understand WHY things changed)
git log --format="%h %s" <cached_hash>..HEAD
```

### Step 3: Classify Changes by Context Category

Map each change to the relevant context folder(s) based on these rules:

| Change Area | Context Folder | Signals |
|-------------|---------------|---------|
| **db/** | `db/` | Model changes, migration files, schema alterations, storage logic |
| **architecture/** | `architecture/` | New services/modules, directory restructuring, dependency changes, routing changes, API endpoint additions/removals, configuration system changes |
| **design/** | `design/` | Component additions/removals, UI library changes, page changes, styling system changes, UX flow modifications |
| **infra/** | `infra/` | Dockerfile changes, docker-compose changes, CI/CD configs, deployment scripts, performance optimizations, build system changes |
| **core/** | `core/` | Business logic changes, feature additions/removals, design decision shifts, new integrations, roadmap-affecting changes |

A single commit can affect multiple categories. When in doubt, include the category — it's better to review an extra document than to miss an update.

### Step 4: Read Existing Context Files

For each affected category, read ALL existing context files in that folder. You need the full picture to decide whether to modify, add, or remove.

### Step 5: Update Context Documents

For each affected category, decide what to do:

#### Modify Existing Document
When the change refines, extends, or corrects something already documented.
- Update the specific section that changed
- Keep the overall document structure intact
- Add notes about what changed if it represents a design shift

#### Add New Document
When the change introduces something entirely new that doesn't fit in existing documents.
- Follow the naming convention of sibling files (kebab-case .md)
- Include the same level of detail as existing docs
- Cross-reference related existing documents

#### Remove Document
When the documented feature/system has been completely removed from the codebase.
- Only remove if you're confident the feature is gone, not just refactored
- If refactored, update instead of remove

#### No Change Needed
Not every code commit requires a context update. Skip updates when:
- The change is purely cosmetic (formatting, comments)
- The change is a bugfix that doesn't alter documented behavior
- The change is already accurately reflected in existing docs

### Step 6: Ensure CLAUDE.md References Contexts

Read the root `CLAUDE.md` and check if it contains a reference to `.claude/contexts/`. If it does NOT mention contexts at all, append a minimal section like:

```markdown
## 상세 정보

`.claude/contexts/` 하위 문서를 참조. 필요한 정보는 해당 폴더에서 검색.
- `architecture/` — 시스템/서비스 구조
- `db/` — 스키마, 마이그레이션, 스토리지
- `design/` — UI/UX, 페이지, 컴포넌트
- `infra/` — 개발환경, 배포, 성능
- `core/` — 핵심 가치, 기능 설계, 설계 결정, 로드맵
```

If CLAUDE.md already mentions contexts (even partially), skip this step — don't duplicate. If new context folders were added that aren't listed, update the existing list only.

If `CLAUDE.md` doesn't exist at all, do NOT create it — this step only patches an existing file.

### Step 7: Update Cache

After all context files are updated, write the new cache:

```bash
# Write updated cache
echo "LAST_COMMIT_HASH=$(git rev-parse HEAD)" > .claude/contexts/.remember-cache
echo "LAST_UPDATED=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> .claude/contexts/.remember-cache
```

### Step 8: Report

Provide a summary to the user:

```
## Context 동기화 완료

**분석 범위**: <old_hash>..<new_hash> (<N>개 커밋)

### 수정된 문서
- `architecture/backend.md` — 새 API 엔드포인트 반영
- `db/schema.md` — 테이블 컬럼 추가 반영

### 추가된 문서
- `core/notifications.md` — 알림 시스템 신규 문서

### 삭제된 문서
- (없음)

### 변경 없음
- `design/`, `infra/` — 관련 변경 없음
```

## Important Guidelines

- **Read before writing**: Always read existing context files before modifying. Never overwrite blindly.
- **Preserve voice**: The existing documents have a consistent style (Korean technical writing). Match it.
- **Be conservative with deletions**: Only remove a document if the feature it describes is genuinely gone from the codebase. Refactors and renames should result in updates, not deletions.
- **Atomic updates**: Each document should be self-contained. Don't create documents that only make sense when read alongside the diff.
- **git diff is truth**: When the context document contradicts what `git diff` shows in the code, trust the code.
