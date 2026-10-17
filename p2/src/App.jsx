import React, { useEffect, useMemo, useState } from 'react';

const tabs = [
  { id: 'overview', label: 'Overview', mark: 'OV', icon: 'overview' },
  { id: 'projects', label: 'Projects', mark: 'PR', icon: 'projects' },
  { id: 'tasks', label: 'Tasks', mark: 'TK', icon: 'tasks' },
  { id: 'calendar', label: 'Calendar', mark: 'CA', icon: 'calendar' },
  { id: 'files', label: 'Files', mark: 'FI', icon: 'files' },
  { id: 'reports', label: 'Reports', mark: 'RE', icon: 'reports' },
  { id: 'activity', label: 'Activity', mark: 'AC', icon: 'activity' },
  { id: 'messages', label: 'Messages', mark: 'MS', icon: 'messages' },
  { id: 'settings', label: 'Settings', mark: 'SE', icon: 'settings' },
  { id: 'members', label: 'Members', mark: 'ME', icon: 'members' },
];

const emptyReports = {
  projectCount: 0,
  taskCount: 0,
  completedTasks: 0,
  upcomingTasks: 0,
  filesCount: 0,
  completionRate: 0,
  projects: [],
};

async function apiRequest(path, { method = 'GET', body, formData } = {}) {
  const response = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'same-origin',
    body: body ? JSON.stringify(body) : formData,
  });

  if (response.status === 204) return {};
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed.');
  return result;
}

function PageHeading({ eyebrow = 'YOUR WORKSPACE', title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {action}
    </div>
  );
}

function Avatar({ initials, color = 'blue', small = false, imageUrl = '' }) {
  if (imageUrl) {
    return <span className={`avatar avatar-${color}${small ? ' avatar-small' : ''}`}><img src={imageUrl} alt="" /></span>;
  }
  return <span className={`avatar avatar-${color}${small ? ' avatar-small' : ''}`}>{initials}</span>;
}

function formatDate(value, options = { month: 'short', day: 'numeric' }) {
  if (!value) return 'No date';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? 'No date' : date.toLocaleDateString(undefined, options);
}

function formatDateTime(value) {
  if (!value) return 'Time not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Time not set'
    : date.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function relativeTime(value) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (!Number.isFinite(minutes) || minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
}

function SidebarIcon({ name }) {
  const commonProps = {
    className: 'nav-icon',
    viewBox: '0 0 24 24',
    'aria-hidden': true,
    focusable: 'false',
  };

  switch (name) {
    case 'overview':
      return (
        <svg {...commonProps}><path d="M4 10.5 12 4l8 6.5V18a2 2 0 0 1-2 2h-3v-7H9v7H6a2 2 0 0 1-2-2v-7.5Z" /><path d="M9 20v-7h6v7" /></svg>
      );
    case 'projects':
      return (
        <svg {...commonProps}><rect x="3.5" y="4.5" width="17" height="13" rx="2.5" /><path d="M8 4.5v13M3.5 9.5h17" /></svg>
      );
    case 'tasks':
      return (
        <svg {...commonProps}><path d="M9 6.5h10" /><path d="M9 12h10" /><path d="M9 17.5h10" /><path d="m4 6.5 1.1 1.1L7.5 5" /><path d="m4 12 1.1 1.1L7.5 10.5" /><path d="m4 17.5 1.1 1.1L7.5 16" /></svg>
      );
    case 'calendar':
      return (
        <svg {...commonProps}><rect x="3.5" y="5.5" width="17" height="15" rx="2.5" /><path d="M7.5 3.5v4M16.5 3.5v4M3.5 9.5h17" /><path d="M8 13h3v3H8z" /></svg>
      );
    case 'files':
      return (
        <svg {...commonProps}><path d="M15 4.5H7.5A2.5 2.5 0 0 0 5 7v10a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 19 17V8.5L15 4.5Z" /><path d="M15 4.5v4h4" /><path d="M8.5 13h7M8.5 16h7" /></svg>
      );
    case 'reports':
      return (
        <svg {...commonProps}><path d="M5 18.5V9.5M12 18.5V5.5M19 18.5v-8" /><path d="M3.5 18.5h17" /></svg>
      );
    case 'activity':
      return (
        <svg {...commonProps}><path d="M3.5 13.5h4l2.2-6 3.9 11 2.2-6h5.7" /></svg>
      );
    case 'messages':
      return (
        <svg {...commonProps}><path d="M6 18.5V7.5A2.5 2.5 0 0 1 8.5 5h7A2.5 2.5 0 0 1 18 7.5v6A2.5 2.5 0 0 1 15.5 16H9l-3 2.5Z" /><path d="M8.5 9.5h7M8.5 12.5h5" /></svg>
      );
    case 'settings':
      return (
        <svg {...commonProps}><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.8 1.8 0 1 1-2.5 2.5l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V19a1.8 1.8 0 1 1-3.6 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1A1.8 1.8 0 1 1 7.2 16l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H6.4a1.8 1.8 0 1 1 0-3.6h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1A1.8 1.8 0 1 1 9.7 6.4l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V5.6a1.8 1.8 0 1 1 3.6 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1A1.8 1.8 0 1 1 17.8 9l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2a1.8 1.8 0 1 1 0 3.6h-.2a1 1 0 0 0-.9.6Z" /></svg>
      );
    case 'members':
      return (
        <svg {...commonProps}><path d="M16.5 18.5v-1a3.5 3.5 0 0 0-3.5-3.5H9A3.5 3.5 0 0 0 5.5 17.5v1" /><circle cx="12" cy="8.2" r="3.2" /><path d="M18.5 9.8a2.8 2.8 0 0 1 0 5.4" /><path d="M5.5 9.8a2.8 2.8 0 0 0 0 5.4" /></svg>
      );
    default:
      return <svg {...commonProps}><circle cx="12" cy="12" r="7.5" /></svg>;
  }
}

function ProjectRow({ project }) {
  const color = ['blue', 'green', 'blue'][project.name.length % 3];
  return (
    <div className="project-row">
      <span className={`project-mark project-${color}`}>{project.name.slice(0, 1).toUpperCase()}</span>
      <div className="project-info">
        <div className="project-name-line"><strong>{project.name}</strong><span>Due {formatDate(project.dueDate)}</span></div>
        <div className="project-meta"><span>{project.team}</span><span>{project.progress}%</span></div>
        <div className="progress-track"><span className={`progress-${color}`} style={{ width: `${project.progress}%` }} /></div>
      </div>
    </div>
  );
}

function ActivityList({ items, compact = false }) {
  const visibleItems = compact ? items.slice(0, 3) : items;
  if (!visibleItems.length) return <p className="empty-state">No activity yet. Updates will appear here.</p>;
  return (
    <div className={`activity-list${compact ? ' activity-list-compact' : ''}`}>
      {visibleItems.map((item) => (
        <div className="activity-item" key={item.id}>
          <Avatar initials={initials(item.actorName)} color="blue" small />
          <div className="activity-copy">
            <p><strong>{item.actorName}</strong> {item.action} <b>{item.target}</b></p>
            <span>{relativeTime(item.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function OverviewPanel({ user, projects, tasks, reports, activity, overviewView, onOverviewViewChange, onSelectTab, onNewProject }) {
  const weekLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  const pendingTasks = tasks.filter((task) => !task.done).slice(0, 4);

  return (
    <>
      <PageHeading
        eyebrow={weekLabel}
        title={`Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}, ${user.displayName || user.email.split('@')[0]}`}
        description="Here's what's happening across your workspace today."
        action={<button className="primary-action" type="button" onClick={onNewProject}>＋ <span>New project</span></button>}
      />

      <div className="overview-switcher" aria-label="Overview quick filters">
        {['all', 'projects', 'tasks', 'activity'].map((option) => (
          <button
            key={option}
            type="button"
            className={`switch-pill${overviewView === option ? ' switch-pill-active' : ''}`}
            onClick={() => onOverviewViewChange(option)}
          >
            {option === 'all' ? 'All' : option.charAt(0).toUpperCase() + option.slice(1)}
          </button>
        ))}
      </div>

      <div className="stats-grid">
        <article className={`metric-card${overviewView === 'all' || overviewView === 'projects' ? ' metric-card-active' : ''}`}><div className="metric-top"><span className="metric-icon metric-blue">PR</span><span className="metric-neutral">Workspace</span></div><p>Active projects</p><strong>{reports.projectCount}</strong><span className="metric-foot">in this workspace</span></article>
        <article className={`metric-card${overviewView === 'all' || overviewView === 'tasks' ? ' metric-card-active' : ''}`}><div className="metric-top"><span className="metric-icon metric-blue">TK</span><span className="metric-neutral">All projects</span></div><p>Tasks completed</p><strong>{reports.completedTasks}<span className="metric-unit"> / {reports.taskCount}</span></strong><span className="metric-foot">persisted workspace tasks</span></article>
        <article className={`metric-card${overviewView === 'all' ? ' metric-card-active' : ''}`}><div className="metric-top"><span className="metric-icon metric-green">TM</span><span className="metric-neutral">Completion</span></div><p>Task progress</p><strong>{reports.completionRate}%</strong><span className="metric-foot">based on completed tasks</span></article>
        <article className={`metric-card${overviewView === 'all' || overviewView === 'activity' ? ' metric-card-active' : ''}`}><div className="metric-top"><span className="metric-icon metric-orange">DU</span><span className="metric-warning">Remaining</span></div><p>Upcoming tasks</p><strong>{reports.upcomingTasks}</strong><span className="metric-foot">{reports.filesCount} shared files</span></article>
      </div>

      <div className="content-grid">
        {(overviewView === 'all' || overviewView === 'projects') && (
          <section className="panel project-overview">
            <div className="panel-heading"><div><h2>Project progress</h2><p>Progress is calculated from project tasks.</p></div><button className="subtle-button" type="button" onClick={() => onSelectTab('projects')}>View all <span>→</span></button></div>
            <div className="project-list">{projects.slice(0, 4).map((project) => <ProjectRow key={project.id} project={project} />)}</div>
            {!projects.length && <p className="empty-state">No projects yet. Create one to get started.</p>}
          </section>
        )}

        {(overviewView === 'all' || overviewView === 'tasks') && (
          <section className="panel task-spotlight">
            <div className="panel-heading"><div><h2>Priority tasks</h2><p>Focused work waiting for your attention.</p></div><button className="subtle-button" type="button" onClick={() => onSelectTab('tasks')}>Open tasks <span>→</span></button></div>
            <div className="mini-task-list">
              {pendingTasks.length ? pendingTasks.map((task) => (
                <button key={task.id} type="button" className="mini-task-item" onClick={() => onSelectTab('tasks')}>
                  <span className="mini-task-title">{task.title}</span>
                  <span className="mini-task-meta">{task.projectName || 'No project'} · {formatDate(task.dueDate)}</span>
                </button>
              )) : <p className="empty-state">All caught up. Nothing urgent in the queue.</p>}
            </div>
          </section>
        )}

        {(overviewView === 'all' || overviewView === 'activity') && (
          <section className="panel activity-overview">
            <div className="panel-heading"><div><h2>Recent activity</h2><p>Latest workspace updates.</p></div><button className="icon-action" type="button" aria-label="Open activity" onClick={() => onSelectTab('activity')}>↗</button></div>
            <ActivityList items={activity} compact />
          </section>
        )}
      </div>
    </>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [files, setFiles] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activity, setActivity] = useState([]);
  const [reports, setReports] = useState(emptyReports);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', team: '', dueDate: '' });
  const [newTask, setNewTask] = useState({ title: '', projectId: '', dueDate: '' });
  const [newEvent, setNewEvent] = useState({ title: '', startsAt: '', projectId: '' });
  const [newMessage, setNewMessage] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [theme, setTheme] = useState(() => (
    localStorage.getItem('workspace-theme') === 'dark' ? 'dark' : 'light'
  ));
  const [overviewView, setOverviewView] = useState('all');
  const [memberFilter, setMemberFilter] = useState('all');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [settingsPrefs, setSettingsPrefs] = useState({
    notifications: true,
    compactMode: false,
    autoSave: true,
  });

  async function refreshWorkspace() {
    const [projectResult, taskResult, eventResult, fileResult, messageResult, activityResult, reportResult] =
      await Promise.all([
        apiRequest('/api/projects'),
        apiRequest('/api/tasks'),
        apiRequest('/api/events'),
        apiRequest('/api/files'),
        apiRequest('/api/messages'),
        apiRequest('/api/activity'),
        apiRequest('/api/reports'),
      ]);
    setProjects(projectResult.projects);
    setTasks(taskResult.tasks);
    setEvents(eventResult.events);
    setFiles(fileResult.files);
    setMessages(messageResult.messages);
    setActivity(activityResult.activity);
    setReports(reportResult.reports);
  }

  useEffect(() => {
    let isMounted = true;
    apiRequest('/api/auth/me')
      .then(({ user: currentUser }) => {
        if (isMounted) setUser(currentUser);
      })
      .catch((error) => {
        if (isMounted) setMessage(error.message);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let isMounted = true;
    setDisplayName(user.displayName || user.email.split('@')[0]);
    setPhoneNumber(user.phoneNumber || '');
    setAddress(user.address || '');
    setAvatarUrl(user.avatarUrl || '');
    refreshWorkspace().catch((error) => {
      if (isMounted) setMessage(error.message);
    });
    return () => { isMounted = false; };
  }, [user]);

  useEffect(() => {
    if (activeTab !== 'members' || user?.role !== 'admin') return undefined;
    let isMounted = true;
    setMembersLoading(true);
    setMembersError('');
    apiRequest('/api/members')
      .then(({ members: result }) => { if (isMounted) setMembers(result); })
      .catch((error) => { if (isMounted) setMembersError(error.message); })
      .finally(() => { if (isMounted) setMembersLoading(false); });
    return () => { isMounted = false; };
  }, [activeTab, user]);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsLoading(true);
    setMessage('');
    try {
      const result = await apiRequest(`/api/auth/${mode === 'signup' ? 'signup' : 'login'}`, {
        method: 'POST',
        body: { email, password, remember },
      });
      setUser(result.user);
      setPassword('');
      setActiveTab('overview');
      setMessage(mode === 'signup' ? 'Your account has been created.' : '');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    setMessage('');
    try {
      await apiRequest('/api/auth/logout', { method: 'POST', body: {} });
      setUser(null);
      setPassword('');
      setActiveTab('overview');
      setMembers([]);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('workspace-theme', nextTheme);
    setTheme(nextTheme);
  }

  async function runWorkspaceAction(action) {
    setBusy(true);
    setMessage('');
    try {
      await action();
      await refreshWorkspace();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function createProject(event) {
    event.preventDefault();
    await runWorkspaceAction(async () => {
      await apiRequest('/api/projects', { method: 'POST', body: newProject });
      setNewProject({ name: '', team: '', dueDate: '' });
      setShowProjectForm(false);
    });
  }

  async function createTask(event) {
    event.preventDefault();
    await runWorkspaceAction(async () => {
      await apiRequest('/api/tasks', { method: 'POST', body: newTask });
      setNewTask({ title: '', projectId: '', dueDate: '' });
    });
  }

  async function toggleTask(task) {
    await runWorkspaceAction(async () => {
      await apiRequest(`/api/tasks/${encodeURIComponent(task.id)}`, {
        method: 'PATCH',
        body: { done: !task.done },
      });
    });
  }

  async function createEvent(event) {
    event.preventDefault();
    await runWorkspaceAction(async () => {
      await apiRequest('/api/events', {
        method: 'POST',
        body: {
          ...newEvent,
          startsAt: new Date(newEvent.startsAt).toISOString(),
          endsAt: null,
        },
      });
      setNewEvent({ title: '', startsAt: '', projectId: '' });
    });
  }

  async function uploadFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      await apiRequest('/api/files', { method: 'POST', formData });
      await refreshWorkspace();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    await runWorkspaceAction(async () => {
      await apiRequest('/api/messages', { method: 'POST', body: { content: newMessage } });
      setNewMessage('');
    });
  }

  async function saveProfile(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const { user: updatedUser } = await apiRequest('/api/profile', {
        method: 'PATCH',
        body: { displayName, phoneNumber, address, avatarUrl },
      });
      setUser(updatedUser);
      await refreshWorkspace();
      setMessage('Profile updated.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  const pendingTasks = tasks.filter((task) => !task.done);
  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    return members.filter((member) => {
      const matchesSearch = !query || member.email.toLowerCase().includes(query) || (member.displayName || '').toLowerCase().includes(query);
      const matchesRole = memberFilter === 'all' || member.role === memberFilter;
      return matchesSearch && matchesRole;
    });
  }, [members, memberSearch, memberFilter]);

  useEffect(() => {
    if (!filteredMembers.length) {
      if (selectedMemberId) setSelectedMemberId('');
      return;
    }
    if (!selectedMemberId || !filteredMembers.some((member) => member.id === selectedMemberId)) {
      setSelectedMemberId(filteredMembers[0].id);
    }
  }, [filteredMembers, selectedMemberId]);

  const selectedMember = filteredMembers.find((member) => member.id === selectedMemberId) || members.find((member) => member.id === selectedMemberId) || null;
  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects.filter((project) => !query || project.name.toLowerCase().includes(query) || project.team.toLowerCase().includes(query));
  }, [projects, search]);
  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => !query || task.title.toLowerCase().includes(query) || (task.projectName || '').toLowerCase().includes(query));
  }, [tasks, search]);
  const filteredFiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return files.filter((file) => !query || file.name.toLowerCase().includes(query));
  }, [files, search]);

  if (isLoading && !user) {
    return <main className="login-card"><section className="form-panel"><p className="subtitle" role="status">Loading your session…</p></section></main>;
  }

  if (!user) {
    return (
      <main className="login-card">
        <section className="brand-panel">
          <div className="brand-header"><div className="brand-mark">P</div><span>Project</span></div>
          <div className="hero">
            <h1>Track your work smarter.</h1>
            <p>Turn ideas into action with a workspace built for focus, clarity, and creative momentum.</p>
            <div className="stat-row"><div className="stat"><strong>10k+</strong><span>users</span></div><div className="stat"><strong>24/7</strong><span>support</span></div></div>
          </div>
        </section>
        <section className="form-panel">
          <div className="form-box">
            <h2>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
            <p className="subtitle">{mode === 'signup' ? 'Sign up to get started with your workspace.' : 'Sign in to continue to your dashboard.'}</p>
            <form onSubmit={handleSubmit}>
              <div className="field"><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" placeholder="name@example.com" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
              <div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder="At least 8 characters" minLength={8} maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
              <div className="row"><label className="remember"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span>Remember me</span></label><span className="session-hint">Secure session</span></div>
              <button type="submit" disabled={isLoading}>{isLoading ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button>
            </form>
            {message && <p className="message" role="status" aria-live="polite">{message}</p>}
            <div className="signup">{mode === 'signup' ? 'Already have an account?' : 'New here?'}{' '}<button className="text-button" type="button" onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setMessage(''); }} disabled={isLoading}>{mode === 'signup' ? 'Sign in' : 'Create an account'}</button></div>
          </div>
        </section>
      </main>
    );
  }

  const currentTab = tabs.find((tab) => tab.id === activeTab);
  const memberCount = members.length;
  const unreadCount = messages.filter((item) => item.senderId !== user.id).length;
  const today = new Date().toISOString().slice(0, 10);
  const todayEvents = events.filter((event) => event.startsAt.slice(0, 10) === today);

  return (
    <main className="dashboard-shell" data-theme={theme}>
      <aside className="sidebar">
        <a className="brand-header dashboard-brand" href="#overview" onClick={(event) => { event.preventDefault(); setActiveTab('overview'); }}><span className="brand-mark">P</span><span>Project</span></a>
        <p className="sidebar-label">WORKSPACE</p>
        <nav className="tab-list" role="tablist" aria-label="Dashboard sections" aria-orientation="vertical">
          {tabs.map((tab) => (
            <button className={`nav-tab${activeTab === tab.id ? ' nav-tab-active' : ''}`} id={`tab-${tab.id}`} key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls={`panel-${tab.id}`} onClick={() => { setActiveTab(tab.id); setMessage(''); }}>
              <span className={`nav-mark${activeTab === tab.id ? ' nav-mark-active' : ''}`}><SidebarIcon name={tab.icon} /></span>
              <span>{tab.label}</span>
              {tab.id === 'messages' && unreadCount > 0 && <span className="nav-count">{unreadCount}</span>}
              {tab.id === 'members' && user.role === 'admin' && memberCount > 0 && <span className="nav-count">{memberCount}</span>}
            </button>
          ))}
        </nav>
        <button className="sidebar-logout" type="button" onClick={handleSignOut} disabled={busy}>
          <span aria-hidden="true">↪</span>{busy ? 'Logging out…' : 'Log out'}
        </button>
        <div className="sidebar-bottom">
          <div className="upgrade-card"><span className="upgrade-icon">✦</span><strong>Make more progress</strong><p>Keep all your projects moving in one place.</p><button type="button" onClick={() => setActiveTab('projects')}>Explore projects <span>→</span></button></div>
          <div className="sidebar-user"><Avatar initials={initials(user.displayName || user.email)} imageUrl={user.avatarUrl} /><div className="sidebar-user-info"><strong>{user.displayName || user.email.split('@')[0]}</strong><span>{user.role === 'admin' ? 'Administrator' : 'Member'}</span></div></div>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><span className="breadcrumb-separator">/</span><strong>{currentTab?.label}</strong></div>
          <div className="topbar-actions"><label className="search-box"><span>⌕</span><input type="search" placeholder="Search projects, tasks, files..." aria-label="Search workspace" value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>⌘ K</kbd></label><button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} aria-pressed={theme === 'dark'} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>{theme === 'dark' ? '☀' : '☾'}</button><span className="topbar-avatar" title={user.email}>{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials(user.displayName || user.email)}</span></div>
        </header>

        <div className="dashboard-content" id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
          {activeTab === 'overview' && <OverviewPanel user={user} projects={projects} tasks={tasks} reports={reports} activity={activity} overviewView={overviewView} onOverviewViewChange={setOverviewView} onSelectTab={setActiveTab} onNewProject={() => { setActiveTab('projects'); setShowProjectForm(true); }} />}

          {activeTab === 'projects' && <>
            <PageHeading title="Projects" description="Manage and track progress across your team's projects." action={<button className="primary-action" type="button" onClick={() => setShowProjectForm((shown) => !shown)}>＋ <span>{showProjectForm ? 'Cancel' : 'New project'}</span></button>} />
            {message && <p className="message dashboard-message" role="status">{message}</p>}
            {showProjectForm && <form className="panel inline-form project-create-form" onSubmit={createProject}><label>Project name<input maxLength={100} value={newProject.name} onChange={(event) => setNewProject({ ...newProject, name: event.target.value })} required /></label><label>Team<input maxLength={80} placeholder="Workspace" value={newProject.team} onChange={(event) => setNewProject({ ...newProject, team: event.target.value })} /></label><label>Due date<input type="date" value={newProject.dueDate} onChange={(event) => setNewProject({ ...newProject, dueDate: event.target.value })} /></label><button className="primary-action" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Create project'}</button></form>}
            <div className="project-cards">{filteredProjects.map((project) => { const color = ['blue', 'green', 'blue'][project.name.length % 3]; return <article className="panel project-card" key={project.id}><div className={`project-mark project-${color}`}>{project.name.slice(0, 1).toUpperCase()}</div><span className="project-status"><i /> {project.status}</span><h2>{project.name}</h2><p>{project.team}</p><div className="project-card-progress"><div className="project-meta"><span>Progress · {project.completedTasks}/{project.taskCount} tasks</span><strong>{project.progress}%</strong></div><div className="progress-track"><span className={`progress-${color}`} style={{ width: `${project.progress}%` }} /></div></div><div className="project-card-footer"><span>{project.taskCount} tasks</span><span>Due {formatDate(project.dueDate, { month: 'short', day: 'numeric', year: 'numeric' })}</span></div></article>; })}</div>
            {!filteredProjects.length && <section className="panel empty-panel"><p>{search ? 'No projects match your search.' : 'No projects yet. Create one to get started.'}</p></section>}
          </>}

          {activeTab === 'tasks' && <>
            <PageHeading title="My tasks" description={`${pendingTasks.length} tasks left to complete. Updates are saved automatically.`} />
            {message && <p className="message dashboard-message" role="status">{message}</p>}
            <form className="panel inline-form task-create-form" onSubmit={createTask}><label>New task<input maxLength={180} placeholder="What needs to be done?" value={newTask.title} onChange={(event) => setNewTask({ ...newTask, title: event.target.value })} required /></label><label>Project<select value={newTask.projectId} onChange={(event) => setNewTask({ ...newTask, projectId: event.target.value })}><option value="">No project</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label><label>Due date<input type="date" value={newTask.dueDate} onChange={(event) => setNewTask({ ...newTask, dueDate: event.target.value })} /></label><button className="primary-action" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Add task'}</button></form>
            <section className="panel task-panel"><div className="panel-heading"><div><h2>Workspace tasks</h2><p>Check off tasks to update workspace progress and reports.</p></div><span className="table-count">{filteredTasks.length} tasks</span></div><div className="task-list">{filteredTasks.map((task) => <label className={`task-item${task.done ? ' task-done' : ''}`} key={task.id}><input type="checkbox" checked={task.done} disabled={busy} onChange={() => toggleTask(task)} /><span className="task-check" /><span className="task-title">{task.title}<small>{task.projectName || 'No project'}</small></span><span className="task-date">{formatDate(task.dueDate)}</span></label>)}</div>{!filteredTasks.length && <p className="empty-state">No tasks match your search.</p>}</section>
          </>}

          {activeTab === 'calendar' && <>
            <PageHeading title="Calendar" description="Schedule workspace events and see what's coming up." />
            {message && <p className="message dashboard-message" role="status">{message}</p>}
            <form className="panel inline-form event-create-form" onSubmit={createEvent}><label>Event title<input maxLength={120} placeholder="Team sync" value={newEvent.title} onChange={(event) => setNewEvent({ ...newEvent, title: event.target.value })} required /></label><label>Date and time<input type="datetime-local" value={newEvent.startsAt} onChange={(event) => setNewEvent({ ...newEvent, startsAt: event.target.value })} required /></label><label>Project<select value={newEvent.projectId} onChange={(event) => setNewEvent({ ...newEvent, projectId: event.target.value })}><option value="">No project</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label><button className="primary-action" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Add event'}</button></form>
            <section className="panel calendar-panel"><div className="panel-heading"><div><h2>Upcoming events</h2><p>{todayEvents.length} events today · saved in your workspace.</p></div><span className="table-count">{events.length} events</span></div>{events.length ? <div className="event-list">{events.map((event, index) => <article className={`saved-event event-tone-${index % 3}`} key={event.id}><span className="event-date">{formatDate(event.startsAt, { weekday: 'short', month: 'short', day: 'numeric' })}</span><div><strong>{event.title}</strong><span>{event.projectName || 'Workspace event'} · {formatDateTime(event.startsAt)}</span></div></article>)}</div> : <p className="empty-state">No events yet. Add an event to put it on the calendar.</p>}</section>
          </>}

          {activeTab === 'files' && <>
            <PageHeading title="Shared files" description="Upload and download files shared with your workspace." action={<label className="primary-action upload-action">{uploading ? 'Uploading…' : '↑ Upload file'}<input type="file" accept=".pdf,.txt,.csv,.png,.jpg,.jpeg,.webp,.docx" onChange={uploadFile} disabled={uploading} /></label>} />
            {message && <p className="message dashboard-message" role="status">{message}</p>}
            <section className="panel file-panel"><div className="panel-heading"><div><h2>All files</h2><p>Maximum 10 MB · PDF, TXT, CSV, PNG, JPG, WEBP, DOCX.</p></div><span className="table-count">{filteredFiles.length} files</span></div>{filteredFiles.length ? <div className="file-table"><div className="file-table-header"><span>Name</span><span>Uploaded by</span><span>Size</span><span>Last updated</span></div>{filteredFiles.map((file) => { const ext = file.name.split('.').pop().toUpperCase().slice(0, 3); return <div className="file-row" key={file.id}><span className="file-name"><i className={`file-type file-${ext.toLowerCase()}`}>{ext}</i><a href={`/api/files/${encodeURIComponent(file.id)}/download`}><strong>{file.name}</strong></a></span><span>{file.uploader}</span><span>{file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(0)} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`}</span><span>{formatDateTime(file.createdAt)}</span></div>; })}</div> : <p className="empty-state">{search ? 'No files match your search.' : 'No files uploaded yet.'}</p>}</section>
          </>}

          {activeTab === 'reports' && <>
            <PageHeading title="Reports" description="Workspace metrics calculated from your saved projects, tasks, and files." />
            <div className="stats-grid report-stats"><article className="metric-card"><p>Active projects</p><strong>{reports.projectCount}</strong><span className="metric-neutral">In this workspace</span></article><article className="metric-card"><p>Tasks completed</p><strong>{reports.completedTasks}<span className="metric-unit"> / {reports.taskCount}</span></strong><span className="metric-neutral">{reports.completionRate}% completion rate</span></article><article className="metric-card"><p>Upcoming tasks</p><strong>{reports.upcomingTasks}</strong><span className="metric-neutral">Open and due today or later</span></article><article className="metric-card"><p>Shared files</p><strong>{reports.filesCount}</strong><span className="metric-neutral">Saved in local storage</span></article></div>
            <section className="panel report-panel"><div className="panel-heading"><div><h2>Project completion</h2><p>Completion is based on completed tasks in each project.</p></div></div>{reports.projects.length ? <div className="report-bars">{reports.projects.map((project) => <div className="report-bar-row" key={project.id}><span>{project.name}</span><div className="progress-track"><span className="progress-blue" style={{ width: `${project.progress}%` }} /></div><strong>{project.progress}%</strong></div>)}</div> : <p className="empty-state">Create projects and tasks to see progress reports.</p>}</section>
          </>}

          {activeTab === 'activity' && <>
            <PageHeading title="Activity" description="Recent changes made by people in your workspace." />
            <section className="panel activity-panel"><div className="panel-heading"><div><h2>Workspace activity</h2><p>Project, task, file, profile, and message updates.</p></div></div><ActivityList items={activity} /></section>
          </>}

          {activeTab === 'messages' && <>
            <PageHeading title="Messages" description="Workspace messages are shared with your signed-in team." />
            {message && <p className="message dashboard-message" role="status">{message}</p>}
            <section className="panel messages-panel"><div className="message-list">{messages.map((item) => <article className={`message-thread${item.senderId === user.id ? ' own-message' : ''}`} key={item.id}><Avatar initials={initials(item.senderName)} /><div className="thread-content"><strong>{item.senderName}{item.senderId === user.id ? ' · You' : ''}</strong><span>{item.content}</span></div><span className="thread-time">{formatDateTime(item.createdAt)}</span></article>)}</div>{!messages.length && <p className="empty-state">No messages yet. Start the conversation.</p>}<form className="message-compose" onSubmit={sendMessage}><input maxLength={2000} placeholder="Write a message to your workspace..." value={newMessage} onChange={(event) => setNewMessage(event.target.value)} required /><button className="primary-action" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send'}</button></form></section>
          </>}

          {activeTab === 'settings' && <>
            <PageHeading title="Settings" description="Manage your profile and account details." />
            {message && <p className="message dashboard-message" role="status">{message}</p>}
            <form className="panel settings-panel" onSubmit={saveProfile}>
              <div className="panel-heading"><div><h2>Profile</h2><p>Your personal details appear across the workspace.</p></div></div>
              <div className="settings-profile">
                <Avatar initials={initials(displayName)} imageUrl={avatarUrl} />
                <div><strong>{displayName}</strong><span>{user.email}</span></div>
                <span className="settings-role">{user.role === 'admin' ? 'Administrator' : 'Member'}</span>
              </div>
              <div className="settings-grid">
                <label className="settings-input">Display name<input maxLength={60} value={displayName} onChange={(event) => setDisplayName(event.target.value)} required /></label>
                <label className="settings-input">Photo URL<input type="url" placeholder="https://example.com/avatar.jpg" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} /></label>
                <label className="settings-input">Phone number<input type="tel" placeholder="+62 812-3456-7890" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} maxLength={32} /></label>
                <label className="settings-input settings-address">Address<textarea rows="3" placeholder="Street, city, country" value={address} onChange={(event) => setAddress(event.target.value)} maxLength={200} /></label>
              </div>
              <div className="settings-field"><span>Email address</span><strong>{user.email}</strong></div>
              <div className="settings-field"><span>Account role</span><strong>{user.role === 'admin' ? 'Administrator' : 'Member'}</strong></div>
              <div className="settings-quick-actions">
                {[
                  { key: 'notifications', label: 'Notifications', helper: 'Task reminders and updates' },
                  { key: 'compactMode', label: 'Compact mode', helper: 'Tighter workspace spacing' },
                  { key: 'autoSave', label: 'Auto-save', helper: 'Save profile changes instantly' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`settings-toggle-row${settingsPrefs[item.key] ? ' is-on' : ''}`}
                    onClick={() => setSettingsPrefs((current) => ({ ...current, [item.key]: !current[item.key] }))}
                  >
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.helper}</small>
                    </span>
                    <span className="toggle-switch"><span className="toggle-knob" /></span>
                  </button>
                ))}
              </div>
              <div className="settings-actions"><button className="primary-action settings-save" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button><button className="secondary-action settings-signout" type="button" onClick={handleSignOut} disabled={busy}>Sign out</button></div>
            </form>
          </>}

          {activeTab === 'members' && <>
            <PageHeading title="Members" description="People with access to your Project workspace." action={user.role === 'admin' ? <span className="member-total">{members.length} people</span> : null} />
            {user.role !== 'admin' ? <section className="panel access-notice"><span className="access-mark">!</span><div><h2>Admin access required</h2><p>The member directory contains account emails and is only available to workspace administrators.</p></div></section> : (
              <section className="panel member-panel">
                <div className="panel-heading"><div><h2>Workspace members</h2><p>All people with an account in this workspace.</p></div><label className="member-search"><span>⌕</span><input type="search" placeholder="Search members..." aria-label="Search members" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} /></label></div>

                <div className="member-filter-bar" aria-label="Member role filter">
                  {['all', 'admin', 'member'].map((role) => (
                    <button
                      key={role}
                      type="button"
                      className={`filter-chip${memberFilter === role ? ' filter-chip-active' : ''}`}
                      onClick={() => setMemberFilter(role)}
                    >
                      {role === 'all' ? 'All' : role === 'admin' ? 'Admins' : 'Members'}
                    </button>
                  ))}
                </div>

                {membersLoading ? <p className="member-state" role="status">Loading members…</p> : membersError ? <p className="message" role="alert">{membersError}</p> : filteredMembers.length ? (
                  <div className="member-layout">
                    <div className="member-table">
                      <div className="member-table-header"><span>Member</span><span>Role</span><span>Joined</span><span>Status</span></div>
                      {filteredMembers.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          className={`member-row${selectedMemberId === member.id ? ' member-row-selected' : ''}`}
                          onClick={() => setSelectedMemberId(member.id)}
                        >
                          <span className="member-identity">
                            <Avatar initials={initials(member.displayName || member.email)} color={member.role === 'admin' ? 'blue' : 'blue'} small />
                            <span><strong>{member.displayName || member.email}</strong><small>{member.email}</small></span>
                          </span>
                          <span><i className={`role-dot role-${member.role}`} />{member.role === 'admin' ? 'Admin' : 'Member'}</span>
                          <span>{formatDate(member.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          <span className="member-active"><i /> Active</span>
                        </button>
                      ))}
                    </div>

                    {selectedMember && (
                      <aside className="member-detail-card">
                        <div className="member-detail-header">
                          <Avatar initials={initials(selectedMember.displayName || selectedMember.email)} color="blue" />
                          <div>
                            <strong>{selectedMember.displayName || selectedMember.email}</strong>
                            <span>{selectedMember.email}</span>
                          </div>
                        </div>
                        <div className="member-detail-stats">
                          <div><label>Role</label><strong>{selectedMember.role === 'admin' ? 'Administrator' : 'Member'}</strong></div>
                          <div><label>Joined</label><strong>{formatDate(selectedMember.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}</strong></div>
                        </div>
                        <button type="button" className="secondary-action">Message</button>
                      </aside>
                    )}
                  </div>
                ) : <p className="member-state">No members match “{memberSearch}”.</p>}
              </section>
            )}
          </>}

          <footer className="dashboard-footer"><span>© {new Date().getFullYear()} Project Workspace</span><span>Made for focused work <b>✦</b></span></footer>
        </div>
      </section>
    </main>
  );
}

export default App;
