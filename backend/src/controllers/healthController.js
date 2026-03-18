/**
 * Returns a lightweight payload that proves the service is running.
 */
export const getHealthStatus = (req, res) => {
  res.json({
    status: 'ok',
    service: 'ai-screener-backend',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
};

