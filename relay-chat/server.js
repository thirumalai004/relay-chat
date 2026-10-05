const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const HISTORY_LIMIT = 50;
const MAX_TEXT = 500;

function createApp() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  const history = new Map(); // room -> [messages]
  const startedAt = Date.now();

  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: Math.round((Date.now() - startedAt) / 1000) });
  });

  app.get('/metrics', (req, res) => {
    res.json({
      connections: io.engine.clientsCount,
      rooms: [...history.keys()].length,
      messagesStored: [...history.values()].reduce((n, h) => n + h.length, 0),
    });
  });

  const cleanRoom = (r) => String(r || 'general').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24) || 'general';
  const cleanName = (n) => String(n || '').trim().slice(0, 20) || 'guest';

  const usersIn = async (room) => {
    const sockets = await io.in(room).fetchSockets();
    return sockets.map((s) => s.data.name).sort();
  };

  io.on('connection', (socket) => {
    socket.on('join', async ({ name, room }, ack) => {
      if (socket.data.room) socket.leave(socket.data.room);
      socket.data.name = cleanName(name);
      socket.data.room = cleanRoom(room);
      const r = socket.data.room;
      socket.join(r);

      if (!history.has(r)) history.set(r, []);
      if (typeof ack === 'function') ack({ room: r, name: socket.data.name, history: history.get(r) });

      socket.to(r).emit('system', { text: `${socket.data.name} joined`, ts: Date.now() });
      io.to(r).emit('presence', await usersIn(r));
    });

    socket.on('message', (text) => {
      const { room, name } = socket.data;
      const body = String(text || '').trim().slice(0, MAX_TEXT);
      if (!room || !body) return;
      const msg = { name, text: body, ts: Date.now() };
      const h = history.get(room);
      h.push(msg);
      if (h.length > HISTORY_LIMIT) h.shift();
      io.to(room).emit('message', msg);
    });

    socket.on('typing', (isTyping) => {
      const { room, name } = socket.data;
      if (room) socket.to(room).emit('typing', { name, isTyping: !!isTyping });
    });

    socket.on('disconnecting', () => {
      const { room, name } = socket.data;
      if (!room) return;
      socket.to(room).emit('system', { text: `${name} left`, ts: Date.now() });
      // presence refresh after the socket has actually left
      setImmediate(async () => io.to(room).emit('presence', await usersIn(room)));
    });
  });

  return { app, server, io };
}

if (require.main === module) {
  const { server } = createApp();
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => console.log(`Relay chat listening on ${PORT}`));
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

module.exports = { createApp };
