// Report-Only first: the policy is observed in the browser console and only enforced
// once a few days of real pages show nothing legitimate being blocked. Inline scripts
// and eval stay allowed for now (theme bootstrap, JSON-LD, Monaco); everything else is closed.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "worker-src 'self' blob:",
  "frame-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

export default defineEventHandler((event) => {
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  setResponseHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')
  setResponseHeader(event, 'X-Frame-Options', 'DENY')
  setResponseHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), payment=(), usb=()')
  setResponseHeader(event, 'Content-Security-Policy-Report-Only', CSP_REPORT_ONLY)

  // HSTS belongs at the TLS-terminating edge so proxy topology cannot
  // accidentally advertise HTTPS guarantees that the edge does not enforce.
})
