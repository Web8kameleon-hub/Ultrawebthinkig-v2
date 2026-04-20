t# Trinity Debate Optimization - TODO Steps
======================

Approved Plan Breakdown (from .git_ocean_core_full.py):

1. [x] **Define PERSONA_MAX_TOKENS** dict (-1 tokens/persona, -1 for ASI).
2. [x] **Update persona prompts** with strict conciseness + style enforcement.
3. [x] **Implement synthesize_asi_final()** function (cluster, key points, verdict).
4. [x] **Update /api/v1/debate** endpoint to include synthesis.
5. [ ] **Test & validate** with curl on /api/v1/debate.
6. [ ] **Update docs/comments** + attempt_completion.

**Progress:** Core features implemented (compression + synthesis). Linter ignores (indentation). Ready for testing.


**Progress:** Ready for step-by-step implementation.

