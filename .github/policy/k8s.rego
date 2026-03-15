package k8s.security

# Deny: Non-root containers
deny[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  not container.securityContext.runAsNonRoot
  msg := "❌ Containers must run as non-root (runAsNonRoot: true)"
}

# Deny: Drop Linux capabilities
deny[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  not container.securityContext.capabilities.drop
  msg := "❌ Must drop Linux capabilities (at minimum: NET_RAW, SYS_PTRACE)"
}

# Deny: Resource limits required
deny[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  not container.resources.limits.cpu
  msg := "❌ CPU limits required for resource safety"
}

deny[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  not container.resources.limits.memory
  msg := "❌ Memory limits required for resource safety"
}

# Deny: Read-only root filesystem recommended
warn[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  not container.securityContext.readOnlyRootFilesystem
  msg := "⚠️  Recommendation: Set readOnlyRootFilesystem: true for minimal blast radius"
}

# Deny: No privileged containers
deny[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  container.securityContext.privileged == true
  msg := "❌ Privileged containers are not allowed"
}
