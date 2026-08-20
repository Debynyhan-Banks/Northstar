# Google Apps Script connection

The intake is already wired to a replaceable submission provider. To enable
Google Sheets storage, Drive uploads, and Gmail notifications:

1. Create a Google Sheet and a Drive folder.
2. Create an Apps Script project and paste in `Code.gs`.
3. Add these Script Properties:
   - `SHEET_ID`
   - `DRIVE_FOLDER_ID`
   - `NOTIFICATION_EMAIL`
4. Deploy the script as a web app that executes as the owner and accepts
   requests from anyone with the URL.
5. Add the deployment URL to the hosted site as
   `APPS_SCRIPT_WEB_APP_URL`.

Until that value is configured, the site uses its explicit preview mode:
clients can complete the full flow and download the normalized JSON, but it
does not claim that email or cloud storage occurred.
