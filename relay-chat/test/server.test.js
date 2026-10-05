const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { io: connect } = require('socket.io-client');
const { createApp } = require('../server');

let server, url;

before(async () => {
  ({ server } = createApp());
  await new Promise((r) => server.listen(0, r));
  url = `http://localhost:${server.address().port}`;
});

after(() => server.close());

const client = () => connect(url, { transports: ['websocket'] });
const join = (c, name, room) => new Promise((res) => c.emit('join', { name, room }, res));

test('GET /health returns 200', async () => {
  const res = await fetch(`${url}/health`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).status, 'ok');
});

test('message is broadcast to everyone in the room', async () => {
  const a = client(), b = client();
  await join(a, 'ana', 'dev');
  await join(b, 'ben', 'dev');
  const got = new Promise((res) => b.once('message', res));
  a.emit('message', 'hello team');
  const msg = await got;
  assert.strictEqual(msg.name, 'ana');
  assert.strictEqual(msg.text, 'hello team');
  a.close(); b.close();
});

test('messages do not leak across rooms', async () => {
  const a = client(), b = client();
  await join(a, 'ana', 'room-a');
  await join(b, 'ben', 'room-b');
  let leaked = false;
  b.on('message', () => { leaked = true; });
  a.emit('message', 'private');
  await new Promise((r) => setTimeout(r, 200));
  assert.strictEqual(leaked, false);
  a.close(); b.close();
});

test('new joiner receives room history', async () => {
  const a = client();
  await join(a, 'ana', 'history-room');
  a.emit('message', 'first');
  await new Promise((r) => setTimeout(r, 100));
  const b = client();
  const { history } = await join(b, 'ben', 'history-room');
  assert.strictEqual(history.length, 1);
  assert.strictEqual(history[0].text, 'first');
  a.close(); b.close();
});
