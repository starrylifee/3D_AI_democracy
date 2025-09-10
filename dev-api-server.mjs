import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const app = express();
app.use(express.json({ limit: '50mb' }));

const PORT = (process.env.API_PORT || 3000);
let GOOGLE_API_KEY = (process.env.GOOGLE_API_KEY || '').trim();
const obfuscatedKey = GOOGLE_API_KEY ? `${GOOGLE_API_KEY.slice(0, 4)}...${GOOGLE_API_KEY.slice(-4)}` : '';
console.log('[dev-api] config', { PORT: String(PORT).trim(), hasKey: Boolean(GOOGLE_API_KEY), keyPreview: obfuscatedKey });

app.post('/api/chat', async (req, res) => {
  console.log('[dev-api] /api/chat payload', JSON.stringify(req.body)?.slice(0, 200));
  try {
    const { history = [], systemText = '' } = req.body || {};
    if (!GOOGLE_API_KEY) return res.status(500).json({ error: 'Missing GOOGLE_API_KEY' });
    const payload = {
      contents: history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
      systemInstruction: { parts: [{ text: systemText }] },
    };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GOOGLE_API_KEY}`;
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!resp.ok) {
      const text = await resp.text();
      console.error('[dev-api] upstream chat error', resp.status, text);
      return res.status(resp.status).json({ error: 'Upstream error', detail: text });
    }
    const json = await resp.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return res.status(200).json({ text });
  } catch (e) {
    console.error('[dev-api] chat exception', e);
    return res.status(500).json({ error: 'dev chat error' });
  }
});

app.post('/api/judge', async (req, res) => {
  console.log('[dev-api] /api/judge payload', JSON.stringify(req.body)?.slice(0, 200));
  try {
    const { issueContext = '' } = req.body || {};
    if (!GOOGLE_API_KEY) return res.status(500).json({ error: 'Missing GOOGLE_API_KEY' });
    const prompt = "You are an AI city councilor. Evaluate a student's proposed ordinance based on the context. Your response MUST be a single valid JSON object in Korean. The JSON must include: `status` ('success', 'failure', or 'partial_success'), `score` (0-100 integer total score), `feedback` (detailed evaluation, maximum 10 sentences), `mission` (if not full success), and `citizen_outcomes` (an array of objects, each with citizen `id` and resulting `state`: 'happy' or 'sad'). Keep `feedback` within 10 sentences. Keep it as valid JSON ONLY. Context: " + issueContext;
    const payload = {
      contents: [],
      systemInstruction: { parts: [{ text: prompt }] },
    };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GOOGLE_API_KEY}`;
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!resp.ok) {
      const text = await resp.text();
      console.error('[dev-api] upstream judge error', resp.status, text);
      return res.status(resp.status).json({ error: 'Upstream error', detail: text });
    }
    const json = await resp.json();
    const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    try {
      const parsed = JSON.parse(String(raw).trim().replace(/```json|```/g, ''));
      return res.status(200).json(parsed);
    } catch {
      return res.status(200).json({ status: 'error', feedback: 'AI 평가 JSON 파싱 실패' });
    }
  } catch (e) {
    console.error('[dev-api] judge exception', e);
    return res.status(500).json({ error: 'dev judge error' });
  }
});

app.listen(PORT, () => {
  console.log(`[dev-api] listening on http://localhost:${PORT}`);
});


