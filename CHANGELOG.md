# Changelog

## 0.2.0 - 2026-08-08

Security-hardening release.

### Fixed

- **Live bearer tokens no longer reach the LLM context.** `getActiveSessions`
  no longer selects `bearer_token`, and the sanitiser redacts
  credential-class fields (`bearer_token`, `macaroon`, `settlement_secret`,
  `refund_preimage`, `status_token`, `token`, `bolt11`, `return_invoice`)
  unconditionally. `REDACT_PII` now governs only PII (hashes, session ids,
  IPs, timestamps).
- **Plaintext HTTP refuses non-loopback binds.** `TRANSPORT=http` with a
  non-loopback `BIND_ADDRESS` throws at startup unless
  `ALLOW_INSECURE_REMOTE=true` is set; the README documents fronting with a
  TLS-terminating reverse proxy.
- **Dependabot auto-merge narrowed.** Development dependencies auto-merge on
  patch/minor; runtime dependencies on patch only. Runtime minor/major
  updates now require human review.

## 0.1.0

Initial release.
