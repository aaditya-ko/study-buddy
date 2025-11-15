# Supabase Persistence - Emotion & Session Data

## ✅ What's Being Saved

### 1. Sessions Table
Every session stores:
```sql
sessions:
  - id (UUID)
  - intensity ('minimal' | 'standard' | 'high')
  - course_summary (from PDF analysis)
  - last_emotion (latest detected emotion)
  - status ('active' | 'ended')
  - created_at
```

**Updated on:**
- Session creation (via UploadCard)
- PDF analysis completion → `course_summary`
- Every emotion check → `last_emotion`

### 2. Messages Table
Every conversation turn stores:
```sql
messages:
  - id (UUID)
  - session_id (FK to sessions)
  - role ('user' | 'ai')
  - text (transcript/response)
  - emotion_at_time (emotion when message sent)
  - created_at
```

**Updated on:**
- User speaks → new user message with current emotion
- AI responds → new AI message with current emotion

### 3. Emotion Checks Table (NEW)
Every emotion analysis stores:
```sql
emotion_checks:
  - id (UUID)
  - session_id (FK to sessions)
  - emotion ('focused' | 'frustrated' | 'confused' | 'breakthrough' | 'neutral')
  - reasoning (Claude's explanation)
  - check_type ('ambient' | 'manual')
  - created_at
```

**Updated on:**
- Every automatic emotion check (every ~10 seconds)
- Every manual "Analyze Emotion" button click

## Data Flow

```
┌─────────────────────────────────────────────┐
│ Emotion Detection Flow                     │
├─────────────────────────────────────────────┤
│                                             │
│  Camera Capture                             │
│       │                                     │
│       ▼                                     │
│  POST /api/vision/ambient                   │
│       │                                     │
│       ▼                                     │
│  Claude Vision API                          │
│       │                                     │
│       ▼                                     │
│  { emotion: "focused",                      │
│    reasoning: "Student is..." }             │
│       │                                     │
│       ├─────────────────────────────────┐   │
│       │                                 │   │
│       ▼                                 ▼   │
│  sessionStorage                    Supabase │
│  (immediate use)                  (persist) │
│       │                                 │   │
│       │                            ┌────┴───┐
│       │                            │        │
│       │                            ▼        ▼
│       │                      sessions   emotion_checks
│       │                      .last_emotion  .emotion
│       │                                     .reasoning
│       │                                     .created_at
│       ▼                                     
│  Voice Console                              
│  (reads emotion)                            
│       │                                     
│       ▼                                     
│  User speaks                                
│       │                                     
│       ▼                                     
│  Save to messages                           
│  with emotion_at_time                       
│                                             │
└─────────────────────────────────────────────┘
```

## Console Output (Verification)

When emotion is detected, you'll see:

```
[Camera] 🎭 EMOTION: FOCUSED
[Camera] 💭 REASONING: Student appears engaged, looking down at work
[Camera] 💾 Saving emotion to Supabase…
[Camera] ✅ Emotion saved to database
```

## Database Queries to Verify

### Check Latest Emotion for Session
```sql
SELECT last_emotion, course_summary 
FROM sessions 
WHERE id = '<your-session-id>';
```

### View Emotion History
```sql
SELECT emotion, reasoning, check_type, created_at
FROM emotion_checks
WHERE session_id = '<your-session-id>'
ORDER BY created_at DESC
LIMIT 10;
```

### View Conversation with Emotions
```sql
SELECT role, text, emotion_at_time, created_at
FROM messages
WHERE session_id = '<your-session-id>'
ORDER BY created_at ASC;
```

### Emotion Distribution for Session
```sql
SELECT 
  emotion,
  COUNT(*) as count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
FROM emotion_checks
WHERE session_id = '<your-session-id>'
GROUP BY emotion
ORDER BY count DESC;
```

## What Gets Saved Where

| Data | sessionStorage | sessions | messages | emotion_checks |
|------|---------------|----------|----------|----------------|
| PDF blob URL | ✅ | ❌ | ❌ | ❌ |
| Course summary | ✅ | ✅ | ❌ | ❌ |
| Latest emotion | ✅ | ✅ | ❌ | ❌ |
| Emotion history | ❌ | ❌ | ❌ | ✅ |
| Emotion reasoning | ❌ | ❌ | ❌ | ✅ |
| Conversation turns | ❌ | ❌ | ✅ | ❌ |
| Emotion during turn | ✅ | ❌ | ✅ | ❌ |
| Intensity setting | ✅ | ✅ | ❌ | ❌ |
| Focus crop | ✅ | ❌ | ❌ | ❌ |

## Running the Schema Updates

### If using Supabase CLI:
```bash
cd studybuddy-live
supabase db push
```

### If using Supabase Dashboard:
1. Go to your project → SQL Editor
2. Copy contents of `supabase.schema.sql`
3. Run the SQL
4. Check Tables tab to verify `emotion_checks` exists

## Benefits of This Persistence

### 1. Session Resumability
- Reload page → conversation history available
- Emotion context preserved
- Course summary retained

### 2. Analytics & Insights
- Track emotion patterns over time
- See which topics cause frustration
- Measure engagement levels
- Identify breakthrough moments

### 3. Debugging
- Full audit trail of emotion checks
- Can replay session with emotions
- Verify AI detected correctly

### 4. Future Features
- "Show me when I was most frustrated"
- "Sessions where I had breakthroughs"
- "Average time spent confused per topic"
- Emotion heatmap over problem sets

## Testing Persistence

### Test 1: Check Session Update
```bash
# In browser console after emotion check:
console.log(sessionStorage.getItem('emotion:<sessionId>'))
# Should show: "focused"

# In Supabase Dashboard → Table Editor → sessions:
# Find your session row, check last_emotion column
# Should match what's in sessionStorage
```

### Test 2: Check Emotion History
```bash
# Do 3-4 manual emotion checks with different expressions
# In Supabase Dashboard → Table Editor → emotion_checks:
# Should see 3-4 new rows with your session_id
# Each with emotion, reasoning, timestamp
```

### Test 3: Check Message Emotions
```bash
# Start listening, say something
# AI responds
# In Supabase Dashboard → Table Editor → messages:
# Should see 2 new rows (user + AI)
# Both with emotion_at_time matching current emotion
```

## Current Limitations

### sessionStorage Only:
- PDF blob URL (would be huge in DB)
- Focus crop (would need Storage bucket)
- Activity timestamps (temporary)

### Not Implemented Yet:
- Loading conversation history on page refresh
- Loading emotion history for trends
- Cleaning up old sessions

## Next Steps

Once persistence is solid:
1. Load conversation on session resume
2. Show emotion timeline/graph
3. Query patterns ("show frustrated moments")
4. Export session transcripts
5. Session cleanup/archival

## Files Modified

1. **`supabase.schema.sql`**
   - Added `emotion_checks` table
   - Added index for fast queries

2. **`src/app/session/[id]/page.tsx`**
   - Added Supabase save after emotion detection
   - Updates `sessions.last_emotion`
   - Inserts to `emotion_checks` with reasoning

## Error Handling

If Supabase save fails:
- Logs warning to console
- Emotion still saved to sessionStorage
- App continues working
- User not interrupted

```javascript
try {
  // Save to Supabase
} catch (err) {
  console.warn("[Camera] ⚠️ Failed to save emotion to Supabase:", err);
  // Fail silently, sessionStorage still works
}
```

This ensures the app works even if:
- Supabase credentials not configured
- Network issues
- Database schema not yet applied
- Rate limits hit

