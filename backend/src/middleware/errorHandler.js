export function notFound(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}.` });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error.type === "entity.parse.failed") {
    res.status(400).json({ error: "Request body must be valid JSON." });
    return;
  }
  const status = error.status || 500;
  if (status >= 500) {
    console.error(error);
  }
  res.status(status).json({
    error: error.message || "Unexpected server error.",
    ...(error.details || {})
  });
}
