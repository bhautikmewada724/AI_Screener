const clients = new Map();
const HEARTBEAT_MS = 30_000;

const safeWrite = (res, chunk) => {
  try {
    res.write(chunk);
    return true;
  } catch (err) {
    return false;
  }
};

export const registerClient = ({ userId, res }) => {
  const entry = clients.get(userId) || new Set();
  entry.add(res);
  clients.set(userId, entry);

  const heartbeat = setInterval(() => {
    safeWrite(res, `event: heartbeat\ndata: {}\n\n`);
  }, HEARTBEAT_MS);

  const cleanup = () => {
    clearInterval(heartbeat);
    const set = clients.get(userId);
    if (set) {
      set.delete(res);
      if (!set.size) {
        clients.delete(userId);
      }
    }
  };

  res.on('close', cleanup);
  res.on('finish', cleanup);
};

export const pushToUser = (userId, eventName, payload) => {
  const set = clients.get(userId);
  if (!set || !set.size) return;
  const data = JSON.stringify(payload || {});
  for (const res of set) {
    const ok = safeWrite(res, `event: ${eventName}\ndata: ${data}\n\n`);
    if (!ok) {
      set.delete(res);
    }
  }
  if (set.size === 0) {
    clients.delete(userId);
  }
};

export const activeClientCount = () => {
  let total = 0;
  clients.forEach((set) => (total += set.size));
  return total;
};




