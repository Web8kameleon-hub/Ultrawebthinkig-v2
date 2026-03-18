# Clisonix Companion + Layer Feeling TODO
Status: Approved ✅ | Progress: 0/8

## Breakdown of Approved Plan

### 1. **✅ Create companion_state tracking** [IN PROGRESS]
   - Per-user dict: mood, empathy_level, interests, last_emotions
   - Load/save from _memory_store

### 2. **Process emotional_dimensions from MegaLayers**
   - Run mega_engine.process_query() in chat pipeline
   - Inject into system_prompt: "Respond w/ emotions: [CURIOUSITY, EMPATHY]"

### 3. **Enhance FAST_SYSTEM_PROMPT**
   - "Warm COMPANION 🌊 w/ layered feelings. Empathize, remember user."

### 4. **Update memory to track emotions/interests**
   - Parse response for mood cues → update companion_state

### 5. **New /api/v1/chat/companion endpoint**
   - Layered mode w/ emotional injection

### 6. **Test emotional greetings/responses**
   - "Përshëndetje" → warm, history-aware

### 7. **Integrate into ocean_core_full.py edits**
   - ~150 lines, non-breaking fallbacks

### 8. **Demo & validate** [FINAL]
   - curl tests + VSCode integration

**Next:** Edit `ocean-core/ocean_core_full.py`

