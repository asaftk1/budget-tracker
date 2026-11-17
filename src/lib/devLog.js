// Console logging for development only. Do not log transaction data or other personal
// information, even here. Warnings and errors that should reach users' consoles in production
// (for example the importer's onWarn messages) use console.warn / console.error directly.
export function devLog(...args) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
}
