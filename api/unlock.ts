import type { VercelRequest, VercelResponse } from '@vercel/node';

// 구역 비밀번호는 소스에 두지 않고 Vercel 환경변수 ZONE_PASSWORDS(JSON, 예: {"scooter":"1234"})에만 둔다.
// 비밀번호가 없는 구역은 처음부터 열려 있다.
function readPasswords(): Record<string, string> {
    try {
        const table = JSON.parse(process.env.ZONE_PASSWORDS ?? '{}');
        return table && typeof table === 'object' ? table : {};
    } catch {
        return {};
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const table = readPasswords();
    // GET: 잠긴 구역 목록만 알려준다 (비밀번호는 보내지 않음)
    if (req.method === 'GET') return res.status(200).json({ locked: Object.keys(table) });
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { zone, password } = req.body ?? {};
    const expected = typeof zone === 'string' ? table[zone] : undefined;
    if (expected === undefined) return res.status(200).json({ ok: true });
    const ok = String(password ?? '').trim() === String(expected);
    // 마구 눌러 맞히기를 늦추려고 틀리면 잠깐 기다렸다 답한다
    if (!ok) await new Promise((r) => setTimeout(r, 800));
    return res.status(200).json({ ok });
}
