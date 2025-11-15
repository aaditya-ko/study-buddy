# 📚 StudyBuddy Live

**Paper-first AI study companion with emotion-aware tutoring and natural voice**

## 🎯 What It Does

StudyBuddy Live watches you work on physical paper/notebooks through your camera while providing proactive, emotionally-aware tutoring through voice conversation. It's like having a study buddy sitting across from you.

### Key Features

- 📄 **PDF Analysis** - Understands your assignment context
- 🎯 **Problem Highlighting** - Drag to select what you're working on
- 📸 **Ambient Emotion Detection** - Monitors frustration, confusion, breakthroughs
- 📝 **Show Work Analysis** - AI sees your written work and provides Socratic guidance
- 🗣️ **Natural Voice Conversation** - Deepgram TTS for human-like AI voice
- 🎉 **Breakthrough Celebrations** - Confetti when you solve it!
- 💾 **Session History** - Review past study sessions

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up API Keys

Create `.env.local` in the project root:

```bash
# REQUIRED: Claude AI (chat + vision)
ANTHROPIC_API_KEY=sk-ant-xxxxx

# REQUIRED: Deepgram TTS (natural voice)
DEEPGRAM_API_KEY=xxxxx

# OPTIONAL: Supabase (session persistence)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx
```

**Get API Keys:**
- Anthropic: [console.anthropic.com](https://console.anthropic.com/)
- Deepgram: [console.deepgram.com](https://console.deepgram.com/) (Free $200 credits!)
- Supabase: [supabase.com/dashboard](https://supabase.com/dashboard)

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📖 How to Use

1. **Upload PDF** - Drag your assignment/problem set
2. **Set Support Level** - Slider: Minimal / Standard / High
3. **Highlight Problem** - Click "Highlight" and drag box over current problem
4. **Start Listening** - Enable microphone for voice conversation
5. **Study Naturally** - AI proactively checks in, adapts to your emotions
6. **Show Work** - Click button to get feedback on written work (3s countdown)

## 🏗️ Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, TailwindCSS
- **AI**: Claude Sonnet 4 (Anthropic) for chat + vision
- **Voice**: Deepgram Aura-2 TTS + Web Speech API (STT)
- **PDF**: react-pdf with custom highlight tool
- **Camera**: getUserMedia + Canvas API
- **Database**: Supabase (PostgreSQL + Storage)
- **Design**: Anthropic-inspired (warm ivory, indigo accents)

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts           # Claude conversation with emotion awareness
│   │   ├── pdf/analyze/route.ts    # PDF context + highlighted problem analysis
│   │   ├── tts/speak/route.ts      # Deepgram TTS proxy
│   │   └── vision/
│   │       ├── ambient/route.ts    # Emotion detection (low-res)
│   │       └── showwork/route.ts   # Work analysis (high-res)
│   ├── page.tsx                    # Landing: Upload + intensity slider
│   ├── session/[id]/page.tsx       # Main session: PDF + camera + voice
│   └── sessions/page.tsx           # Past sessions history
├── components/
│   ├── IntensitySlider.tsx         # Support level selector
│   └── UploadCard.tsx              # PDF upload UI
└── lib/
    ├── anthropic.ts                # Claude client
    └── supabase.ts                 # Database client
```

## 🎨 Design Language

Inspired by Anthropic's Claude interface:
- **Warm ivory background** (`#fcfaf7`) - cozy, paper-like
- **Indigo accent** (`#3e63dd`) - calm, trustworthy
- **Generous spacing & shadows** - depth and hierarchy
- **Rounded corners** (16px) - soft, approachable
- **Heroicons** - professional, non-generic icons

## 📊 How It Works

### Two-Mode Camera System

**Ambient Mode** (every 6-15 seconds):
- Low-res capture (512×384)
- Emotion detection only
- Monitors: focused, frustrated, confused, breakthrough, neutral
- Saved to database for session history

**Show Work Mode** (button press):
- High-res capture (1024×768)
- Analyzes written work + diagrams
- Cross-references with highlighted problem
- Returns: praise, observations, guiding questions

### Proactive AI Behavior

Instead of waiting for you to ask:
- **Check-ins every 2-4 min** (based on intensity)
- **Emotion-aware responses** (adapts if frustrated)
- **Celebrates breakthroughs** with confetti 🎉
- **Natural conversation memory** (full context maintained)

### Voice System

- **Speech-to-Text**: Web Speech API (browser native)
- **Text-to-Speech**: Deepgram Aura-2 (`aura-asteria-en` - warm, friendly)
- **Queue system**: Prevents overlapping responses
- **User interrupt**: Speaking auto-cancels AI voice
- **Fallback**: Browser TTS if Deepgram unavailable

## 📚 Documentation

- [DEEPGRAM_SETUP.md](./DEEPGRAM_SETUP.md) - TTS integration guide
- [SUPABASE_PERSISTENCE.md](./SUPABASE_PERSISTENCE.md) - Database setup
- [EMOTION_DETECTION.md](./EMOTION_DETECTION.md) - How emotion detection works

## 🐛 Troubleshooting

### Voice sounds robotic
- Check `DEEPGRAM_API_KEY` is set in `.env.local`
- Restart dev server after adding key
- Look for `[Voice] ✅ Deepgram audio received` in console

### Camera not working
- Grant camera permissions in browser
- Use Chrome/Edge (best WebRTC support)
- Check for `[Camera]` logs in console

### PDF not analyzing
- Verify `ANTHROPIC_API_KEY` is set
- Check network tab for API errors
- Look for `[PDF-ANALYZE]` logs

## 🎓 Hackathon Notes

**Innovation Points:**
- ✅ Paper-first paradigm (camera watches natural study posture)
- ✅ Proactive AI (initiates check-ins, doesn't wait)
- ✅ Dual-mode vision (emotion vs. work analysis)
- ✅ Emotional awareness (adapts tutoring style)

**Design Points:**
- ✅ Anthropic-inspired warmth
- ✅ Smooth interactions (hover animations, countdown)
- ✅ Real-time feedback (emotion badges, confetti)
- ✅ Professional polish (Deepgram TTS)

## 📄 License

Built for hackathon demo - all rights reserved

