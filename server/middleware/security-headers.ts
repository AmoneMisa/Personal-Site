export default defineEventHandler((event) => {
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  setResponseHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')
  setResponseHeader(event, 'X-Frame-Options', 'DENY')
  setResponseHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), payment=(), usb=()')

  // CSP and HSTS are intentionally not guessed here. CSP needs a complete
  // inventory of the editor/worker/image origins and the current inline theme
  // bootstrap; HSTS belongs at the TLS-terminating edge so proxy topology cannot
  // accidentally advertise HTTPS guarantees that the edge does not enforce.
})
