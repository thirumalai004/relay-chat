const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STATUSES = ['todo', 'doing', 'done'];
const PRIORITIES = ['low', 'medium', 'high'];

// Tiny JSON-file store: loads on start, writes atomically on every change.
function createStore(file) {
  let tasks = [];
  try { tasks = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { tasks = []; }

  const save = () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(tasks, null, 2));
    fs.renameSync(tmp, file);
  };

  return {
    list: () => tasks,
    add(task) { tasks.push(task); save(); return task; },
    find: (id) => tasks.find((t) => t.id === id),
    update(id, patch) {
      const t = tasks.find((x) => x.id === id);
      if (!t) return null;
      Object.assign(t, patch, { updatedAt: new Date().toISOString() });
      save();
      return t;
    },
    remove(id) {
      const i = tasks.findIndex((t) => t.id === id);
      if (i === -1) return false;
      tasks.splice(i, 1);
      save();
      return true;
    },
  };
}

function validate(body, { partial }) {
  const out = {};
  if (body.title !== undefined || !partial) {
    const title = String(body.title ?? '').trim();
    if (!title || title.length > 120) return { error: 'title must be 1-120 characters' };
    out.title = title;
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return { error: `status must be one of ${STATUSES.join(', ')}` };
    out.status = body.status;
  }
  if (body.priority !== undefined) {
    if (!PRIORITIES.includes(body.priority)) return { error: `priority must be one of ${PRIORITIES.join(', ')}` };
    out.priority = body.priority;
  }
  return { value: out };
}

function createApp({ dataFile = process.env.DATA_FILE || path.join(__dirname, 'data', 'tasks.json') } = {}) {
  const app = express();
  const store = createStore(dataFile);

  app.use(express.json({ limit: '10kb' }));
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/health', (req, res) => res.json({ status: 'ok', tasks: store.list().length }));

  app.get('/api/tasks', (req, res) => res.json(store.list()));

  app.get('/api/stats', (req, res) => {
    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    store.list().forEach((t) => { counts[t.status] += 1; });
    res.json({ total: store.list().length, ...counts });
  });

  app.post('/api/tasks', (req, res) => {
    const { value, error } = validate(req.body || {}, { partial: false });
    if (error) return res.status(400).json({ error });
    const now = new Date().toISOString();
    const task = store.add({
      id: crypto.randomUUID(),
      title: value.title,
      status: value.status || 'todo',
      priority: value.priority || 'medium',
      createdAt: now,
      updatedAt: now,
    });
    res.status(201).json(task);
  });

  app.patch('/api/tasks/:id', (req, res) => {
    const { value, error } = validate(req.body || {}, { partial: true });
    if (error) return res.status(400).json({ error });
    const task = store.update(req.params.id, value);
    if (!task) return res.status(404).json({ error: 'task not found' });
    res.json(task);
  });

  app.delete('/api/tasks/:id', (req, res) => {
    if (!store.remove(req.params.id)) return res.status(404).json({ error: 'task not found' });
    res.status(204).end();
  });

  // invalid JSON bodies etc.
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.status ? 'bad request' : 'server error' });
  });

  return app;
}

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const server = createApp().listen(PORT, () => console.log(`TaskBoard listening on ${PORT}`));
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

module.exports = { createApp };