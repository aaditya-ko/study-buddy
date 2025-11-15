# 🔊 Deepgram TTS Integration

## Overview

StudyBuddy Live now uses **Deepgram's Aura-2 TTS** for natural, human-like AI voice instead of browser TTS. This provides:

- ✅ **Sub-200ms latency** - Fast enough for real-time conversation
- ✅ **Professional quality** - Natural prosody and intonation
- ✅ **Domain-specific accuracy** - Perfect pronunciation of educational terms
- ✅ **Warm, friendly voice** - Uses `aura-asteria-en` by default

## Setup Instructions

### 1. Get Deepgram API Key

1. Sign up at [https://console.deepgram.com/signup](https://console.deepgram.com/signup)
2. Navigate to **API Keys** in the dashboard
3. Create a new API key
4. Copy the key (starts with something like `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

### 2. Add to Environment Variables

Create or update `.env.local` in the project root:

```bash
# Deepgram TTS API Key
DEEPGRAM_API_KEY=your_deepgram_api_key_here

# Existing keys
ANTHROPIC_API_KEY=your_anthropic_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

### 3. Restart Development Server

```bash
npm run dev
```

## How It Works

### Architecture

1. **Frontend** (`VoiceConsole` component):
   - Queues AI responses for speech
   - Calls `/api/tts/speak` with text
   - Receives WAV audio buffer
   - Plays using Web Audio API
   - **Automatic fallback** to browser TTS if Deepgram unavailable

2. **Backend** (`/api/tts/speak`):
   - Proxies requests to Deepgram API (keeps key secure)
   - Converts text → natural speech
   - Returns WAV audio (24kHz, 16-bit linear PCM)

### Voice Selection

**Default**: `aura-asteria-en` (warm, clear, friendly - perfect for tutoring)

**Other options** (modify in `page.tsx` line 944):
- `aura-luna-en` - Soft, calming
- `aura-stella-en` - Energetic, upbeat
- `aura-athena-en` - Professional, authoritative
- `aura-hera-en` - Mature, reassuring
- `aura-orion-en` - Deep, confident (male)

[Full voice list](https://developers.deepgram.com/docs/tts-models)

## Testing

1. Upload a PDF to start a session
2. Click "Start Listening" and speak
3. Listen for AI response - should be natural and human-like
4. Check console logs:
   - `[Voice] 🔊 Speaking from queue (Deepgram TTS):`
   - `[Voice] ✅ Deepgram audio received`
   - `[Voice] ✅ Finished speaking (Deepgram)`

If you see `[Voice] ⚠️ Deepgram unavailable, using browser TTS fallback`, check:
- `DEEPGRAM_API_KEY` is set correctly in `.env.local`
- Server was restarted after adding the key
- API key has TTS credits/permissions

## Cost Estimation

**Deepgram TTS Pricing** (as of 2024):
- Pay-as-you-go: ~$0.015 per 1,000 characters
- Average AI response: ~100 characters = $0.0015
- **100 responses ≈ $0.15**
- **1,000 responses ≈ $1.50**

Deepgram offers **$200 free credits** for new accounts - enough for ~13,000 AI responses.

[Latest pricing](https://deepgram.com/pricing)

## Troubleshooting

### "Deepgram unavailable, using browser TTS fallback"
- Check `.env.local` has `DEEPGRAM_API_KEY=...`
- Restart dev server: `npm run dev`
- Verify key is valid in Deepgram console

### No audio plays at all
- Check browser console for errors
- Ensure microphone permissions granted (required for speech recognition)
- Try in Chrome/Edge (best Web Audio API support)

### Robotic voice (not natural)
- If you hear robotic voice, fallback is active
- Check console logs for `[TTS]` error messages
- Verify API key has TTS permissions enabled

## Demo Impact

**Before**: Robotic browser TTS (sounds like 1990s GPS)
**After**: Professional human-like voice (sounds like friendly tutor)

**Hackathon Judges Will Notice**:
- ✅ Natural conversation flow
- ✅ Professional polish
- ✅ Emotional warmth in voice
- ✅ Better pronunciation of technical terms

This upgrade significantly increases demo impact and perceived product quality! 🚀

