package compose.security

# Deny: No privileged mode
deny[msg] {
  input.services[service]
  input.services[service].privileged == true
  msg := sprintf("❌ Service '%s' must not run in privileged mode", [service])
}

# Deny: No host networking
deny[msg] {
  input.services[service]
  input.services[service].network_mode == "host"
  msg := sprintf("❌ Service '%s' must not use host networking", [service])
}

# Deny: No host PID namespace
deny[msg] {
  input.services[service]
  input.services[service].pid == "host"
  msg := sprintf("❌ Service '%s' must not share host PID namespace", [service])
}

# Deny: No host IPC namespace
deny[msg] {
  input.services[service]
  input.services[service].ipc == "host"
  msg := sprintf("❌ Service '%s' must not share host IPC namespace", [service])
}

# Warn: Service should have resource limits
warn[msg] {
  input.services[service]
  not input.services[service].deploy.resources.limits
  msg := sprintf("⚠️  Service '%s' should have resource limits for stability", [service])
}

# Warn: Service should have restart policy
warn[msg] {
  input.services[service]
  not input.services[service].restart_policy
  msg := sprintf("⚠️  Service '%s' should have explicit restart policy", [service])
}
