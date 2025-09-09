export async function callChatAPI(history: Array<{ role: 'user' | 'model'; text: string }>, systemText: string): Promise<string> {
    const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history, systemText }),
    });
    if (!res.ok) throw new Error(`chat api error: ${res.status}`);
    const data = await res.json();
    return data.text as string;
}

export async function callJudgeAPI(issueContext: string): Promise<any> {
    const res = await fetch('/api/judge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueContext }),
    });
    if (!res.ok) throw new Error(`judge api error: ${res.status}`);
    return res.json();
}

