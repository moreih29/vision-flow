---
name: task-manager
description: Manage task files in .claude/tasks/ with two-layer structure — project-level compass (permanent) and branch-scoped plans (temporary). Use this skill when the user says "task", "plan", "태스크", "계획 정리", "작업 정리", "task update", "mark done", "완료 처리", "작업 완료", or when a planner/architect produces a plan that needs to be formatted into task files. Also trigger when the user wants to check task progress, update task status, add unplanned work to the task list, or prepare tasks for cleanup before a branch merge.
---

# Task Manager — Two-Layer Task Management

Manages `.claude/tasks/` as **project compass (permanent)** + **branch-scoped plans (temporary)**.

## Directory Structure

```
.claude/tasks/
├── 00-plan.md                        # Project compass (permanent)
├── 01-roadmap.md                     # Optional permanent files
│
├── feat-migrate-context-docs/        # Branch plan (temporary)
│   ├── 00-plan.md
│   ├── 01-project-init.md
│   └── 02-backend-migration.md
│
└── feat-labeling-tool/               # Another branch
    ├── 00-plan.md
    └── 01-konva-setup.md
```

### Layer 1: Project Compass (root of `.claude/tasks/`)
- Permanent — survives all branch merges
- High-level direction, roadmap, phase status
- Keep concise — details belong in branch folders
- Updated when branches merge (reflect results)

### Layer 2: Branch Plans (`.claude/tasks/{branch-name}/`)
- Temporary — deleted when branch merges
- Branch name conversion: `feat/xxx` → `feat-xxx` (no slashes in folder names)
- Detailed tasks scoped to that branch only
- No cross-branch conflicts

## Status Markers

```markdown
- [ ] Not started
- [~] In progress
- [x] Completed
- [-] Skipped / No longer needed
```

## Commands

### 1. CREATE

**Trigger**: Planner provides a plan, user says "태스크로 정리해", etc.

**Process**:
1. Check `git branch --show-current`
2. Convert branch name to folder (`feat/xxx` → `feat-xxx`)
3. Create `.claude/tasks/{branch-folder}/`
4. Write branch `00-plan.md` + detail files
5. Add link in project compass

**Branch `00-plan.md` template**:
```markdown
# <Purpose>

**Branch**: `<name>`  |  **Created**: <date>

## Goal
<2-3 sentences>

## Phases

| # | File | Status | Description |
|---|------|--------|-------------|
| 1 | [01-<name>](./01-<name>.md) | Not Started | <brief> |
```

**Detail file template**:
```markdown
# <Task Group>

**Status**: Not Started  |  **Depends on**: None

## Tasks
- [ ] Task description
- [ ] Another task

## Done When
- <acceptance criteria>
```

### 2. UPDATE

**Trigger**: "완료 처리", "mark done", "추가 작업했어"

**Process**:
1. Read current branch's task folder
2. Surgical edit via Edit tool (no full rewrites)
3. `- [ ]` → `- [x]` for completed, `- [-]` for skipped
4. Unplanned work: add as `- [x] <desc> (unplanned)`
5. Update compass if needed

### 3. CLEANUP (Merge Prep)

**Trigger**: "merge 준비", "브랜치 정리", "cleanup tasks"

**Process**:
1. Check for incomplete items in branch folder
2. If incomplete: list them, ask user to confirm/skip/defer
3. Reflect results in project compass (`tasks/00-plan.md`)
4. Delete branch folder (`tasks/{branch-folder}/`)
5. Do NOT run git merge — user's responsibility

### 4. STATUS

**Trigger**: "진행 상황", "status", "남은 작업"

**Output format**:
```
## Status

### Project Compass
Phase 1-2 done, Phase 3 in progress

### Current Branch — `feat/labeling-tool`
**Progress**: 8/15 (53%)

| Phase | Status | Progress |
|-------|--------|----------|
| 01-konva-setup | Completed | 5/5 |
| 02-bbox-tool | In Progress | 3/10 |

**Next**: 02-bbox-tool 나머지 7개
```

## Rules

- **Don't plan, just format** — receives plans, doesn't create them
- **Branch awareness** — always check current branch; no branch folders on main
- **Compass is sacred** — never delete root-level task files
- **Surgical edits** — use Edit tool, not full rewrites
- **Folder naming** — `feat/xxx` → `feat-xxx`, `fix/yyy` → `fix-yyy`
