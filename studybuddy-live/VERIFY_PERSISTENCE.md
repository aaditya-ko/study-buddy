# Verify Supabase Persistence - Step by Step Guide

## ✅ Database Schema Status

**Verified via MCP (as of now):**
- ✅ `sessions` table exists (22 rows)
- ✅ `messages` table exists (5 rows)
- ✅ `emotion_checks` table exists (0 rows - newly created)

**Latest session data found:**
```json
{
  "id": "323b5695-2714-44ae-9fd4-8fa1af9761b3",
  "intensity": "standard",
  "last_emotion": "confused",  // ✅ Emotion IS being saved!
  "created_at": "2025-11-15 21:10:30"
}
```

**Latest message data found:**
```json
{
  "session_id": "323b5695-2714-44ae-9fd4-8fa1af9761b3",
  "role": "ai",
  "emotion_at_time": "neutral",  // ✅ Emotion IS being saved with messages!
  "created_at": "2025-11-15 21:10:41"
}
```

## 🧪 How to Verify It's Working (Manual Testing)

### Step 1: Upload a PDF and Note Your Session ID

1. Go to http://localhost:3001 (or your dev port)
2. Upload any PDF
3. Open browser console
4. Look for: `[StudyBuddy] Analyzing PDF...`
5. Note the URL, extract session ID from `/session/<SESSION_ID>`

**Example:** If URL is `/session/abc-123-def`, your session ID is `abc-123-def`

### Step 2: Trigger Emotion Detection

1. Allow camera permissions
2. Click **"Analyze Emotion"** button
3. Watch browser console for:
   ```
   [Camera] 🎭 EMOTION: FOCUSED
   [Camera] 💭 REASONING: Student appears engaged...
   [Camera] 💾 Saving emotion to Supabase…
   [Camera] ✅ Emotion saved to database
   ```

### Step 3: Verify in Supabase Dashboard

Go to your Supabase Dashboard → SQL Editor and run:

#### Check Latest Session Emotion
```sql
SELECT 
  id,
  intensity,
  last_emotion,
  course_summary,
  created_at
FROM sessions
WHERE id = '<YOUR_SESSION_ID>';
```

**Expected:** `last_emotion` should be "focused" (or whatever you detected)

#### Check Emotion History
```sql
SELECT 
  emotion,
  reasoning,
  check_type,
  created_at
FROM emotion_checks
WHERE session_id = '<YOUR_SESSION_ID>'
ORDER BY created_at DESC;
```

**Expected:** New row for each emotion check with full reasoning

#### Check Conversation with Emotions
```sql
SELECT 
  role,
  LEFT(text, 50) as preview,
  emotion_at_time,
  created_at
FROM messages
WHERE session_id = '<YOUR_SESSION_ID>'
ORDER BY created_at ASC;
```

**Expected:** Each message has `emotion_at_time` (the emotion when message was sent)

## 🔍 SQL Verification Queries

### Query 1: Most Recent Sessions with Emotions
```sql
SELECT 
  id,
  intensity,
  last_emotion,
  LEFT(course_summary, 60) as summary_preview,
  created_at
FROM sessions
ORDER BY created_at DESC
LIMIT 10;
```

### Query 2: Emotion Distribution Across All Sessions
```sql
SELECT 
  last_emotion,
  COUNT(*) as session_count
FROM sessions
WHERE last_emotion IS NOT NULL
GROUP BY last_emotion
ORDER BY session_count DESC;
```

### Query 3: Full Emotion Timeline for a Session
```sql
SELECT 
  emotion,
  reasoning,
  check_type,
  TO_CHAR(created_at, 'HH24:MI:SS') as time
FROM emotion_checks
WHERE session_id = '<YOUR_SESSION_ID>'
ORDER BY created_at ASC;
```

### Query 4: Messages with Emotion Context
```sql
SELECT 
  m.role,
  m.text,
  m.emotion_at_time,
  TO_CHAR(m.created_at, 'HH24:MI:SS') as time,
  e.emotion as current_emotion,
  e.reasoning as emotion_reasoning
FROM messages m
LEFT JOIN LATERAL (
  SELECT emotion, reasoning
  FROM emotion_checks
  WHERE session_id = m.session_id
    AND created_at <= m.created_at
  ORDER BY created_at DESC
  LIMIT 1
) e ON true
WHERE m.session_id = '<YOUR_SESSION_ID>'
ORDER BY m.created_at ASC;
```

### Query 5: Sessions with Breakthrough Moments
```sql
SELECT DISTINCT
  s.id,
  s.intensity,
  s.course_summary,
  e.reasoning as breakthrough_reason,
  e.created_at as breakthrough_time
FROM sessions s
INNER JOIN emotion_checks e ON e.session_id = s.id
WHERE e.emotion = 'breakthrough'
ORDER BY e.created_at DESC;
```

## 📊 What Should Be Saved

### On PDF Upload:
| Table | Field | Value |
|-------|-------|-------|
| `sessions` | `id` | UUID |
| `sessions` | `intensity` | "minimal" / "standard" / "high" |
| `sessions` | `status` | "active" |

### After PDF Analysis:
| Table | Field | Value |
|-------|-------|-------|
| `sessions` | `course_summary` | "This is a CS recursion assignment..." |

### On Each Emotion Check:
| Table | Field | Value |
|-------|-------|-------|
| `sessions` | `last_emotion` | "focused" / "frustrated" / etc |
| `emotion_checks` | `emotion` | Same as above |
| `emotion_checks` | `reasoning` | "Student appears engaged..." |
| `emotion_checks` | `check_type` | "ambient" or "manual" |

### On Each Voice Message:
| Table | Field | Value |
|-------|-------|-------|
| `messages` | `role` | "user" or "ai" |
| `messages` | `text` | Transcript/response |
| `messages` | `emotion_at_time` | Current emotion |

## 🐛 Troubleshooting

### Issue: No rows in `emotion_checks`

**Possible causes:**
1. Haven't clicked "Analyze Emotion" button yet
2. Supabase credentials not configured
3. Console shows error: `⚠️ Failed to save emotion to Supabase`

**Check:**
```bash
# In browser console, should see:
[Camera] 💾 Saving emotion to Supabase…
[Camera] ✅ Emotion saved to database

# If you see error instead:
[Camera] ⚠️ Failed to save emotion to Supabase: <error>
```

**Fix:**
- Verify `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`
- Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`
- Restart dev server
- Check Supabase project is active

### Issue: `last_emotion` is NULL

**Possible causes:**
1. Haven't done any emotion checks yet
2. Check failed or was skipped

**Fix:**
- Click "Analyze Emotion" manually
- Check console for save confirmation
- Query `emotion_checks` to see if history exists

### Issue: `emotion_at_time` is NULL in messages

**Possible causes:**
1. Messages saved before emotion detection was implemented
2. Emotion wasn't detected at time of message

**Fix:**
- Send new message after doing emotion check
- Verify emotion badge shows in Voice section

## 🎯 Expected Data Flow

```
1. Upload PDF
   └─> sessions: id, intensity, status="active"

2. PDF Analysis Completes
   └─> sessions: course_summary updated

3. Camera Loads
   └─> Auto emotion checks start (every ~10 sec)

4. First Emotion Check
   ├─> sessionStorage: emotion saved
   ├─> sessions: last_emotion = "focused"
   └─> emotion_checks: new row with reasoning

5. User Speaks
   └─> messages: user message with emotion_at_time

6. AI Responds
   └─> messages: AI message with emotion_at_time

7. Another Emotion Check
   ├─> sessions: last_emotion = "frustrated" (updated)
   └─> emotion_checks: new row (history preserved)
```

## 🔐 Row Level Security Note

The `emotion_checks` table has RLS enabled. If you're testing without auth:

**Temporary solution (development only):**
```sql
-- Disable RLS for testing
ALTER TABLE public.emotion_checks DISABLE ROW LEVEL SECURITY;

-- Or create a permissive policy
CREATE POLICY "Allow all operations during development"
ON public.emotion_checks
FOR ALL
USING (true)
WITH CHECK (true);
```

**Production solution:**
```sql
-- Enable RLS
ALTER TABLE public.emotion_checks ENABLE ROW LEVEL SECURITY;

-- Only allow access to own sessions
CREATE POLICY "Users can only see their own emotion checks"
ON public.emotion_checks
FOR SELECT
USING (
  session_id IN (
    SELECT id FROM sessions 
    WHERE created_by = auth.uid()
  )
);
```

## ✅ Quick Verification Checklist

Run these checks in order:

- [ ] **1. Sessions table has data**
  ```sql
  SELECT COUNT(*) FROM sessions;
  -- Should be > 0
  ```

- [ ] **2. Latest session has emotion**
  ```sql
  SELECT last_emotion FROM sessions 
  ORDER BY created_at DESC LIMIT 1;
  -- Should NOT be NULL after emotion check
  ```

- [ ] **3. emotion_checks table exists**
  ```sql
  SELECT COUNT(*) FROM emotion_checks;
  -- Should be >= 0 (table exists)
  ```

- [ ] **4. New emotion check appears**
  - Click "Analyze Emotion" in app
  - Run: `SELECT COUNT(*) FROM emotion_checks;`
  - Count should increase by 1

- [ ] **5. Reasoning is saved**
  ```sql
  SELECT reasoning FROM emotion_checks 
  ORDER BY created_at DESC LIMIT 1;
  -- Should have text explanation
  ```

- [ ] **6. Messages have emotions**
  ```sql
  SELECT emotion_at_time FROM messages 
  WHERE emotion_at_time IS NOT NULL 
  LIMIT 1;
  -- Should have at least one
  ```

## 📝 Test Session Transcript Example

Here's what a full verified session should look like in the database:

**Sessions:**
```json
{
  "id": "abc-123",
  "intensity": "standard",
  "last_emotion": "focused",
  "course_summary": "CS 101 recursion problem set focusing on tree traversal",
  "status": "active"
}
```

**Emotion_checks:**
```json
[
  {
    "emotion": "neutral",
    "reasoning": "Student appears calm and ready to start",
    "check_type": "ambient",
    "created_at": "10:00:00"
  },
  {
    "emotion": "focused",
    "reasoning": "Student is looking down at work with concentrated expression",
    "check_type": "ambient",
    "created_at": "10:05:00"
  },
  {
    "emotion": "confused",
    "reasoning": "Student has tilted head and puzzled expression",
    "check_type": "ambient",
    "created_at": "10:10:00"
  }
]
```

**Messages:**
```json
[
  {
    "role": "ai",
    "text": "Hey! I see you're working on recursion...",
    "emotion_at_time": "neutral",
    "created_at": "10:01:00"
  },
  {
    "role": "user",
    "text": "Can you help me with the base case?",
    "emotion_at_time": "confused",
    "created_at": "10:11:00"
  },
  {
    "role": "ai",
    "text": "Great question! What happens when the node is null?",
    "emotion_at_time": "confused",
    "created_at": "10:11:05"
  }
]
```

## 🎉 Success Indicators

You know persistence is working when you see:

✅ Console logs: `[Camera] ✅ Emotion saved to database`  
✅ Supabase dashboard shows new `emotion_checks` rows  
✅ `sessions.last_emotion` updates in real-time  
✅ `messages` have `emotion_at_time` filled in  
✅ Can query full emotion timeline for a session  
✅ Data persists after page refresh  
✅ Can see reasoning for each emotion detection  

---

**Ready to test? Upload a PDF, click "Analyze Emotion", and run the queries above!**

