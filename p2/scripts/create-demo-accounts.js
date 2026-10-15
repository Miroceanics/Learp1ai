import 'dotenv/config';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(currentDir, '..', 'data');
mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'app.sqlite'));
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    display_name TEXT,
    phone_number TEXT,
    address TEXT,
    avatar_url TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

if (!db.pragma('table_info(users)').some((column) => column.name === 'role')) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'");
}
if (!db.pragma('table_info(users)').some((column) => column.name === 'display_name')) {
  db.exec('ALTER TABLE users ADD COLUMN display_name TEXT');
}
if (!db.pragma('table_info(users)').some((column) => column.name === 'phone_number')) {
  db.exec('ALTER TABLE users ADD COLUMN phone_number TEXT');
}
if (!db.pragma('table_info(users)').some((column) => column.name === 'address')) {
  db.exec('ALTER TABLE users ADD COLUMN address TEXT');
}
if (!db.pragma('table_info(users)').some((column) => column.name === 'avatar_url')) {
  db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT');
}

const accounts = [
  { email: 'admin@project.local', role: 'admin' },
  { email: 'member1@project.local', role: 'member' },
  { email: 'member2@project.local', role: 'member' },
  { email: 'member3@project.local', role: 'member' },
  { email: 'member4@project.local', role: 'member' },
];

const findUser = db.prepare('SELECT role FROM users WHERE email = ? COLLATE NOCASE');
const createUser = db.prepare(
  'INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)',
);
const createAccounts = db.transaction((newAccounts) => {
  for (const account of newAccounts) {
    createUser.run(
      randomBytes(16).toString('hex'),
      account.email,
      account.passwordHash,
      account.role,
    );
  }
});

const collisions = accounts.filter(({ email }) => findUser.get(email));
if (collisions.length) {
  db.close();
  console.error(
    `No accounts were created. These email addresses already exist: ${collisions
      .map(({ email }) => email)
      .join(', ')}. Remove or rename them before retrying.`,
  );
  process.exitCode = 1;
} else {
  const credentials = await Promise.all(
    accounts.map(async (account) => ({
      ...account,
      password: randomBytes(24).toString('base64url'),
      passwordHash: '',
    })),
  );
  for (const account of credentials) {
    account.passwordHash = await bcrypt.hash(account.password, 12);
  }
  createAccounts(credentials);
  db.close();

  console.log('Demo accounts created. Save these passwords; they will not be shown again.\n');
  console.table(credentials.map(({ email, role, password }) => ({ email, role, password })));
}
