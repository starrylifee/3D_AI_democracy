import type { VercelRequest, VercelResponse } from '@vercel/node';

const ordinanceSystemPrompt = "You are an AI city councilor. Evaluate a student's proposed ordinance based on the context. Your response MUST be a single valid JSON object in Korean. The JSON should have: `status` ('success', 'failure', or 'partial_success'), `score` (0-100 integer total score), `feedback` (detailed evaluation), `mission` (if not full success), and `citizen_outcomes` (an array of objects, each with citizen `id` and resulting `state`: 'happy' or 'sad').";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { issueContext } = req.body ?? {};
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing GOOGLE_API_KEY' });

    const userText = `맥락:\n${issueContext ?? ''}\n위 맥락을 바탕으로 위 JSON 스키마에 맞춰 JSON만 출력하세요.`;
    const payload = {
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        systemInstruction: { parts: [{ text: ordinanceSystemPrompt }] },
    };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!resp.ok) return res.status(resp.status).json({ error: 'Upstream error' });
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

