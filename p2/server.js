import 'dotenv/config';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import session from 'express-session';
import helmet from 'helmet';
import multer from 'multer';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 3001);
const sessionSecret = process.env.SESSION_SECRET;

if (isProduction && (!sessionSecret || sessionSecret.length < 32)) {
  throw new Error('SESSION_SECRET must contain at least 32 characters in production.');
}

if (!sessionSecret) {
  console.warn('SESSION_SECRET is unset; using an ephemeral development secret.');
}

const dataDir = path.join(currentDir, 'data');
const uploadsDir = path.join(dataDir, 'uploads');
mkdirSync(dataDir, { recursive: true });
mkdirSync(uploadsDir, { recursive: true });

const db = new Database(path.join(dataDir, 'app.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
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

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    team TEXT NOT NULL DEFAULT 'Workspace',
    due_date TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    due_date TEXT,
    completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    ends_at TEXT,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    uploaded_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    sender_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    actor_id TEXT NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    target TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON tasks(due_date);
  CREATE INDEX IF NOT EXISTS events_starts_at_idx ON events(starts_at);
  CREATE INDEX IF NOT EXISTS activities_created_at_idx ON activities(created_at);
  CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at);
`);
const userColumns = db.pragma('table_info(users)').map((column) => column.name);
if (!userColumns.includes('role')) db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'");
if (!userColumns.includes('display_name')) db.exec('ALTER TABLE users ADD COLUMN display_name TEXT');
if (!userColumns.includes('phone_number')) db.exec('ALTER TABLE users ADD COLUMN phone_number TEXT');
if (!userColumns.includes('address')) db.exec('ALTER TABLE users ADD COLUMN address TEXT');
if (!userColumns.includes('avatar_url')) db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT');
db.exec(`
  UPDATE users
  SET display_name = CASE
    WHEN email LIKE 'admin@%' THEN 'Workspace Admin'
    WHEN email LIKE 'member%@%' THEN 'Team Member'
    ELSE substr(email, 1, instr(email, '@') - 1)
  END
  WHERE display_name IS NULL OR trim(display_name) = '';
`);

const seedProjects = db.prepare(
  'INSERT INTO projects (id, name, team, due_date, status, created_by) VALUES (?, ?, ?, ?, ?, ?)',
);
if (db.prepare('SELECT COUNT(*) AS count FROM projects').get().count === 0) {
  const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1").get();
  if (admin) {
    const dayOffset = (days) => {
      const date = new Date();
      date.setDate(date.getDate() + days);
      return date.toISOString().slice(0, 10);
    };
    const todayAt = (hour, minute) => {
      const date = new Date();
      date.setHours(hour, minute, 0, 0);
      return date.toISOString();
    };
    const projectRows = [
      { id: randomUUID(), name: 'Website redesign', team: 'Design team', due: dayOffset(10) },
      { id: randomUUID(), name: 'Mobile app launch', team: 'Product team', due: dayOffset(19) },
      { id: randomUUID(), name: 'Brand guidelines', team: 'Marketing', due: dayOffset(4) },
    ];
    const seedWorkspace = db.transaction(() => {
      projectRows.forEach((project) =>
        seedProjects.run(project.id, project.name, project.team, project.due, 'active', admin.id),
      );
      const insertTask = db.prepare(
        'INSERT INTO tasks (id, title, project_id, due_date, completed, created_by, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      );
      const seededTasks = [
        ['Review homepage wireframes', 0, dayOffset(0), 0],
        ['Prepare sprint planning notes', 1, dayOffset(0), 0],
        ['Share updated brand assets', 2, dayOffset(1), 1],
        ['Finalize mobile onboarding flow', 1, dayOffset(4), 0],
      ];
      seededTasks.forEach(([title, projectIndex, dueDate, completed]) =>
        insertTask.run(
          randomUUID(),
          title,
          projectRows[projectIndex].id,
          dueDate,
          completed,
          admin.id,
          completed ? new Date().toISOString() : null,
        ),
      );
      const insertEvent = db.prepare(
        'INSERT INTO events (id, title, starts_at, ends_at, project_id, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      );
      [
        ['Design sync', todayAt(9, 0), 0],
        ['Product stand-up', todayAt(11, 30), 1],
        ['Brand review', todayAt(14, 0), 2],
      ].forEach(([title, startsAt, projectIndex]) =>
        insertEvent.run(
          randomUUID(),
          title,
          startsAt,
          new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString(),
          projectRows[projectIndex].id,
          admin.id,
        ),
      );
    });
    seedWorkspace();
  }
}
const seedAdmin = db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1").get();
if (seedAdmin && db.prepare('SELECT COUNT(*) AS count FROM activities').get().count === 0) {
  const insertActivity = db.prepare(
    'INSERT INTO activities (id, actor_id, action, target) VALUES (?, ?, ?, ?)',
  );
  db.prepare('SELECT name FROM projects ORDER BY created_at LIMIT 3').all().forEach(({ name }) =>
    insertActivity.run(randomUUID(), seedAdmin.id, 'created project', name),
  );
}
if (seedAdmin && db.prepare('SELECT COUNT(*) AS count FROM messages').get().count === 0) {
  db.prepare('INSERT INTO messages (id, content, sender_id) VALUES (?, ?, ?)').run(
    randomUUID(),
    'Welcome to the workspace! Share project updates and questions with the team here.',
    seedAdmin.id,
  );
}

class SqliteSessionStore extends session.Store {
  constructor(database) {
    super();
    this.database = database;
    this.getStatement = database.prepare(
      'SELECT data FROM sessions WHERE sid = ? AND expires_at > ?',
    );
    this.setStatement = database.prepare(`
      INSERT INTO sessions (sid, data, expires_at) VALUES (?, ?, ?)
      ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at
    `);
    this.deleteStatement = database.prepare('DELETE FROM sessions WHERE sid = ?');
    this.pruneStatement = database.prepare('DELETE FROM sessions WHERE expires_at <= ?');
  }

  get(sid, callback) {
    try {
      this.pruneStatement.run(Date.now());
      const row = this.getStatement.get(sid, Date.now());
      callback(null, row ? JSON.parse(row.data) : null);
    } catch (error) {
      callback(error);
    }
  }

  set(sid, sessionData, callback = () => {}) {
    try {
      const expiresAt = sessionData.cookie?.expires
        ? new Date(sessionData.cookie.expires).getTime()
        : Date.now() + 24 * 60 * 60 * 1000;
      this.setStatement.run(sid, JSON.stringify(sessionData), expiresAt);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  touch(sid, sessionData, callback = () => {}) {
    this.set(sid, sessionData, callback);
  }

  destroy(sid, callback = () => {}) {
    try {
      this.deleteStatement.run(sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }
}

const app = express();
app.disable('x-powered-by');
if (isProduction) app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(
  session({
    name: 'project.sid',
    secret: sessionSecret || randomBytes(32).toString('hex'),
    store: new SqliteSessionStore(db),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isValidEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sessionUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.display_name,
    phoneNumber: user.phone_number || '',
    address: user.address || '',
    avatarUrl: user.avatar_url || '',
  };
}

function requireSignedIn(req, res, next) {
  if (!req.session.userId) {
    res.status(401).json({ error: 'Please sign in to continue.' });
    return;
  }
  const user = db
    .prepare('SELECT id, email, role, display_name, phone_number, address, avatar_url FROM users WHERE id = ?')
    .get(req.session.userId);
  if (!user) {
    res.status(401).json({ error: 'Your session is no longer valid. Please sign in again.' });
    return;
  }
  req.user = user;
  next();
}

function logActivity(actorId, action, target) {
  db.prepare('INSERT INTO activities (id, actor_id, action, target) VALUES (?, ?, ?, ?)').run(
    randomUUID(),
    actorId,
    action,
    target,
  );
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

function setSessionLifetime(req, remember) {
  const day = 24 * 60 * 60 * 1000;
  req.session.cookie.maxAge = remember === true ? 30 * day : day;
}

function normalizePhoneNumber(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().replace(/[\s-]/g, '');
  return normalized.length <= 32 ? normalized : normalized.slice(0, 32);
}

function normalizeAddress(value) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, 200);
}

function normalizeAvatarUrl(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed) || /^data:image\//i.test(trimmed)) {
    return trimmed.slice(0, 2048);
  }
  return '';
}

app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) {
    res.json({ user: null });
    return;
  }

  const user = db.prepare('SELECT id, email, role, display_name, phone_number, address, avatar_url FROM users WHERE id = ?').get(req.session.userId);
  if (!user) {
    req.session.destroy((error) => {
      if (error) {
        res.status(500).json({ error: 'Could not clear the invalid session.' });
        return;
      }
      res.clearCookie('project.sid');
      res.json({ user: null });
    });
    return;
  }

  res.json({ user: sessionUser(user) });
});

app.post('/api/auth/signup', authLimiter, async (req, res, next) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Enter a valid email address.' });
    return;
  }
  if (
    typeof password !== 'string' ||
    password.length < 8 ||
    Buffer.byteLength(password, 'utf8') > 72
  ) {
    res.status(400).json({ error: 'Password must be 8–72 characters long.' });
    return;
  }

  try {
    const user = {
      id: randomBytes(16).toString('hex'),
      email,
      role: 'member',
      displayName: email.slice(0, email.indexOf('@')),
    };
    const passwordHash = await bcrypt.hash(password, 12);
    try {
      db.prepare('INSERT INTO users (id, email, password_hash, role, display_name) VALUES (?, ?, ?, ?, ?)').run(
        user.id,
        user.email,
        passwordHash,
        'member',
        user.displayName,
      );
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        res.status(409).json({ error: 'An account with this email already exists.' });
        return;
      }
      throw error;
    }

    await regenerateSession(req);
    req.session.userId = user.id;
    setSessionLifetime(req, req.body?.remember);
    await saveSession(req);
    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', authLimiter, async (req, res, next) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  const user = db
    .prepare('SELECT id, email, password_hash, role, display_name FROM users WHERE email = ? COLLATE NOCASE')
    .get(email);

  try {
    const validPassword =
      typeof password === 'string' &&
      Buffer.byteLength(password, 'utf8') <= 72 &&
      user &&
      (await bcrypt.compare(password, user.password_hash));
    if (!validPassword) {
      res.status(401).json({ error: 'Email or password is incorrect.' });
      return;
    }

    await regenerateSession(req);
    req.session.userId = user.id;
    setSessionLifetime(req, req.body?.remember);
    await saveSession(req);
    res.json({ user: sessionUser(user) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/projects', requireSignedIn, (_req, res) => {
  const projects = db.prepare(`
    SELECT p.id, p.name, p.team, p.due_date AS dueDate, p.status,
      p.created_at AS createdAt,
      COUNT(t.id) AS taskCount,
      COALESCE(SUM(t.completed), 0) AS completedTasks,
      CASE WHEN COUNT(t.id) = 0 THEN 0
        ELSE ROUND(100.0 * SUM(t.completed) / COUNT(t.id)) END AS progress
    FROM projects p
    LEFT JOIN tasks t ON t.project_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all();
  res.json({ projects });
});

app.post('/api/projects', requireSignedIn, (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const team = typeof req.body?.team === 'string' ? req.body.team.trim() : 'Workspace';
  const dueDate = req.body?.dueDate || null;
  if (!name || name.length > 100 || team.length > 80) {
    res.status(400).json({ error: 'Project name and team must be valid.' });
    return;
  }
  if (dueDate !== null && !isValidDate(dueDate)) {
    res.status(400).json({ error: 'Enter a valid project due date.' });
    return;
  }

  const project = {
    id: randomUUID(),
    name,
    team: team || 'Workspace',
    dueDate,
    status: 'active',
    taskCount: 0,
    completedTasks: 0,
    progress: 0,
  };
  db.prepare(
    'INSERT INTO projects (id, name, team, due_date, status, created_by) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(project.id, name, project.team, dueDate, project.status, req.user.id);
  logActivity(req.user.id, 'created project', name);
  res.status(201).json({ project });
});

app.get('/api/tasks', requireSignedIn, (_req, res) => {
  const tasks = db.prepare(`
    SELECT t.id, t.title, t.project_id AS projectId, p.name AS projectName,
      t.due_date AS dueDate, t.completed, t.created_at AS createdAt
    FROM tasks t
    LEFT JOIN projects p ON p.id = t.project_id
    ORDER BY t.completed ASC, t.due_date IS NULL, t.due_date, t.created_at DESC
  `).all().map((task) => ({ ...task, done: Boolean(task.completed) }));
  res.json({ tasks });
});

app.post('/api/tasks', requireSignedIn, (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const projectId = typeof req.body?.projectId === 'string' && req.body.projectId
    ? req.body.projectId
    : null;
  const dueDate = req.body?.dueDate || null;
  if (!title || title.length > 180) {
    res.status(400).json({ error: 'Task title must be between 1 and 180 characters.' });
    return;
  }
  if (dueDate !== null && !isValidDate(dueDate)) {
    res.status(400).json({ error: 'Enter a valid task due date.' });
    return;
  }
  if (projectId && !db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)) {
    res.status(400).json({ error: 'Select a project that exists in this workspace.' });
    return;
  }

  const task = {
    id: randomUUID(),
    title,
    projectId,
    projectName: projectId
      ? db.prepare('SELECT name FROM projects WHERE id = ?').get(projectId).name
      : null,
    dueDate,
    done: false,
    completed: 0,
  };
  db.prepare('INSERT INTO tasks (id, title, project_id, due_date, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(task.id, title, projectId, dueDate, req.user.id);
  logActivity(req.user.id, 'created task', title);
  res.status(201).json({ task });
});

app.patch('/api/tasks/:taskId', requireSignedIn, (req, res) => {
  if (typeof req.body?.done !== 'boolean') {
    res.status(400).json({ error: 'Task completion state must be true or false.' });
    return;
  }
  const task = db.prepare('SELECT id, title, completed FROM tasks WHERE id = ?').get(req.params.taskId);
  if (!task) {
    res.status(404).json({ error: 'Task not found.' });
    return;
  }
  const completedAt = req.body.done ? new Date().toISOString() : null;
  db.prepare('UPDATE tasks SET completed = ?, completed_at = ? WHERE id = ?')
    .run(Number(req.body.done), completedAt, task.id);
  if (Boolean(task.completed) !== req.body.done) {
    logActivity(req.user.id, req.body.done ? 'completed task' : 'reopened task', task.title);
  }
  res.json({ task: { ...task, done: req.body.done, completed: Number(req.body.done) } });
});

app.get('/api/events', requireSignedIn, (_req, res) => {
  const events = db.prepare(`
    SELECT e.id, e.title, e.starts_at AS startsAt, e.ends_at AS endsAt,
      e.project_id AS projectId, p.name AS projectName
    FROM events e
    LEFT JOIN projects p ON p.id = e.project_id
    ORDER BY e.starts_at
  `).all();
  res.json({ events });
});

app.post('/api/events', requireSignedIn, (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const startsAt = typeof req.body?.startsAt === 'string' ? Date.parse(req.body.startsAt) : NaN;
  const projectId = typeof req.body?.projectId === 'string' && req.body.projectId
    ? req.body.projectId
    : null;
  if (!title || title.length > 120 || !Number.isFinite(startsAt)) {
    res.status(400).json({ error: 'Enter an event name and a valid start time.' });
    return;
  }
  if (projectId && !db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)) {
    res.status(400).json({ error: 'Select a project that exists in this workspace.' });
    return;
  }
  const event = {
    id: randomUUID(),
    title,
    startsAt: new Date(startsAt).toISOString(),
    endsAt: req.body?.endsAt && Number.isFinite(Date.parse(req.body.endsAt))
      ? new Date(req.body.endsAt).toISOString()
      : null,
    projectId,
    projectName: projectId
      ? db.prepare('SELECT name FROM projects WHERE id = ?').get(projectId).name
      : null,
  };
  db.prepare('INSERT INTO events (id, title, starts_at, ends_at, project_id, created_by) VALUES (?, ?, ?, ?, ?, ?)')
    .run(event.id, event.title, event.startsAt, event.endsAt, projectId, req.user.id);
  logActivity(req.user.id, 'scheduled event', title);
  res.status(201).json({ event });
});

const allowedUploads = new Map([
  ['application/pdf', '.pdf'],
  ['text/plain', '.txt'],
  ['text/csv', '.csv'],
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedUploads.has(file.mimetype)) {
      callback(new Error('Unsupported file type. Upload PDF, TXT, CSV, PNG, JPG, WEBP, or DOCX.'));
      return;
    }
    callback(null, true);
  },
});

app.get('/api/files', requireSignedIn, (_req, res) => {
  const files = db.prepare(`
    SELECT f.id, f.original_name AS name, f.mime_type AS mimeType, f.size,
      f.created_at AS createdAt, u.display_name AS uploader
    FROM files f
    JOIN users u ON u.id = f.uploaded_by
    ORDER BY f.created_at DESC
  `).all();
  res.json({ files });
});

app.post('/api/files', requireSignedIn, upload.single('file'), async (req, res, next) => {
  if (!req.file) {
    res.status(400).json({ error: 'Choose a file to upload.' });
    return;
  }
  const id = randomUUID();
  const extension = allowedUploads.get(req.file.mimetype);
  const storedName = `${id}${extension}`;
  const originalName = path.basename(req.file.originalname).replace(/[\u0000-\u001f]/g, '').slice(0, 180);
  const file = {
    id,
    name: originalName || `upload${extension}`,
    mimeType: req.file.mimetype,
    size: req.file.size,
    uploader: req.user.display_name,
    createdAt: new Date().toISOString(),
  };
  try {
    await writeFile(path.join(uploadsDir, storedName), req.file.buffer, { flag: 'wx', mode: 0o600 });
    try {
      db.prepare(
        'INSERT INTO files (id, original_name, stored_name, mime_type, size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(id, file.name, storedName, file.mimeType, file.size, req.user.id);
    } catch (error) {
      await unlink(path.join(uploadsDir, storedName));
      throw error;
    }
    logActivity(req.user.id, 'uploaded file', file.name);
    res.status(201).json({ file });
  } catch (error) {
    next(error);
  }
});

app.get('/api/files/:fileId/download', requireSignedIn, (req, res, next) => {
  const file = db.prepare('SELECT original_name, stored_name FROM files WHERE id = ?')
    .get(req.params.fileId);
  if (!file) {
    res.status(404).json({ error: 'File not found.' });
    return;
  }
  res.download(path.join(uploadsDir, file.stored_name), file.original_name, (error) => {
    if (error && !res.headersSent) next(error);
  });
});

app.get('/api/messages', requireSignedIn, (_req, res) => {
  const messages = db.prepare(`
    SELECT m.id, m.content, m.created_at AS createdAt,
      u.id AS senderId, u.email AS senderEmail, u.display_name AS senderName
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    ORDER BY m.created_at DESC
    LIMIT 100
  `).all();
  res.json({ messages });
});

app.post('/api/messages', requireSignedIn, (req, res) => {
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  if (!content || content.length > 2000) {
    res.status(400).json({ error: 'Message must be between 1 and 2,000 characters.' });
    return;
  }
  const message = { id: randomUUID(), content, senderId: req.user.id, senderName: req.user.display_name, senderEmail: req.user.email, createdAt: new Date().toISOString() };
  db.prepare('INSERT INTO messages (id, content, sender_id) VALUES (?, ?, ?)').run(
    message.id,
    content,
    req.user.id,
  );
  logActivity(req.user.id, 'sent a message', content.slice(0, 80));
  res.status(201).json({ message });
});

app.get('/api/activity', requireSignedIn, (_req, res) => {
  const activity = db.prepare(`
    SELECT a.id, a.action, a.target, a.created_at AS createdAt,
      u.email AS actorEmail, u.display_name AS actorName
    FROM activities a
    JOIN users u ON u.id = a.actor_id
    ORDER BY a.created_at DESC
    LIMIT 50
  `).all();
  res.json({ activity });
});

app.get('/api/reports', requireSignedIn, (_req, res) => {
  const reports = {
    projectCount: db.prepare("SELECT COUNT(*) AS count FROM projects WHERE status = 'active'").get().count,
    taskCount: db.prepare('SELECT COUNT(*) AS count FROM tasks').get().count,
    completedTasks: db.prepare('SELECT COUNT(*) AS count FROM tasks WHERE completed = 1').get().count,
    upcomingTasks: db.prepare(
      "SELECT COUNT(*) AS count FROM tasks WHERE completed = 0 AND due_date >= date('now')",
    ).get().count,
    filesCount: db.prepare('SELECT COUNT(*) AS count FROM files').get().count,
    projects: db.prepare(`
      SELECT p.id, p.name,
        CASE WHEN COUNT(t.id) = 0 THEN 0
          ELSE ROUND(100.0 * SUM(t.completed) / COUNT(t.id)) END AS progress
      FROM projects p
      LEFT JOIN tasks t ON t.project_id = p.id
      WHERE p.status = 'active'
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `).all(),
  };
  reports.completionRate = reports.taskCount
    ? Math.round((reports.completedTasks / reports.taskCount) * 100)
    : 0;
  res.json({ reports });
});

app.patch('/api/profile', requireSignedIn, (req, res) => {
  const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
  const phoneNumber = normalizePhoneNumber(req.body?.phoneNumber);
  const address = normalizeAddress(req.body?.address);
  const avatarUrl = normalizeAvatarUrl(req.body?.avatarUrl);

  if (!displayName || displayName.length > 60) {
    res.status(400).json({ error: 'Display name must be between 1 and 60 characters.' });
    return;
  }
  if (phoneNumber && phoneNumber.length > 32) {
    res.status(400).json({ error: 'Phone number must be 32 characters or fewer.' });
    return;
  }
  if (address.length > 200) {
    res.status(400).json({ error: 'Address must be 200 characters or fewer.' });
    return;
  }

  db.prepare('UPDATE users SET display_name = ?, phone_number = ?, address = ?, avatar_url = ? WHERE id = ?').run(
    displayName,
    phoneNumber,
    address,
    avatarUrl,
    req.user.id,
  );

  const updatedUser = { ...req.user, display_name: displayName, phone_number: phoneNumber, address, avatar_url: avatarUrl };
  logActivity(req.user.id, 'updated profile', displayName);
  res.json({ user: sessionUser(updatedUser) });
});

app.post('/api/auth/logout', (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      next(error);
      return;
    }
    res.clearCookie('project.sid', {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
    });
    res.status(204).end();
  });
});

app.get('/api/members', requireSignedIn, (req, res) => {
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Only administrators can view the member list.' });
    return;
  }

  const members = db
    .prepare(`
      SELECT id, email, role, display_name AS displayName, created_at AS createdAt
      FROM users ORDER BY role, email
    `)
    .all();
  res.json({ members });
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

if (isProduction) {
  const distDir = path.join(currentDir, 'dist');
  app.use(express.static(distDir));
  app.get('/{*path}', (_req, res, next) => {
    res.sendFile(path.join(distDir, 'index.html'), (error) => {
      if (error) next(error);
    });
  });
}

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      error: error.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large. Maximum upload size is 10 MB.'
        : 'The file upload could not be processed.',
    });
    return;
  }
  if (error.message?.startsWith('Unsupported file type.')) {
    res.status(400).json({ error: error.message });
    return;
  }
  console.error(error);
  if (res.headersSent) return;
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

app.listen(port, () => {
  console.log(`Node.js server listening on http://localhost:${port}`);
});
