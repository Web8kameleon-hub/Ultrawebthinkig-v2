package docker.security

# Deny rule: Container must not run as root
deny[msg] {
  input.Cmd == "USER"
  not startswith(input.Value[0], "nonroot")
  not startswith(input.Value[0], "appuser")
  not startswith(input.Value[0], "nobody")
  msg := "❌ Container must not run as root; use non-root user (nonroot, appuser, or numeric UID)"
}

# Deny rule: Base image must be pinned
deny[msg] {
  input.Cmd == "FROM"
  image := input.Value[0]
  not regex.match(":[a-zA-Z0-9.@-]+$", image)
  msg := sprintf("❌ Base image '%s' must be pinned to a tag or digest (not 'latest')", [image])
}

# Deny rule: No plaintext secrets in ENV
deny[msg] {
  input.Cmd == "ENV"
  value := input.Value[_]
  contains(lower(value), "password")
  msg := "❌ Plaintext secrets not allowed in Dockerfile ENV; use build secrets or multi-stage"
}

deny[msg] {
  input.Cmd == "ENV"
  value := input.Value[_]
  contains(lower(value), "api_key")
  msg := "❌ Plaintext API keys not allowed in Dockerfile ENV; use build secrets or multi-stage"
}

deny[msg] {
  input.Cmd == "ENV"
  value := input.Value[_]
  contains(lower(value), "token")
  msg := "❌ Plaintext tokens not allowed in Dockerfile ENV; use build secrets or multi-stage"
}

# Warn rule: Recommend HEALTHCHECK
warn[msg] {
  input.Cmd != "HEALTHCHECK"
  msg := "⚠️  Recommendation: Add HEALTHCHECK instruction for production readiness"
}
