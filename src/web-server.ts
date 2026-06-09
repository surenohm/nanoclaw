import express from 'express';
import path from 'path';
import pino from 'pino';
import { initDatabase, getAllChats, getAllTasks, getTaskRunLogs, getNewMessages, getDueTasks, createTask, deleteTask, updateTask, getTaskById } from './db.js';
import { ASSISTANT_NAME, DATA_DIR, GROUPS_DIR, TIMEZONE } from './config.js';
import { loadJson } from './utils.js';
import { RegisteredGroup } from './types.js';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: { target: 'pino-pretty', options: { colorize: true } }
});

const WEB_PORT = parseInt(process.env.WEB_PORT || '3000', 10);
const WEB_PASSWORD = process.env.WEB_PASSWORD || 'nanoclaw';

let startTime = Date.now();

export function startWebServer(): void {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(import.meta.dirname, '..', 'web')));

  // Simple token-based auth
  function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction): void {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token !== WEB_PASSWORD) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  }

  // Login
  app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === WEB_PASSWORD) {
      res.json({ token: WEB_PASSWORD, name: ASSISTANT_NAME });
    } else {
      res.status(401).json({ error: 'Invalid password' });
    }
  });

  // Dashboard stats
  app.get('/api/stats', requireAuth, (_req, res) => {
    const groups = loadJson<Record<string, RegisteredGroup>>(path.join(DATA_DIR, 'registered_groups.json'), {});
    const tasks = getAllTasks();
    const chats = getAllChats();
    const activeTasks = tasks.filter(t => t.status === 'active');
    const uptime = Date.now() - startTime;

    res.json({
      assistantName: ASSISTANT_NAME,
      timezone: TIMEZONE,
      uptime,
      registeredGroups: Object.keys(groups).length,
      totalChats: chats.length,
      activeTasks: activeTasks.length,
      totalTasks: tasks.length,
      groupsList: Object.entries(groups).map(([jid, g]) => ({
        jid,
        name: g.name,
        folder: g.folder,
        trigger: g.trigger,
        addedAt: g.added_at
      })),
      tasksList: tasks.map(t => ({
        id: t.id,
        groupFolder: t.group_folder,
        prompt: t.prompt,
        scheduleType: t.schedule_type,
        scheduleValue: t.schedule_value,
        contextMode: t.context_mode,
        status: t.status,
        nextRun: t.next_run,
        lastRun: t.last_run,
        lastResult: t.last_result,
        createdAt: t.created_at
      })),
      chatsList: chats
        .filter(c => c.jid !== '__group_sync__')
        .slice(0, 50)
        .map(c => ({
          jid: c.jid,
          name: c.name,
          lastActivity: c.last_message_time,
          isGroup: c.jid.endsWith('@g.us')
        }))
    });
  });

  // Task run logs
  app.get('/api/tasks/:id/logs', requireAuth, (req, res) => {
    const logs = getTaskRunLogs(req.params.id as string, 20);
    res.json({ logs });
  });

  // SPA fallback
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(import.meta.dirname, '..', 'web', 'index.html'));
  });

  app.listen(WEB_PORT, () => {
    logger.info({ port: WEB_PORT }, 'Web dashboard running');
    console.log(`\n  Dashboard: http://localhost:${WEB_PORT}`);
    console.log(`  Password:  ${WEB_PASSWORD}\n`);
  });
}

// Allow standalone mode
if (process.argv.includes('--web-only')) {
  initDatabase();
  startTime = Date.now();
  startWebServer();
}
