import type { VercelRequest, VercelResponse } from '@vercel/node';

// 2026-11-10 0시(KST)부터는 무료키(GOOGLE_API_KEY_FREE)만 쓴다. 무료키가 등록 안 돼 있으면 기존 키를 그대로 쓴다.
const FREE_KEY_FROM = Date.parse(process.env.FREE_KEY_FROM ?? '2026-11-10T00:00:00+09:00');
function pickApiKey() {
    const free = process.env.GOOGLE_API_KEY_FREE?.trim();
    if (free && Date.now() >= FREE_KEY_FROM) return free;
    return process.env.GOOGLE_API_KEY?.trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { history, systemText } = req.body ?? {};
    const apiKey = pickApiKey();
    if (!apiKey) return res.status(500).json({ error: 'Missing GOOGLE_API_KEY' });

    const payload = {
        contents: (history ?? []).map((m: any) => ({ role: m.role, parts: [{ text: m.text }] })),
        systemInstruction: { parts: [{ text: systemText ?? '' }] },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!resp.ok) {
        console.error('[api] upstream error', resp.status, await resp.text());
        return res.status(resp.status).json({ error: 'Upstream error' });
    }
    const json = await resp.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return res.status(200).json({ text });
}

