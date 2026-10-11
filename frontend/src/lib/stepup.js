let handler = null;

export function registerStepUp(fn) {
  handler = fn;
}

export function requestStepUp(opts) {
  if (!handler) return Promise.reject(new Error("no_stepup_handler"));
  return handler(opts);
}
