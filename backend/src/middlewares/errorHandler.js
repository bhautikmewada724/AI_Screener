/**
 * Centralized Express error handler.
 * Sends a consistent JSON response to the client.
 */
const errorHandler = (err, req, res, next) => {
  const isMulterSizeLimit = err.code === 'LIMIT_FILE_SIZE';
  const statusCode = err.status || err.statusCode || (isMulterSizeLimit ? 400 : 500);
  const message =
    err.message ||
    (isMulterSizeLimit ? 'File too large.' : 'Internal Server Error');

  if (process.env.NODE_ENV !== 'test') {
    console.error(`[Error] ${req.method} ${req.originalUrl} -> ${message}`, err.stack);
  }

  res.status(statusCode).json({
    success: false,
    message
  });
};

export default errorHandler;

