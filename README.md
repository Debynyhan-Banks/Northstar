# C.F. Mechanical — Business Discovery & Growth Workspace

This is a professional, mobile-friendly two-partner planning portal for **C.F. Mechanical, LLC**. It is designed to collect Christian Okoh's and the business-development partner's views **before** defining strategy and SMART goals. It intentionally does not use the language of a trial, legal agreement, or employee assessment.

## What is built

- 35 discovery questions in eight topics, with individual answers for each partner
- A side-by-side alignment report identifying shared priorities, differences and open questions
- Five shared-decision topics with independent partner selections
- An editable 13-week Gantt chart with proposed tasks, owners, weeks, statuses, dependencies and completion evidence
- A shared task board, task comments, weekly progress updates and recent activity log
- A **real** bid-lead pipeline (initially empty, not filled with fictitious contracts)
- A company facts page identifying license **50350**, owner **Christian Okoh**, and reported expiration **October 17, 2027** (all to be verified before public use)
- JSON backup/export (and local-preview import)
- Optional private two-account Supabase backend and authenticated sync

There are no finalized SMART goals yet. The starting Gantt chart is **clearly labeled provisional**. Both partners first answer questions, discuss strategy and then confirm specific targets.

## Quick preview (no account needed)

Run `npm ci` and `npm run dev`, then open the displayed local URL. `public/portal-config.js` deliberately has empty cloud credentials, so the portal runs in **local preview** mode. Switch between Christian and Business Development at the top to test both sets of answers. All preview data is saved in that browser only.

**The preview is not shared between devices.** Do not send it to the partner and assume their answers will synchronize. Each browser would have its own isolated local storage.

## Make the portal private and shared between two users

1. Create a new Supabase project at https://supabase.com. Enable **email confirmation** under Authentication settings and allow email/password sign-ins. Configure its permitted site/redirect URL for your domain.
2. Open Supabase SQL Editor and execute `database/supabase-schema.sql`. This creates tables, Row Level Security (RLS), roles, and secure workspace create/join functions.
3. Under Supabase Project Settings / API, copy the project URL and **publishable/anon key** into the values in `public/portal-config.js`. These values are intentionally public in client-side apps. **Never use the service-role/secret key in browser code.**
4. Deploy the Vinext application through its existing hosting pipeline and serve it via HTTPS. The SQL file is source only and is not a public asset.
5. First partner creates an account and confirms email, signs in, selects their identity, and **creates the C.F. Mechanical workspace**.
6. That account opens **Workspace → Invite the second partner**, enters their email, and creates the invitation. This records an invitation in the private database; it **does not send an email automatically**. Send the website URL separately.
7. The second partner registers with the **same invited email**, confirms email, signs in and chooses **Join my invitation**. Each partner's account is tied to their own role, and they cannot edit the other's discovery answers or decision selections.
8. The portal checks for shared updates automatically every 20 seconds. Use the **Refresh shared data** button to refresh immediately.

### Deployment caveats

- This is a functional **starter application**, not a hosted production deployment. You must supply the Supabase project and deploy the files before cross-device sharing is available.
- RLS protects the workspace data; do not disable it. The provided SQL enforces exactly two named seats and binds discovery answers/votes to the authenticated account. Owner invitations require an exact matching **verified** email address.
- The system does not send email, integrate external bid portals, host project files, or include construction estimating engines. It tracks those workstreams.
- A public website for customer marketing is a **separate future deliverable**. This workspace is intended for private collaboration.
- No service worker or advanced offline sync is installed. Use the JSON backup capability for independent copies of your planning records.
- For a high-sensitivity or regulated deployment, add security review, reliable audit logging, backup/restore policy, and accessibility QA before putting confidential financial documents into the app.

## Recommended first session

Christian fills out his discovery questionnaire. Business Development fills out their questionnaire separately. Compare results in Alignment, work through Decision Log, and revise the first 13-week roadmap together. Choose estimating software based on actual bidding needs and budget. Establish measurable SMART goals **after** the discovery responses are discussed.

## Files

- `app/Questionnaire.tsx` and `app/growth-workspace.js` – application entry and logic
- `app/globals.css` – responsive interface
- `public/portal-config.js` – empty public frontend connection configuration
- `database/supabase-schema.sql` – private, two-user database schema and policies
- `public/previous/` – previous questionnaire, available to recover drafts stored by the same browser
- `README.md` – configuration/deployment guide

## Scope and factual caveat

Company facts are from information supplied by the business partners. The site does not independently certify the Ohio license or its classification. Verify license status, insurance, signatory arrangements, and project-financing capability before bidding or advertising specific trade work. The workspace is not a legal partnership agreement.

## Existing questionnaire drafts

The previous questionnaire remains available at `/previous/`. Its draft is stored locally on each browser; open that link on the original device to review or download it. The new workspace does not automatically import those answers.

## Important shared-mode limitations

Do not use the preview for real shared collaboration. Shared mode requires a configured Supabase project, verified accounts, two-person access testing, and successful synchronization testing before use. Concurrent edits of the same task or opportunity currently use last-writer-wins behavior. Keep JSON backups of important workspace data.
