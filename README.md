# C.F. Mechanical — Business Discovery & Growth Workspace

This is the private, mobile-friendly planning workspace for **Christian Okoh and Debynyhan Banks** at **C.F. Mechanical, LLC**, hosted at [therealfishandgrits.com](https://therealfishandgrits.com/). It connects Christian's company and HVAC knowledge with Debynyhan's plan for working the business, using Debynyhan's voice when addressing Christian.

The starting context is explicit: Christian is president, currently employed and has asked Debynyhan to work the business. The partners still need to define their responsibilities and authority. Residential HVAC as an initial revenue source is **an idea to evaluate**, and Christian's suggestion that Debynyhan join a union needs clarification. Neither is presented as an agreed strategy or commitment.

## What is built

- **53 unique discovery questions in eight groups**, routed by role: **40 for Christian and 38 for Debynyhan**. Twenty-five questions invite both perspectives; other questions ask the person who holds the relevant knowledge or responsibility.
- Christian records existing company facts, technical capability, field coverage, employment constraints and residential feasibility. Debynyhan develops the customer, financial, administrative and systems execution plan. Both record their own vision, expectations, available time and preferred shared decisions.
- A text explanation field on **every choice question**. A partner can explain a selection or answer entirely in writing without selecting an unsuitable option; a notes-only response counts as input.
- A **strategy dashboard with eight decision briefs**, bringing together each partner's relevant answers, missing inputs and links back to the question or decision. States such as **Waiting for input**, **Different choices**, **Discuss together** and **Inputs captured** describe the recorded inputs, not a decision's approval.
- A side-by-side **Partner perspectives** view comparing shared strategic choices. Different roles, titles and time commitments are not scored as disagreements. Matching choices with different explanations still need discussion; written answers are conversation inputs.
- **Nine decision topics** covering first revenue, the operating mandate, cash/job acceptance, systems, target market, project size, estimating, approvals and the roadmap. Each partner can record a selection, reasons, conditions or an alternative written proposal.
- An editable **13-week Gantt chart** with proposed tasks, owners, weeks, statuses and dependencies. Work items include a success measure, baseline, target, latest measured result and completion evidence; recorded measures also appear on the dashboard.
- A shared task board, task comments, weekly progress updates and recent activity log
- A **revenue pipeline for real residential, commercial, industrial or other inquiries**, customers and GC bid opportunities, with market, scope, estimated value, deadline, stage and next-action notes
- A company facts page identifying license **50350**, owner **Christian Okoh**, and reported expiration **October 17, 2027** (all to be verified before public use)
- JSON backup/export (and local-preview import)
- A configured private two-account Supabase backend and authenticated shared persistence

The redesign preserves the original **37 question IDs and existing option values**. Earlier answers to questions now assigned to the other partner remain saved and available for earlier-answer review and export. Existing tasks, comments, opportunities and decision preferences remain planning records. The starting roadmap and its commercial activities are editable proposals that the partners should review against their chosen revenue approach; the application does not automatically approve them or invent performance targets.

## Strategy, finance and execution upgrade

Start with **Discovery essentials** (the prioritized questions for each partner), then open deeper discovery when needed. Existing answers, historical choices and original task IDs are preserved.

- **Evidence & open questions** classifies facts, estimates, preferences and unknowns. A verified fact needs a substantive source and date. Each unresolved record generates or updates an assigned, dated research task; completed research tasks are retained if a new review is needed.
- **Customer research** records customer conversations and competitor observations. **Launch comparison** compares delivery, demand, costs, collection timing and constraints without declaring a winner.
- **Financial planning** provides startup spending, job costing and service mix, cash/economic break-even, base/downside assumptions, 13 weekly cash periods and 12 monthly operating periods. Set forecast start and actual dated startup spending; review startup costs explicitly even when there are none. Empty inputs are unknown; enter 0 only when zero is known. Fixed monthly overhead, compensation and marketing are charged once; job-level acquisition costs are incremental costs. Unpaid owner time is shown separately from cash expenses. Weekly and monthly forecasts are alternative views and are never added together.
- **Marketing experiments** connects actual spend to attributed opportunities and distinct paying customers. The pipeline stores dated milestones, invoice amounts, collections, direct job costs, callbacks and repeat/referral follow-up. Results are entered manually and date-filtered; inferred legacy stage counts are identified. Spend limits are not actual spend.
- **Decisions & confirmations** preserves individual preferences separately from proposals. Each partner confirms the exact proposal and linked evidence through their own protected account. Any content or source change makes previous confirmations stale; a matching preference is not confirmation. Manual experiment status is not a joint approval.
- **Accountability** retains existing tasks and adds a single accountable owner, deadline (manual or derived from plan start and end week), budget, dependency validation, blockers, completion criteria, evidence and dated measures. Previously shared tasks remain intact until someone chooses one lead on editing.
- **Our business plan** generates a compact strategy and a detailed deterministic draft with traceable references, current confirmations, missing inputs, forecasts, tasks and milestones. Export a standalone HTML plan or open the print version, then use the browser's Print / Save as PDF. No external AI service is required.

### Persistence and compatibility

No migration is necessary for this upgrade. New shared planning documents use the existing `app_records` task category with a `body.planningType` discriminator and `plan:<type>:<logical-id>` object IDs. They are excluded from ordinary task collections. Confirmations use existing own-seat-protected vote records (`<seat>:confirm:<proposal-id>`), including the exact canonical proposal and linked evidence snapshot. The existing membership and Row Level Security policies continue to protect reads and writes. Do not rerun the original database setup script against the live project.

Version 2 JSON backups include all answers, tasks, planning inputs, research, financial rows, experiments, events and confirmations. Import remains local-preview-only. Concurrent shared planning edits use the existing last-writer-wins behavior; stale confirmation snapshots prevent an edited proposal from retaining current approval.

### Verification

Automated coverage includes partner routing and old-answer preservation, serialized cloud saves, financial missing/zero/negative cases, scenario separation, startup spending and owner time, exact marketing attribution and unique customers, decision invalidation, safe exports and complete backups. `tests/planning-security.test.sql` adds regressions to the original database security tests and is run only against a disposable empty PostgreSQL cluster. It verifies members can share planning records while neither can forge the other's confirmations; outsiders cannot access them. No live database reset or service credentials are used.

## Guided strategy and Christian’s introduction

The authenticated dashboard begins with **Start here, Christian**, a note attributed to Debynyhan Banks explaining the purpose, proposed residential-first evaluation and how both partners participate. The full note can be dismissed per account/workspace/preview identity on that browser and reopened through **About this workspace**. The sign-in page contains only a general purpose description.

**Strategy builder** organizes six decisions: the working arrangement and capacity, customer evidence, launch segment/offer, economics/funding, marketing/website and execution/review. Critical unanswered or explicitly unknown inputs appear automatically, including when the evidence register is empty. Each step has sources, dependencies, owner, proposed dates, alternatives and a deferral reason/review date. It recommends one next action without preventing work on later steps. Follow-up research reuses an existing open task, including evidence-linked tasks.

**Our working arrangement** is a draft operating charter with attributed original answers alongside separately editable responsibilities, availability, authority, compensation, technical support and customer coverage. Drafts can be saved incomplete. Substantive minimum fields and source references are required before each partner can confirm it. This is a planning record; editing it never rewrites discovery answers.

**Customer segments** links buyers, offers and market assumptions to research, launch options, costs and experiments. Capability, capacity and cash constraints remain explicit. No score or automatically chosen winning segment is supplied. **Website brief** and page/campaign records are private requirements for a later customer-facing site; this release does not register domains, change DNS or publish a separate marketing site.

**Delivery capacity** keeps one profile per person and dated seven-day availability/role allocations. Proposed hours do not become confirmed technical capacity. Verified capability and sourced availability are distinct. Overlapping profiles/weeks and overallocation are rejected; combined service demand shares the same hours. Comparisons reuse the existing financial models. Splitting hours across month boundaries requires an explicit uniform-calendar assumption or complete weeks; missing coverage stays unknown.

**Plan vs actual** captures dated forecast snapshots with their inputs and calculated periods. They remain unchanged when current assumptions change. Actual results use one stable job identity and either pipeline values or manual values; the two sources are never summed. Cash receipts and payments use actual period totals, rather than lifetime opportunity collections. Reporting coverage and exact matching date boundaries govern whether variance is comparable. Positive/negative variances are arithmetic, with no automatic judgment. A corrective action generates one linked accountable task; completed actions are retained unless the action changes.

Typed links protect current content in confirmations. Editing a linked response, segment, task, opportunity or other relevant source invalidates its dependent confirmation. Empty new reference fields preserve legacy fingerprints. A frozen forecast baseline covers its captured inputs, not later edits to the live financial assumptions. Source cycles and graph limits are handled deterministically, with missing coverage blocking confirmation.

The living plan and standalone HTML export include strategic choices, trade-offs, current charter confirmations, segments, capacity constraints, baseline comparisons, corrective actions and website requirements. JSON backups include every new document and snapshot. No live database migration is needed; all new planning types continue to use the existing shared task-document storage and protected own-seat votes.

## Quick preview (no account needed)

Run `npm ci` and `npm run dev`, then open the displayed local URL. The included `public/portal-config.js` points to the C.F. Mechanical Supabase project using its public application key. To test without a cloud account, temporarily clear both connection values: the portal then runs in **local preview** mode. Switch between Christian and Debynyhan Banks at the top to test both sets of answers. All preview data is saved in that browser only.

**The preview is not shared between devices.** Do not send it to the partner and assume their answers will synchronize. Each browser would have its own isolated local storage.

## Shared workspace setup and onboarding

The live workspace already uses its dedicated **C.F. Mechanical Growth Workspace** Supabase project. Email confirmation, email/password sign-in and custom SMTP are configured. Email delivery, confirmation, invitations, two-account sign-in and shared updates were verified during the earlier live setup. This strategy/interface redesign uses the existing backend and does not require a database-schema or SMTP change.

1. Open [https://therealfishandgrits.com/](https://therealfishandgrits.com/). The existing hosting address is [northstar-brief.debynyhan.chatgpt.site](https://northstar-brief.debynyhan.chatgpt.site/).
2. The schema in `database/supabase-schema.sql` has been installed in that project. It creates tables, Row Level Security (RLS), and secure workspace create/join functions. Run it only when setting up a new empty project; it is not a repeatable migration.
3. `public/portal-config.js` contains the project URL and **publishable key**. These values are intentionally public in client-side apps. **Never use the service-role/secret key in browser code.**
4. The Vinext application uses its existing HTTPS hosting pipeline. The SQL file is source only and is not a public asset.
5. First partner creates an account and confirms email, signs in, selects their identity, and **creates the C.F. Mechanical workspace**.
6. That account opens **Workspace → Invite the second partner**, enters their email, and creates the invitation. This records an invitation in the private database; it **does not send an email automatically**. Send the website URL separately.
7. The second partner registers with the **same invited email**, confirms email, signs in and chooses **Join my invitation**. Each partner's account is tied to their own role, and they cannot edit the other's discovery answers or decision selections.
8. The portal checks for shared updates automatically every 20 seconds. Use the **Refresh shared data** button to refresh immediately.

If a confirmation message does not appear in the inbox, check Spam; the earlier delivery test reached Gmail's Spam folder. Share the website link yourself after creating the database invitation; the invitation action does not send Christian an email.

## Planning and application limits

- Answers, matching preferences and complete decision briefs are **planning inputs**, not accepted strategy, spending authority, signed agreements or automated approvals. The partners must discuss and confirm their actual commitments.
- RLS protects the workspace data; do not disable it. The provided SQL enforces exactly two named seats and binds discovery answers/votes to the authenticated account. Owner invitations require an exact matching **verified** email address.
- Authentication confirmation email is configured. Workspace invitations and application updates do not send notification emails automatically.
- The application does not integrate bid portals, accounting, scheduling, banking or estimating products; host project files; or perform mechanical takeoffs or construction estimates. It records the partners' plans, opportunities, measurements and links.
- Business metrics and completion evidence are entered by the partners. The app calculates planning estimates from manual inputs; it does not import accounting data, calculate audited results, evaluate technical readiness or accept a job.
- A public website for customer marketing is a **separate future deliverable**. This workspace is intended for private collaboration.
- No service worker or advanced offline sync is installed. Use the JSON backup capability for independent copies of your planning records.
- Concurrent edits to the same shared task or opportunity use **last-writer-wins** behavior. Keep JSON backups of important records.

## Recommended first session

Christian and Debynyhan each start with Discovery essentials, then set the plan start date, record launch-critical unknowns with owners and deadlines, and draft a first launch comparison. They can plan while deeper discovery remains incomplete. Use the dashboard's decision briefs to see the supporting inputs and gaps, compare shared choices in Partner perspectives and record preferences and conditions in Decisions. Revise the roadmap together, assign owners and add measurable targets with evidence. Discovery progress is guidance; it does not authorize a launch or require an automatic business decision when every answer is filled in.

## Local checks

Run `npm test` to build the application and run the automated tests, including role routing, notes-only completion, comparison/input-state behavior and persistence-queue checks. Run `npm run lint` for source linting. Browser verification should cover both partner identities, choice explanations, earlier answers, decision briefs, task measurements and the revenue pipeline.

## Files

- `app/Questionnaire.tsx` and `app/growth-workspace.js` – application entry and logic
- `app/strategy-content.js` – partner-specific questions, known context and dashboard topic mappings
- `app/discovery-model.js` – role routing, question wording, answer completion and comparison/input states
- `app/globals.css`, `app/strategy.css` and `app/planning.css` – responsive interface and strategy dashboard styles
- `app/cloud-save-queue.js` – shared-save queue and retry handling
- `tests/` – automated build, discovery-model and persistence checks
- `public/portal-config.js` – public frontend connection configuration
- `database/supabase-schema.sql` – private, two-user database schema and policies
- `public/previous/` – previous questionnaire, available to recover drafts stored by the same browser
- `README.md` – configuration/deployment guide

## Scope and factual caveat

Company facts are from information supplied by the business partners. The site does not independently certify the Ohio license or its classification. Verify license status, insurance, signatory arrangements, and project-financing capability before bidding or advertising specific trade work. The workspace is not a legal partnership agreement.

## Existing questionnaire drafts

The previous questionnaire remains available at `/previous/`. Its draft is stored locally on each browser; open that link on the original device to review or download it. The new workspace does not automatically import those answers.

## Important shared-mode limitations

Local preview remains isolated to its browser and is not a substitute for the hosted shared workspace. The configured shared workspace saves its records to the dedicated Supabase project, and each partner must use their own verified account and assigned identity. A brand-new backend project would require its own schema installation, SMTP setup and two-account access/synchronization testing; the existing live project's earlier verification is not evidence for a new project.
