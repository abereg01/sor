# Living Infrastructure Graph — Production Readiness Roadmap

This document is a **forward-looking roadmap** for taking the Living Infrastructure Graph
from its current advanced prototype state into a **production-ready System of Record (SoR)**.

Its written explicitly so that **future ChatGPT sessions (and humans)** can understand:
- what has already been achieved (see history.md)
- what remains to be done
- *why* things are ordered the way they are

Core philosophy reminders:
- Graph UI is NOT the product — trusted, explainable truth is
- Claims are append-only truth
- Evidence explains *why* we believe claims
- Soft validation > hard rejection
- Human-first workflows, machine-enforced safety

---

## ~~Phase 0 — Define the Finish Line (Meta Phase)~~

**Goal:** Prevent infinite polish and scope drifting.

### Deliverables
- Written definition of "production-ready" for KEAB use
- 5–10 acceptance bullets (auth on, backups tested, imports safe, dev/prod split exists, etc.)

### Acceptance
- Team agrees what "done" means
- Used as a stop condition for roadmap execution

---

## ~~Phase 1 — Functional Correctness Walkthrough~~

**Goal:** Everything that exists must work, end-to-end.

### Scope
Perform a deliberate user walkthrough of the entire application:
- Create node
- Edit node
- Create edge
- Edit edge
- Add claim
- Attach evidence
- Trigger needs_review
- Resolve review
- Import → reconcile → approve
- Run key queries (PII, dependencies, blast radius)

### Delrables
- Fixed broken UI flows
- Fixed backend correctness bugs
- No "surprising" behavior during normal use

### Acceptance
- No known broken primary flows
- Issues discovered here are fixed before any redesign

---

## ~~Phase 2 — Codebase Hygiene & Structural Cleanup~~

**Goal:** Make the codebase calm and safe to change.

### Scope
- Fix UI errors and warnings
- Fix backend warnings that affect correctness
- Split configuration (dev / prod / future auth)
- Introduce absolute imports (`@/`) everywhere
- Remove accidental complexity and dead paths

### Acceptance
- Clean build with no meaningful warnings
- Clear configuration boundaries
- Easier mental model for future changes

---

## ~~Phase 3 — API Hardening & Baseline Security~~

**Goal:** Remove "dev-only" assumptions before adding auth.

### Scope

#### API hardening
- Rate limiting (especially import + evidence endpoints)
- Input size limits (XLSX, evidence payloads)
- Timeouts on expensive traversals
- Defensive validation guards

#### HTTP security
- Tight CORS (explicit production origins only)
- Security headers:
  - CSP (frontend)
  - X-Content-Type-Options
  - X-Frame-Options

### Acceptance
- API safe to expose internally
- No unbounded inputs or accidental abuse paths

---

## ~~Phase 4 — Metadata Guidance → Soft Enforcement~~

**Goal:** Improve data quality without blocking humans.

### Scope
- Define **metadata profiles per edge type**:
  - flows_to
  - stores_data
  - runs_on
- Server-side validation that yields:
  - warnings
  - needs_review flags
  - NOT hard rejects
- Version guidance so older claims remain interpretable

### Acceptance
- Metadata consistency improves over time
- Old data remains valid and explainable

---

## ~~Phase 5 — Sidebar Redesign (Workflow First)~~ 

**Goal:** Make the sidebar teach the mental model.

### Scope
- Clear mode separation:
  - Nodes
  - Edges
  - Claims
  - Evidence
  - Review
  - Import
- Explicit save/conflict state
- Inline explanations (Swedish, plain language)
- In koppling/relation, we need to be able to specify riktigt for the data, the flow. Now we are only able to choose to sort on flow in datatrafik. We need to be able to do this in the relation.

We are also reworking the UI of the whole Sidebar. It is ugly, the text is ugly, some cells are too large for the sidebar etc. 
I believe we should use this sidebar instead. 
- I am also thinking, to make better user of the sidebar, maybe instead of having the metadata fields, or input fields directly editable in the sidebar, we could have a link or something that launches this editor https://devdojo.com/pines/docs/monaco-editor. So the information is shown in the sidebar, but if we wanna edit, we get prompted with this monaco editor. 


### Acceptance
- Users understand what they are editing
- Fewer accidental edits and confusion
- You are free to add other languages than typescript and rust if better suited. 

---

## ~~Phase 6 — UI Redesign~~ 

**Goal:** Make UI coherent, useable and beautiful. Splice configs.

### Scope
- Visual distinction between:
  - truth
  - needs_review
- Split configs larger than 500 lines. 
- Better visual hierarchy
- Background needs to be bright. Like the Sidebar and Inspector. Make sure to use colors from styles.css
- Highlight explainability paths
- When choosing a node/highlighting, the dataflow should appear. Not only when the line between nodes is pressed.
- When dataflow is showing, only show the the relevant flow instead of every flow. 
- We wanna add this https://devdojo.com/pines/docs/command. And preferably this is launched via Space. So that we can search and highlight nodes. So that when we search for Nextcloud, we can press enter and the Nextcloud node is chosen and highlighted. We might att the ability to create nodes from here later.
- I also think we might use a brighter UI, rather than this blue dark. And I kinda hate how it works right now. When pressing a node, everything kinda relaunched/reloads so that the nodes move. It is cool, but also kinda annoying. They should not move so much. It is also hard to press the lines between the nodes. The press area is very small. This is also an issue when you are zoomed in. In short, I like that it feels dynamic and alive, but maybe a bit much and it needs to be more static.
- Remove the top buttons, Visar resultat: 0 objekt, 0 relationer & result.zoomToSelection

### Acceptance
- UI feels calm and intentional
- Users can reason about state at a glance
- You are free to add other languages than typescript and rust if better suited. 

---

## ~~Phase 7 — Structured XLSX Import, Exports~~

**Goal:** Scale data ingestion safely. We wanna be able to create nodes and relations primarily in the gui, but also from excel files. 

### Scope
- Allow XLSX to be uploaded and implemented
- Set a standard for how the document should be formatted to correctly import data.

### Acceptance
- Imports never silently corrupt truth
- Every imported relationship is explainable
- Exports works

---

---

## ~~Phase 7.5 - Fixes~~

**Goal:** Make the code be as done as possible up to this point

### Scope
- UI - When a change is made, if a koppling is highlighted so that the animation is running, if something causes the nodes to reload, like saving till -> från to från -> till as an example, the animated - - - is stuck where the line was before, and not where it is after the reload. So it is floating midair. As it is not attached to the actual line. This is not an issue if I drag lines, this issue only appears upon an update on the website.
- Dotted lines are varying length.
- Inspector metadata decoupled from the metadataformeditor. 
- Inspector, we are missing what type the node is. We wanna see if it is System, Databas etc. We also always show for example databasmotor and version in the metadata in the Inspector. These are optional and if they are not filled or have any information, should be hidden. 
- Remove importera from the Sidebar
- Inspector remove node not working and wrong. 
- Errors from npm build
- Scrollbar is wrong color. Need to adhere to styles.css
- Changing flow direction does not work and does not change the flow direction. Need to make sure the flow is connected on the nodes as well. 

## ~~Phase 8 — Authentication & Roles~~

**Goal:** Enable safe multi-user operation.

### Scope
- Local rescue account in case of Keycloak being down. 
- OIDC via Keycloak
- Roles:
  - viewer
  - admin
- Backend-enforced permissions
- UI adapts to read-only mode
- Audit logs include identities

### Acceptance
- Unauthorized edits impossible
- Clear separation of responsibility

---

## ~~Phase 9 — Explainability & Audit UX~~

**Goal:** Make truth defensible.

### Scope
- Audit timeline (who changed what and when)

### Acceptance
- Any relationship can be justified
- Auditability is visible, not hidden

---

## ~~Phase 10 — Review Operations & Review Queues~~

**Goal:** Keep the graph usable at scale.

### Scope
- Multi-select nodes:
  - add shared owner/vendor tags
  - create multiple edges
- Review inboxes:
  - Review routing, skicka till granskning fails. 
  - needs_review queue
  - import reconciliation queue

### Acceptance
- Large datasets manageable without fatigue
- Reviews feel like a workflow, not a chore

---

## ~~Phase 11 - Data galore~~

**Goal:** Handle much more metadata, making it real world use.

### Scope 
- Be able to fine grain sort based on metadata. Filter 

## ~~Phase 12 - Export~~ 

**Goal:** Be able to granular export data 

### Scope
- Be able to chose data to be exported. 

## ~~Phase 12.5 - Granskning~~ 

**Goal:** Be able to request and complete granskning.

### Scope 
- Add a granska(review) button to the InspectorPanel.
- Connect to user. A granskning can never be completed by the user that created the granska förfrågan.

---

## ~~Phase 13 — Onboarding & Guided Workflows~~ !! Phase Removed

**Goal:** Enable new users without direct assistance.

### Scope
- All templates should live under verktyg, as its own entry. Launching a modal for selecting each template for viewing. 
- Templates:
  - Skapa ny nod 
  - Add integration flow 
  - How to granska 
  - How to use Historik 
- Inline glossary tooltips (Swedish, plain language)

### Acceptance
- First-time users can complete basic modeling
- Reduced training burden

---

## ~~Phase 14 - Correct metadata~~ 

**Goal:** Correct metadata 

### Scope 
  - Replace Namn with Systemets Namn
  - Replace the first beskrivning with Beskrivning av systemet 
  - Remove Programvara/namn, we already have the name. Also change beskrivning here to Programbeskrivning. Make Syfte a larger input field, just like Programbeskrivning. 
  - Move Programvara to be above Leverantör & Ägarskap
  - Rename Score (0-5) to Affärskritikalitet.
  - at the top it says Skapa objekt, change to Skapa nod
  - Remove App field, we have already specified this in Typ 
  - Ägare are not editable. It is locked. We wanna be able to type, and get suggestions if the Ägare already exists in the database.
  - Domän needs a dropdown, just like Kritisk with options KEAB and Process
  - Make the dropdown for Typ av leverantör be the same as the others. This is the only field with this type of list. 

- All of the renaming we are doing here MUST be reflected in the InspectorPanel as well.

  - We need to make Programvara/Syfte and Programvara/Programbeskrivning input fields the same size. Syfte is correct. Lets place them next to each other. Ägare does not work. It should work just the same as Leverantör. A dropdown with the ability to search already added entries. Also, Leverantör & Ägarskap/Ägare can be removed as a field. I do not need this. And lastly, these dropdown that we are able to type in are transparent, not white. Also when a Leverantör is added, it shows and ugly pill. Lets just keep this simple with no pill.

---

## ~~Phase 15 - UX~~

**Goal:** UX is ready for launch 

### Scope 
- InspectorPanel
  - Add back colors to Kopplingar (Relation & mål). A koppling in InspectorPanel should be colored blue or green, based on direction. Or blue/green based on the Källa-Må/Mål-Källa. This has been implemented before in our codebase. We are talking about the large pills at the bottom of the InspectorPanel in Relation och mål. Right now, when I highlight a koppling, the relation is blue/green. And this is correct. But mål is not colored and there are no colors at all if looking on the node. Also, when dubbelriktad, the colors is blue/green faded. It is supposed to be striped to better emulate the look of the animated lines in the graph.  

- CSS. All of the colors must be linked to the styles.css, no static colors in the config. 
  - Change the Logga ut icon for sidebar. It is too similar to the Fäll in/fäll ut button. 
  - In historik, 'Ändrad' should be orange. Now it is black.
      - Exportera has its checkboxes (Claim, Dataflöden, Kopplingar) is spread out weirdly. Make this appear in a row instead beneath Format (where Claim is now).
  
- Loginpage
  - Remove the remember me button 
  - Remove Lokalt konto (utan Keycloak)
  - Add a title, like, if we take md formatting
    ###  System of Record 
    #### Karlshamn Energi
    and replace Login with that. 
  - Have the Login button be green instead of red. 

---

## ~~Phase 16 - Split files~~ 

**Goal:** Split large files to smaller chunks

### Scope
- Remove unused configs. Like the import configs or the tooltip. They are no longer used. If unsure, ask.
- Look for improving folder structure and misplaced files. I do not like files randomly in src/ like etagStore. Or files in components/ like DeleteNodeButton. This should be grouped with InspectorPanel etc etc. src/graph should be together with src/components/graph 
- Remember to use @ for linking to files
- Split large files in to smaller chunks. 
- Make use of already established split folders. Like /graph for GraphView, /parts for InspectorPanel and so on.

### Acceptance
- No breaking changes
- Logical splits

## ~~Phase 16.5 - Granska rework~~

**Goal:** Minor rework of Granska 

### Scope
- If a node is rejected, we should not remove the Granska case, but instead make it red in the Sidebar. Otherwise it just disappears. 
- When a node has been Godkänd, we must add that to the Historik for the node/koppling to have history of a approved change. 

- If I do the highlighting of 2 nodes to create a koppling between them, I should not have to specify Mål and Källa, since I have already chosen them. This should be prefilled. As it already is at the top Aidon DB Mysql ↔ Utbildning

- If a case is sent to Granska, and I godkänner, we should automatically update Verifierad av. Having granskat something automatically makes it Verifierad. We still wanna keep the verioifierad button to be able to manually verifiera. But a granskning automatically marks it as verifierad. This goes for kopplingar as well. 

- In InspectorPanel, when highlighting a a koppling we have Status/Skapad. Skapad is always --. It does not read the creation date. 
— does not work. It does not read the time when connected. It always says — 

- Koppling skapad defaults to 1970-01-01, I do not believe we have this migration in the database. We are interested in that information.

## ~~Phase 17 — Final Review & Polish~~

**Goal:** Final sign-off before calling the system production-ready.

### Scope
- Fix remaining minor UI and UX issues
- Resolve or justify remaining warnings
- Visual consistency pass
- Security issues
- Re-run Phase 0 acceptance checklist
- Verify:
  - auth
  - rate limits
  - CORS & security headers

### Acceptance
- No known blocking paper cuts
- Final checklist passes
- System can confidently be declared "done"

---

## ~~Phase 18 — Dev/Prod Environments (Configuration & Runbooks)~~

**Goal:** Make development and production environments explicit and predictable.

### Scope
- Define environment contracts (required env vars, defaults vs strict)
- Dev setup (local frontend + backend + Postgres)
- Prod setup (strict config, security enabled)
- Operational docs:
  - how to run dev
  - how to run production
Add dev branch, staging branch to forgejo 

### Acceptance
- New machine can run dev quickly
- Prod cannot start with missing critical config
- Clear runbooks exist

---

## Phase 19 — Containerization (Swarm & Kubernetes)

**Goal:** Final production packaging and automation.

### Scope (containers)
- Platform-agnostic images
- Single image pipeline
- Swarm stack (Traefik)
~~- Kubernetes manifests or Helm chart~~
- Rewrite this document to add and update the History.md

~~### Optional Scope (Forgejo CI/CD)~~
~~- Build + test pipelines (frontend + backend)~~
~~- Build and push images to registry~~
~~- Deploy workflows:~~
  ~~- Swarm: docker stack deploy~~
  ~~- Kubernetes: apply or Helm upgrade~~
~~- Versioning strategy:~~
  ~~- tagged releases → immutable images~~
  ~~- main → staging/latest images~~

### Acceptance
- Same images run on Swarm or Kubernetes
- Deployments are reproducible
~~- CI blocks deploy on failed builds/tests~~

---

## Final Notes

This roadmap intentionally:
- Prioritizes correctness before polish
- Introduces security before auth
- Adds scale only after governance
- Treats explainability as a first-class feature


It should be read together with `history.md` as a **living project memory**.
