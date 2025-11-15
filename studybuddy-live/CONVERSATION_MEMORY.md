# Conversation Memory Implementation

## ✅ What Was Implemented

### 1. Full Conversation History in `/api/chat`
The chat endpoint now maintains complete conversation context across turns.

**New API Format:**
```typescript
POST /api/chat
{
  messages: [
    { role: "user", content: "Tell me about recursion", focusCropUrl?: "..." },
    { role: "assistant", content: "Recursion is when..." },
    { role: "user", content: "Can you give an example?" }
  ],
  emotion: "neutral",
  courseContext: "This is a CS recursion assignment..."
}
```

**Backward Compatible:** Still accepts old single-transcript format for any legacy code.

### 2. Initial AI Greeting After PDF Analysis
When the PDF analysis completes, the AI automatically:
- Reads the course summary from sessionStorage
- Generates a warm, context-aware greeting
- Speaks it via TTS
- Adds it to conversation history
- Persists to Supabase

**Example Greeting:**
> "Hey! I can see you're working on a CS data structures assignment focusing on recursion and tree traversal. What would you like to tackle first?"

### 3. Conversation State Management in Session Page
**New State:**
```typescript
const [conversationHistory, setConversationHistory] = useState<Array<{
  role: "user" | "assistant";
  content: string;
  focusCropUrl?: string;
}>>([]);
```

**Flow:**
1. PDF analyzed → Course summary stored
2. AI generates greeting → Added to history
3. User speaks → Added to history with optional focus crop
4. AI responds → Full history sent to Claude
5. AI reply → Added to history
6. Repeat steps 3-5 (conversation accumulates)

### 4. Detailed Logging
All conversation turns now log:
```
[Voice] User said: Can you explain base cases?
[Voice] Sending conversation with 4 messages
[CHAT] Using conversation history with 4 messages
[CHAT] ✅ Response generated: Great question! Base cases...
[Voice] AI replied: Great question! Base cases...
```

## How Conversation Memory Works

### Before (Broken):
```
User: "Tell me about recursion"
AI: "Recursion is when a function calls itself..."

User: "Can you give an example?"
AI: "Sure! An example of what?" ❌ (no context)
```

### After (Fixed):
```
User: "Tell me about recursion"
AI: "Recursion is when a function calls itself..."

User: "Can you give an example?"
AI: "Sure! Here's a recursive factorial function..." ✅ (remembers context)
```

## Storage Architecture

### SessionStorage (Temporary, per-session)
- `courseSummary:<sessionId>` → PDF analysis
- `focus:<sessionId>` → Highlighted problem crop
- `emotion:<sessionId>` → Latest emotion
- `intensity:<sessionId>` → Check-in frequency

### React State (In-memory, component-level)
- `conversationHistory` → Full message array for API
- `log` → Display-only transcript for UI

### Supabase (Persistent, database)
- `sessions` table → Session metadata
- `messages` table → Full conversation transcript (user + AI)

**Note:** Currently we write to Supabase but don't load on session start (that's the next high-priority item).

## What Still Needs to Be Done

### High Priority
- [ ] **Load conversation from Supabase on session start**
  - If user refreshes, conversation should resume
  - Query `messages` table by `session_id`, ordered by `created_at`
  - Rebuild `conversationHistory` state from DB

### Medium Priority  
- [ ] **Make proactive check-ins context-aware**
  - Currently uses hardcoded messages
  - Should use conversation history + emotion to generate relevant prompts
  
- [ ] **Fix emotion analysis**
  - Camera → Claude vision currently not working
  - Need to verify `/api/vision/ambient` route
  
- [ ] **Fix problem highlighting**
  - Drag-to-select rectangle works
  - Need to verify crop is being sent properly with messages

### Low Priority
- [ ] **Conversation pruning** (for very long sessions)
  - Claude has token limits (~200k)
  - Keep recent N turns + initial summary
  
- [ ] **Cross-problem similarity detection**
  - "This is like problem 2 on page 1"
  - Requires embedding problems and semantic search

## Testing the Implementation

### 1. Test Initial Greeting
```bash
# Upload a PDF
# Watch console:
[StudyBuddy] ✅ Course context: This is a CS assignment...
[Voice] Generating initial AI greeting…
[Voice] ✅ Initial greeting: Hey! I can see you're working on...
```

### 2. Test Conversation Memory
```bash
# Start listening
# Say: "Tell me about recursion"
# AI responds with explanation
# Say: "Can you give me an example?"
# AI should reference recursion without you repeating it
```

### 3. Check Logs
```bash
# Browser console shows full conversation flow
[Voice] Sending conversation with 3 messages
[CHAT] Using conversation history with 3 messages
```

## Key Files Modified

1. **`/src/app/api/chat/route.ts`**
   - Accepts `messages[]` array instead of single `transcript`
   - Builds full conversation for Claude
   - Backward compatible with old format

2. **`/src/app/session/[id]/page.tsx`**
   - Added `conversationHistory` state
   - Added initial greeting effect
   - Updated speech recognition to use history
   - All turns now accumulate context

## Architecture Diagram

```
┌─────────────────────────────────────────────┐
│ Session Page Component                      │
├─────────────────────────────────────────────┤
│                                             │
│  conversationHistory: [                     │
│    { role: "user", content: "..." },        │
│    { role: "assistant", content: "..." },   │
│    ...                                      │
│  ]                                          │
│                                             │
│  ┌────────────┐         ┌────────────┐     │
│  │   Voice    │         │   Camera   │     │
│  │  Console   │         │    Pane    │     │
│  └────────────┘         └────────────┘     │
│        │                       │            │
│        │ User speaks           │            │
│        │                       │            │
│        ├──────────────┐        │            │
│        │ Add to       │        │            │
│        │ history      │        │            │
│        │              │        │            │
│        ▼              │        │            │
│   POST /api/chat ◄────┘        │            │
│   {                            │            │
│     messages: [...],           │            │
│     emotion: "...",            │            │
│     courseContext: "..."       │            │
│   }                            │            │
│        │                       │            │
│        ▼                       │            │
│   Claude Sonnet 4              │            │
│   (Full context)               │            │
│        │                       │            │
│        ▼                       │            │
│   AI Response                  │            │
│        │                       │            │
│        ├──────────────┐        │            │
│        │ Add to       │        │            │
│        │ history      │        │            │
│        ▼              │        │            │
│   TTS Speaks          │        │            │
│   Display in log      │        │            │
│   Save to Supabase    │        │            │
│                       │        │            │
└───────────────────────┴────────┴────────────┘
```

## Benefits of This Implementation

1. **True Tutoring Experience**
   - AI remembers what you discussed
   - Can reference previous explanations
   - Builds on earlier concepts

2. **Natural Conversation Flow**
   - No need to repeat context
   - Follow-up questions work naturally
   - "Can you clarify that?" makes sense

3. **Course-Aware from Start**
   - Initial greeting shows AI "read" the assignment
   - All responses consider course context
   - Can reference specific problems/topics

4. **Persistent (partially)**
   - Saves to Supabase for later retrieval
   - Ready to implement "resume session" feature

5. **Debuggable**
   - Full conversation visible in console
   - Can trace exactly what Claude sees
   - Easy to diagnose context issues

