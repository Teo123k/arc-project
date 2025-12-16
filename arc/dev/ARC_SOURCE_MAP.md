# ARC SOURCE MAP (Authoritative)

## Chat System

### Assistant Response Generation (ACTIVE)
- File: app/api/arc/chat/route.ts
- Zone: ZONE_CORE
- Responsibility:
  - Calls OpenAI
  - Constructs assistant messages
  - Defines fallback / default phrasing

### Output Tone / Wording
- Currently: NOT SEPARATED
- Consequence:
  - Tone changes would require touching ZONE_CORE
  - Therefore blocked by governance

### UI Chat Pages
- Files:
  - arc-system/chat/page.tsx
  - arc-system/intent/page.tsx
- Responsibility:
  - Send user input
  - Render responses
  - Do not affect assistant wording

### Input Components
- File: app/dashboard/components/InputBar.tsx
- Responsibility:
  - User input only
  - No assistant behavior