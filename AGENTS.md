## Agent skills

### Issue tracker

Issues are tracked as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five default triage labels (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix), recorded as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Design

UI work follows the design docs. Read `PRODUCT.md` for product rules, then the brief for the screen you're building under `docs/design/<screen>/` (currently `card-grid/`). `mockup.html` is a visual reference, not code to copy: its "Mockup only" controls and demo Card are stand-ins. Use the fonts in `docs/design/card-grid/fonts/`, and load nothing from the network at play time.
