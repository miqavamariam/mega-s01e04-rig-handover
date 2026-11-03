---
name: plan-to-issues
description: Split this repo's plan.md into GitHub issues with gh, one per unit of work, after a human has reviewed the split. Use when a plan is ready and has no issues yet.
---

# plan-to-issues

Turns `plan.md` into GitHub issues that workers can pick up cold. Easiest with `gh`, authenticated,
in a shell this agent can run.

## Steps

1. Read `plan.md`, `AGENTS.md` and `docs/adr/`.
2. Draft the split as a table: title · plan section · scope · done when · blocked by.
   One issue per unit of work.
3. **Stop and show the table to the human.** Publish nothing until they approve it.
4. Ask the human what every issue here must carry (fields, labels, wording), unless it is
   already written down in this session or in the repo. It is: see "What every issue carries".
5. Create each issue in dependency order, so blocked-by can cite real numbers:

   ```sh
   gh issue create --title "<title>" --body-file <tmp.md>
   ```

6. Record every issue URL from gh's output (not from memory) and reply with the list.

Closing one, with the closing comment from AGENTS.md:

```sh
gh issue close <n> -c "<closing comment>"
```

## What every issue carries

Agreed with the human on the morning-digest plan (2026-11-03). Body, in this order:

```md
Source: plan.md § <n>

## Scope

<what to change, in which files; the plan's own words where it has them>

## Done when

<the plan section's "Done when", word for word>

## Blocked by

<issue numbers, or a person or event the issue waits on (e.g. the reviewer's review); "—" if none>
```

- Label: `plan:<plan>` from the plan's frontmatter (e.g. `plan:morning-digest`). Create it once with
  `gh label create` if the repo doesn't have it.
- `§ <n>` is the plan's section number, with its letter for subsections (`§ 2a`).
- An issue that waits on a person stays open until they confirm, even when its own part is done.

## No `gh`

Steps 1–4 hold either way. GitHub reachable another way (a connector, the REST API, the web UI):
the same issues, made that way. GitHub issues out of reach altogether: write them as files in
`docs/issues/`, format in ADR 0004, then commit and push.

## Don'ts

- Don't paste the whole plan into one issue, and don't keep issues only in chat.
- Don't invent sections the plan doesn't have. If the plan is unclear, ask.
