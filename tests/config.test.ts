import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { loadConfig } from "../src/config.js"

const ENV_KEYS = [
  "TRANSPORT",
  "PORT",
  "BIND_ADDRESS",
  "REDACT_PII",
  "ALLOW_DETAIL_TOOLS",
  "ALLOW_INSECURE_REMOTE",
  "TOLL_BOOTH_DB",
] as const

let savedEnv: Record<string, string | undefined>

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
  for (const key of ENV_KEYS) delete process.env[key]
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = savedEnv[key]
    }
  }
})

describe("loadConfig HTTP bind guard", () => {
  it("allows the default loopback bind over HTTP", () => {
    process.env.TRANSPORT = "http"
    expect(() => loadConfig()).not.toThrow()
    expect(loadConfig().bindAddress).toBe("127.0.0.1")
  })

  it.each(["127.0.0.1", "::1", "localhost"])("allows loopback address %s", (addr) => {
    process.env.TRANSPORT = "http"
    process.env.BIND_ADDRESS = addr
    expect(() => loadConfig()).not.toThrow()
  })

  it.each(["0.0.0.0", "::", "192.168.1.10", "example.internal"])(
    "refuses non-loopback address %s over HTTP",
    (addr) => {
      process.env.TRANSPORT = "http"
      process.env.BIND_ADDRESS = addr
      expect(() => loadConfig()).toThrow(/Refusing to start/)
    },
  )

  it("permits non-loopback bind with ALLOW_INSECURE_REMOTE=true", () => {
    process.env.TRANSPORT = "http"
    process.env.BIND_ADDRESS = "0.0.0.0"
    process.env.ALLOW_INSECURE_REMOTE = "true"
    const config = loadConfig()
    expect(config.bindAddress).toBe("0.0.0.0")
    expect(config.allowInsecureRemote).toBe(true)
  })

  it("does not guard the stdio transport", () => {
    process.env.BIND_ADDRESS = "0.0.0.0"
    expect(() => loadConfig()).not.toThrow()
  })
})
