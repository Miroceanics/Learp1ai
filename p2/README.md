# Project login

React login page with a Node.js/Express API and SQLite database.

## Run locally

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env`.
3. Replace `SESSION_SECRET` with a random secret, for example:
   `openssl rand -hex 32`
4. Start the API and Vite: `npm run dev`
5. Open the Vite URL printed in the terminal.

The SQLite database is created at `data/app.sqlite`. It stores users and sessions; passwords are stored as bcrypt hashes. Registration and login use HTTP-only session cookies. The “Remember me” option sets a 30-day cookie; otherwise, the session cookie lasts one day.

New self-registered accounts are members. Create the five local demo accounts (one admin, four members) with `npm run seed:accounts`; the script prints randomly generated passwords once. Keep those credentials private and change them after sharing. Existing demo accounts are not overwritten if you run the command again.

After signing in, the workspace dashboard has 10 tabs: Overview, Projects, Tasks, Calendar, Files, Reports, Activity, Messages, Settings, and Members. Projects, tasks, calendar events, workspace messages, profile names, and activity are stored in SQLite. Reports are calculated from saved projects, tasks, and files. The Members tab shows account emails only to admins; its API checks the authenticated role server-side.

File uploads are stored privately under `data/uploads` and recorded in SQLite. Authenticated workspace users can upload and download PDF, TXT, CSV, PNG, JPG, WEBP, and DOCX files up to 10 MB. The starter projects, tasks, events, activity, and welcome message are inserted into an empty workspace database.

The API performs a backwards-compatible SQLite schema update when it starts. Back up `data/app.sqlite` and `data/uploads` before moving or replacing a workspace database.

For production, set `NODE_ENV=production`, use a strong `SESSION_SECRET` of at least 32 characters, run `npm run build`, and start the server with `npm start`. Express serves the built React app and API from the same origin. Deploy behind HTTPS because production session cookies are marked secure.

This setup provides email/password signup, login, and logout. Password reset emails and Google/GitHub sign-in are not included; they require an email delivery service or an OAuth provider configuration. The calendar, messages, and file library are shared workspace features rather than individual private copies.
