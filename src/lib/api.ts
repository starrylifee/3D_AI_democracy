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


export async function fetchLockedZones(): Promise<string[]> {
    const res = await fetch('/api/unlock');
    if (!res.ok) throw new Error(`unlock api error: ${res.status}`);
    const data = await res.json();
    return Array.isArray(data.locked) ? data.locked : [];
}

export async function tryUnlockZone(zone: string, password: string): Promise<boolean> {
    const res = await fetch('/api/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone, password }),
    });
    if (!res.ok) throw new Error(`unlock api error: ${res.status}`);
    const data = await res.json();
    return data.ok === true;
}
