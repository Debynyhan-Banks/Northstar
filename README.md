# Northstar Brief

Northstar Brief is a reusable, responsive client website intake. It collects
the business information clients reasonably know and produces a normalized,
AI-ready project brief.

## Included

- Six-step guided intake with conditional questions
- Local draft autosave and restoration
- Responsive, accessible form controls and focus management
- Repeatable services, FAQs, competitors, and inspiration sites
- Asset selection with 10-file and 15 MB per-file limits
- Editable review and professional confirmation screens
- Typed Zod schema and AI-context formatter
- Replaceable submission provider
- Google Sheets, Drive, and Gmail Apps Script integration

## Local development

```bash
npm install
npm run dev
```

Use `npm run build` for the production build or `npm test` for the build and
server-rendering checks.

## Connect Google storage and email

Follow `integrations/google-apps-script/README.md`, then set
`APPS_SCRIPT_WEB_APP_URL` in the hosting environment. Without it, the app is
explicitly in preview mode and offers a structured JSON download after the
intake is completed.
