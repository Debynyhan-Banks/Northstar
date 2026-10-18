# C.F. Mechanical — Business & Website Discovery

A mobile-friendly guided questionnaire created for the owner of C.F. Mechanical. This repository uses the existing Vinext build.

## Preview locally

Run `npm install` and `npm run dev`, then open the local URL in Chrome, Safari, Edge, or Firefox. The wizard has 9 steps (welcome, 7 topics, review), answer cards, automatic saving in the same browser, review, downloadable readable TXT or structured JSON responses, and Print / Save PDF.

## Publish as a website

Verify the target hosting project and its build and deployment settings before
publishing this Cloudflare-compatible Vinext application. The original ZIP also includes a standalone `index.html` and
`config.js` suitable for Cloudflare Pages Direct Upload.

## Receive submissions directly (important)

The site will NOT automatically send completed answers until you connect a submission provider. To connect a Formspree form:

1. Create a Formspree form in an account under your control and verify its destination mailbox. Review its privacy, retention, and plan limits before sending confidential content.
2. Copy the endpoint, e.g. `https://formspree.io/f/xxxxx`.
3. Put it in `public/config.js`:
   `window.CF_FORM_ENDPOINT = 'https://formspree.io/f/xxxxx';`
4. Redeploy the application and **test** by submitting a non-sensitive sample. Confirm it reaches the correct mailbox.
5. Share the link privately with the owner. Submissions use HTTPS after deployment. Avoid recording secrets or sensitive identifiers.

Without an endpoint, the final button downloads a readable text summary. Your partner can attach that file to an email/text and send it privately; the page never claims it was submitted.

## Data and privacy

* This application does not include access control. Anyone with its URL can open the questionnaire unless hosting access controls are configured.
* A draft is saved in localStorage on the device and browser the partner uses. It does not automatically sync between devices or users.
* The code does not use analytics, cookies, or external scripts. Hosting and any connected form provider may have their own logs/processing.
* Do not request or enter banking credentials, SSNs, or confidential customer/project drawings in this intake.
* Some partnership and cash-flow answers are sensitive business information. Share only through controlled channels.
* The form is an information-gathering tool; it does not create ownership rights, certify licensing or establish union signatory status.

## Customize

Modify `sections` in `app/intake-wizard.js` to change questions, option labels, service categories, or order. The local draft key is `cf-mechanical-intake-v1`; if you alter option values substantially, change the key to `v2` to prevent stale selections.

## Proposed follow-up

After receiving the answers, use them to create a formal two-founder operating plan: vision, positioning, service scope, GC target list, bid-readiness checklist, capital plan, partnership proposal, website brief, and 90-day launch schedule.

## Development in this repository

This repository preserves the existing Cloudflare-compatible Vinext build.
Run `npm install`, then `npm run dev` for local development. Run `npm test`
to build and check the server-rendered page. The questionnaire logic is in
`app/intake-wizard.js`; configure the optional submission endpoint in
`public/config.js`. Verify the target hosting configuration before deploying the built application. The standalone ZIP's direct-upload instructions apply to its
original `index.html` and `config.js`, not to this Vinext source tree.
