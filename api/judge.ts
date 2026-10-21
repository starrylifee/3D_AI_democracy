import type { VercelRequest, VercelResponse } from '@vercel/node';

// 2026-11-10 0시(KST)부터는 무료키(GOOGLE_API_KEY_FREE)만 쓴다. 무료키가 등록 안 돼 있으면 기존 키를 그대로 쓴다.
const FREE_KEY_FROM = Date.parse(process.env.FREE_KEY_FROM ?? '2026-11-10T00:00:00+09:00');
function pickApiKey() {
    const free = process.env.GOOGLE_API_KEY_FREE?.trim();
    if (free && Date.now() >= FREE_KEY_FROM) return free;
    return process.env.GOOGLE_API_KEY?.trim();
}

const ordinanceSystemPrompt = "You are an AI city councilor. Evaluate a student's proposed ordinance based on the context. Your response MUST be a single valid JSON object in Korean. The JSON should have: `status` ('success', 'failure', or 'partial_success'), `score` (0-100 integer total score), `feedback` (detailed evaluation, maximum 10 sentences), `mission` (if not full success), and `citizen_outcomes` (an array of objects, each with citizen `id` and resulting `state`: 'happy' or 'sad'). Keep the `feedback` concise and within 10 sentences.";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { issueContext } = req.body ?? {};
    const apiKey = pickApiKey();
    if (!apiKey) return res.status(500).json({ error: 'Missing GOOGLE_API_KEY' });

    const userText = `맥락:\n${issueContext ?? ''}\n위 맥락을 바탕으로 위 JSON 스키마에 맞춰 JSON만 출력하세요.`;
    const payload = {
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        systemInstruction: { parts: [{ text: ordinanceSystemPrompt }] },
    };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!resp.ok) {
        console.error('[api] upstream error', resp.status, await resp.text());
        return res.status(resp.status).json({ error: 'Upstream error' });
    }
    const json = await resp.json();
    const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    let parsed: any;
    try {
        parsed = JSON.parse(String(raw).trim().replace(/```json|```/g, ''));
    } catch (e) {
        return res.status(200).json({ status: 'error', feedback: 'AI 평가 JSON 파싱 실패' });
    }
    // score가 문자열로 오는 경우 정수로 보정
    try {
        const s = parsed?.score;
        if (typeof s === 'string') {
            const n = parseInt(s, 10);
            if (!Number.isNaN(n)) parsed.score = n;
        }
    } catch {}
    return res.status(200).json(parsed);
}

