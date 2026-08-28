# AMBA HTML-First Authoring, Import, and Sync

## Purpose

This document captures a proposed workflow where authors can write an adventure first as **AMBA-style HTML**, then import that document into AMBA to generate the structured module tree and, later, selected artifacts.

The key idea is to treat AMBA semantic HTML as an **authoring/interchange format**, not merely as presentation markup.

A WYSIWYG editor such as TinyMCE can then be one front end for authoring that format, while AMBA remains the system that owns structured module data, IDs, relationships, generators, publishing, syndication, and downstream integrations.

---

## Why This Matters

AMBA's strongest model is its structured tree:

```text
Module
└── Act
    └── Scene
        └── Subscene
            └── Encounter
```

AMBA HTML already has semantic classes that correspond closely to these concepts:

- `module-overview`
- `module-section--act`
- `module-section--scene`
- `module-section--subscene`
- `module-section--encounter`
- `scene-brief`
- `encounter-brief`
- encounter flavor modifiers such as `encounter-brief--combat`, `--social`, `--puzzle`, etc.

The same HTML vocabulary also contains semantic authoring blocks such as:

- `read-aloud`
- `gm-note`
- `designer-note`
- `rules-note`
- `skill-challenge`
- `dc-table`
- `trap-card`
- `treasure-card`
- `player-handout`
- `clue-list`
- `objective-list`
- `key-list`

This means an author can create readable, styled HTML while also expressing enough structure for AMBA to interpret the document.

---

## Core Principle

**Presentation classes and structure classes are related, but they are not the same thing.**

For example:

```html
<div class="gm-note">
  Do not reveal the brass key yet.
</div>
```

is still part of the current container's narrative.

By contrast:

```html
<section class="module-section module-section--scene">
  <h2>Greymark Castle</h2>
  ...
</section>
```

explicitly declares a Scene and may become an AMBA Scene container during import.

The importer should therefore make a conservative distinction between:

1. **Container declarations** — create AMBA tree nodes.
2. **Explicit artifact declarations** — may create AMBA artifacts.
3. **Semantic narrative classes** — remain HTML inside the nearest owning container.

---

# Phase 1: HTML → AMBA Containers

The first implementation should generate **containers only**.

This provides most of the value with relatively little ambiguity.

## Suggested mappings

| HTML class | AMBA result |
|---|---|
| `module-overview` | Module overview narrative |
| `module-section--act` | Act |
| `module-section--scene` / `scene-brief` | Scene |
| `module-section--subscene` | Subscene |
| `module-section--encounter` / `encounter-brief` | Encounter |

Encounter flavor modifiers can populate encounter metadata where supported:

```text
encounter-brief--combat
encounter-brief--social
encounter-brief--puzzle
encounter-brief--trap
encounter-brief--haunt
encounter-brief--treasure
encounter-brief--story
```

## Example source document

```html
<section class="module-overview">
  <p class="kicker">Short urban dungeon for levels 2-3</p>
  <h1>The Lantern Under Greyford</h1>
  <p>Adventure overview...</p>
</section>

<section class="module-section module-section--act">
  <p class="kicker">Act 1</p>
  <h1>The Dark Lantern</h1>
  <p>Act narrative...</p>

  <section class="module-section module-section--scene scene-brief">
    <h2>Greymark Castle</h2>
    <p class="read-aloud">Lord Greymark's hall smells of wet wool and lamp oil...</p>
    <div class="gm-note">Keep this scene conversational.</div>
  </section>

  <section class="module-section module-section--scene scene-brief">
    <h2>Investigating the Dungeon</h2>

    <section class="module-section module-section--encounter encounter-brief encounter-brief--combat">
      <h3>Old Gatehouse Entrance</h3>
      <p>Encounter narrative...</p>
    </section>
  </section>
</section>
```

## Resulting AMBA tree

```text
The Lantern Under Greyford
└── Act 1: The Dark Lantern
    ├── Greymark Castle
    └── Investigating the Dungeon
        └── Old Gatehouse Entrance
```

The importer would strip nested structural child sections from the parent's narrative while preserving ordinary semantic HTML inside each node.

For example, the Scene narrative would retain:

```html
<p class="read-aloud">...</p>
<div class="gm-note">...</div>
```

but not the nested Encounter `<section>` because that becomes a child AMBA node.

---

# Determining Titles

The importer should resolve a node title from the first useful semantic heading inside the declared section.

Suggested priority:

1. first direct child `h1`
2. first direct child `h2`
3. first direct child `h3`
4. explicit `data-amba-title`
5. fallback generated name such as `Untitled Scene`

For sync-capable documents, `data-amba-title` may be useful where display headings and structural titles intentionally differ.

Example:

```html
<section
  class="module-section module-section--scene"
  data-amba-title="Greymark Castle">
  <p class="kicker">Scene 1</p>
  <h1>Audience with Lord Greymark</h1>
</section>
```

---

# Nesting Rules

The HTML DOM should determine parent/child relationships wherever possible.

Expected hierarchy:

```text
Act
  → Scene
    → Subscene
      → Encounter
```

The importer should validate unusual nesting rather than silently guessing.

Examples:

- Scene inside Act: valid.
- Subscene inside Scene: valid.
- Encounter inside Scene: valid where AMBA supports direct encounters.
- Encounter inside Subscene: valid.
- Act inside Encounter: invalid.
- Scene directly under Module root: either allowed by an explicit import option or flagged for review.

The import preview should show warnings before mutation.

---

# Narrative Ownership

Every structural section has two kinds of descendants:

1. HTML that belongs to that node's narrative.
2. Nested AMBA structural sections that should become child nodes.

The importer should clone the section, remove structural descendant sections that are promoted into child containers, and store the remaining HTML as the node narrative.

This preserves semantic authoring blocks such as:

```html
<div class="read-aloud">...</div>
<div class="gm-note">...</div>
<div class="skill-challenge">...</div>
<ul class="clue-list">...</ul>
```

without flattening the tree.

---

# Phase 2: Explicit Artifact Extraction

Artifact generation should be deliberately more conservative than container generation.

A styled block should **not automatically become an artifact** simply because it looks like one.

For example:

```html
<section class="trap-card">
  ...
</section>
```

can remain narrative HTML.

To explicitly request artifact creation, require the base `artifact` class plus a supported artifact modifier:

```html
<section class="artifact artifact--trap trap-card">
  <h2>Pressure Sluice</h2>
  ...
</section>
```

This tells the importer that the block is not merely visually styled as a trap; it is intended to become an AMBA Trap artifact.

## Current explicit artifact mappings

| HTML declaration | AMBA artifact |
|---|---|
| `artifact artifact--handout` | Handout |
| `artifact artifact--map` | Map |
| `artifact artifact--monster-block` / `artifact--monster_block` | Monster Block |
| `artifact artifact--trap` | Trap |
| `artifact artifact--treasure` | Treasure |
| `artifact artifact--random-table` / `artifact--random_table` | Random Table |
| `artifact artifact--sidebar` | Sidebar |
| `artifact artifact--article` | Article |
| `artifact artifact--page` | Page |
| `artifact artifact--image` | Image |
| `artifact artifact--narrative` | Narrative/Text content |

NPCs and PCs should not be inferred from generic artifact modifiers unless AMBA's schema explicitly defines that mapping. Their existing `npc-card` / `pc-card` classes should initially remain semantic narrative/reference blocks unless a dedicated import contract is defined.

## Artifact placement

An explicit artifact block belongs to the nearest enclosing structural container.

Example:

```html
<section class="module-section module-section--scene">
  <h2>Investigating the Dungeon</h2>

  <section class="artifact artifact--trap trap-card">
    <h2>Pressure Sluice</h2>
    ...
  </section>
</section>
```

would create:

```text
Scene: Investigating the Dungeon
└── Artifact: Pressure Sluice [Trap]
```

and remove the artifact section from the Scene narrative after promoting it into AMBA.

---

# Phase 3: Import Preview / Dry Run

Before committing an HTML import, AMBA should parse the document and show a proposed tree.

Example:

```text
IMPORT PREVIEW

Module: The Lantern Under Greyford

+ Act: The Dark Lantern
  + Scene: Greymark Castle
  + Scene: Investigating the Dungeon
    + Encounter [Combat]: Old Gatehouse Entrance
    + Encounter [Story]: The Cistern Lantern
    + Trap artifact: Pressure Sluice
    + Treasure artifact: Lamplighter's Cache

Warnings
- No title found for one handout; fallback name will be used.
- Encounter is directly under Scene; allowed.
```

Possible actions:

```text
[ Import ] [ Cancel ]
```

Later versions could allow toggling individual nodes/artifacts before import.

---

# Phase 4: Persistent IDs and Sync

Initial import does not require IDs in the source document. AMBA can generate them.

Round-trip synchronization does.

After AMBA creates or exports a structured document, structural elements can include stable identifiers:

```html
<section
  class="module-section module-section--scene"
  data-amba-id="scene-8f98c61a">
  <h2>Investigating the Dungeon</h2>
</section>
```

Artifacts can use the same mechanism:

```html
<section
  class="artifact artifact--trap trap-card"
  data-amba-id="artifact-72e6c310">
  <h2>Pressure Sluice</h2>
</section>
```

The sync process can then reliably determine intent.

## Sync semantics

Given a recognized `data-amba-id`:

- same ID + changed title → rename existing node.
- same ID + changed narrative → update narrative.
- same ID moved under another structural section → move/reparent node.
- new structural section with no ID → create node.
- known AMBA ID absent from incoming document → **do not automatically delete by default**.

Deletion should require an explicit sync mode or confirmation because accidental omission from an external document is too dangerous to interpret as intentional deletion.

Recommended modes:

### Safe update

```text
Create new nodes
Update existing nodes
Move existing nodes
Never delete
```

### Exact mirror

```text
Create
Update
Move
Delete anything managed by this source that is no longer present
```

Exact mirror should require explicit confirmation.

---

# Source Ownership

For robust synchronization, AMBA should eventually track which imported document owns which synchronized nodes.

Potential metadata:

```json
{
  "ambaImport": {
    "sourceType": "html",
    "sourceId": "greyford-authoring-document",
    "externalKey": "scene-8f98c61a",
    "lastSyncHash": "..."
  }
}
```

This prevents a sync from deleting or modifying unrelated material that was manually created in AMBA.

---

# Conflict Handling

A later sync may encounter changes both in AMBA and in the external HTML.

The system should not silently choose one.

Possible states:

```text
External changed only   → update AMBA
AMBA changed only       → preserve AMBA
Both changed            → conflict
Neither changed         → no-op
```

A content hash from the previous synchronization can support three-way comparison.

Conflict UI could offer:

```text
Scene: Greymark Castle

AMBA changed since last sync.
HTML changed since last sync.

[ Keep AMBA ] [ Use HTML ] [ Compare ]
```

This is not required for the first import implementation.

---

# HTML as an AMBA Authoring Dialect

The long-term concept is broader than TinyMCE.

```text
TinyMCE
Obsidian
LLM-generated HTML
Converted Google Docs
Markdown → AMBA HTML
Existing HTML adventure
        │
        ▼
  AMBA semantic HTML
        │
        ▼
     Importer
        │
        ▼
Module / Acts / Scenes / Subscenes / Encounters
                   +
             Explicit artifacts
```

TinyMCE is useful because it can preserve and visually edit AMBA classes, but the import format should not depend on TinyMCE-specific markup.

The HTML dialect should remain understandable by normal browsers and normal HTML tooling.

---

# Why This Is Especially Useful for LLM Authoring

Generating semantic AMBA HTML is much simpler than asking an LLM to generate the complete AMBA JSON schema correctly.

An authoring prompt can use straightforward rules:

```text
Wrap each act in:
<section class="module-section module-section--act">

Wrap each scene in:
<section class="module-section module-section--scene">

Wrap encounters in:
<section class="module-section module-section--encounter encounter-brief--combat">

Use:
<div class="gm-note">
for GM-only advice.

Use:
<p class="read-aloud">
for player-facing boxed text.
```

The importer then handles mechanical concerns such as:

- AMBA IDs
- parent relationships
- ordering
- schema construction
- artifact records
- metadata
- serialization

This allows models and human authors to work in a readable document format while AMBA remains responsible for structural correctness.

---

# Recommended Import Contract

The importer should initially recognize only a deliberately small structural vocabulary.

## Structural classes

```text
module-overview
module-section--act
module-section--scene
scene-brief
module-section--subscene
module-section--encounter
encounter-brief
encounter-brief--combat
encounter-brief--social
encounter-brief--puzzle
encounter-brief--trap
encounter-brief--haunt
encounter-brief--treasure
encounter-brief--story
```

## Explicit artifact declaration

```text
artifact
artifact--article
artifact--handout
artifact--map
artifact--monster-block
artifact--monster_block
artifact--trap
artifact--treasure
artifact--random-table
artifact--random_table
artifact--sidebar
artifact--page
artifact--image
artifact--narrative
```

Everything else should remain narrative HTML unless a later version explicitly assigns import semantics.

---

# Proposed Implementation Sequence

## 1. Parser proof of concept

Input:

```text
HTML string
```

Output:

```json
{
  "module": {},
  "acts": [],
  "warnings": []
}
```

No database mutation.

## 2. Import preview

Display the parsed AMBA tree and warnings.

## 3. Container creation

Create:

```text
Module overview
Acts
Scenes
Subscenes
Encounters
```

and save the remaining semantic HTML as each node's narrative.

## 4. Explicit artifact extraction

Support `artifact artifact--*` blocks.

## 5. Export AMBA HTML

Allow AMBA to emit the same structural dialect, including `data-amba-id` values.

## 6. Safe synchronization

Use IDs to create/update/move without deletion.

## 7. Exact mirror synchronization

Optional explicit mode supporting deletion and conflict handling.

---

# Non-Goals for the First Version

Do not attempt initially to:

- infer structure solely from heading levels;
- infer artifacts from visual classes such as `trap-card` alone;
- fuzzy-match renamed nodes for synchronization;
- automatically delete AMBA content missing from imported HTML;
- convert every possible AMBA class into schema data;
- recreate generated AoN/Donjon/PF character-sheet internals from arbitrary HTML;
- make TinyMCE markup itself part of AMBA's permanent format.

The first importer should be intentionally deterministic and conservative.

---

# Immediate Experiment

The standalone `amba-editor-test` application can be used to prove the authoring side before AMBA importer work begins.

The sample editor should produce a realistic AMBA-style adventure document based on **The Lantern Under Greyford**, using the same kinds of semantic blocks as the AMBA sample module:

```text
Module overview
Player Hook
Act 1: The Dark Lantern
Greymark Castle
Investigating the Dungeon
Old Gatehouse Entrance
The Cistern Lantern
Pressure Sluice
Lamplighter's Cache
Maintenance Diagram
NPC / character reference material
```

The editor should use AMBA author classes only. Help-site-only presentation classes should not be introduced into the authored HTML.

This gives us a realistic document to feed into the future parser and lets us test the full workflow:

```text
Author visually
    ↓
Inspect generated AMBA HTML
    ↓
Parse structural classes
    ↓
Preview proposed tree
    ↓
Import into AMBA
```

---

# Summary

The proposed model is:

> **AMBA semantic HTML becomes a human-readable authoring/interchange format, while AMBA remains the authoritative structured module system.**

The safest path is:

1. import containers first;
2. require explicit declarations for artifacts;
3. add stable AMBA IDs for exported/synchronized documents;
4. default synchronization to create/update/move without deletion;
5. add conflict-aware and exact-mirror behavior only after the basic model is proven.

This turns the TinyMCE experiment from a simple CSS-preserving editor into a possible front end for a broader AMBA HTML authoring pipeline.