/**
 * Centralized Express error handler.
 * Sends a consistent JSON response to the client.
 */
const errorHandler = (err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  if (process.env.NODE_ENV !== 'test') {
    console.error(`[Error] ${req.method} ${req.originalUrl} -> ${message}`, err.stack);
  }

  res.status(statusCode).json({
    success: false,
    message
  });
};

export default errorHandler;

