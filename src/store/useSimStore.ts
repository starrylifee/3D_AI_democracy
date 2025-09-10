import { create } from 'zustand';
import * as THREE from 'three';
import { Citizen, Issue, NpcState } from '../types';

type ConversationMessage = { role: 'user' | 'model'; text: string };

interface SimState {
    simulationStarted: boolean;
    canInteract: boolean;
    activeNPC: (Citizen & { issueKey: string }) | null;
    currentOrdinanceIssue: string | null;
    keys: { w: boolean; a: boolean; s: boolean; d: boolean };
    npcStates: Record<string, NpcState>;
    conversationHistories: Record<string, ConversationMessage[]>;
    issues: Record<string, Issue>;
    questsCompleted: Record<string, Set<string>>;
    ordinanceDrafts: Record<string, string>;
    MAP_SIZE: number;
    WORLD_SIZE: number;
    badges: string[];
    setSimulationStarted(v: boolean): void;
    setCanInteract(v: boolean): void;
    setActiveNPC(npc: (Citizen & { issueKey: string }) | null): void;
    setCurrentOrdinanceIssue(issueKey: string | null): void;
    setKey(key: 'w' | 'a' | 's' | 'd', v: boolean): void;
    pushConversation(id: string, msg: ConversationMessage): void;
    markQuestDone(issueKey: string, npcId: string): void;
    setNpcState(id: string, state: NpcState): void;
    setOrdinanceDraft(issueKey: string, text: string): void;
    hydrateFromLocalStorage(): void;
    persistToLocalStorage(): void;
    addBadge(npcId: string): void;
    clearAllConversations(): void;
    resetAllProgress(): void;
}

const initialIssues: Record<string, Issue> = {
    scooter: {
        title: '공유 킥보드 갈등 (북쪽)',
        councilor: { id: 'councilor_scooter', name: '김 정책', emoji: '🛴', color: 0xffd700, pos: new THREE.Vector3(0, 0, -35), persona: "당신은 늘푸른시의 '김 정책' 시의원입니다. 공유 킥보드 문제에 대한 다양한 민원을 받고 있으며, 모든 이해관계자를 만족시키는 균형 잡힌 해결책을 찾고 있습니다. 학생(사용자)에게 조례안을 제출하도록 유도하고, 그 내용을 AI로서 평가해야 합니다. 전문적이고 중립적인 태도를 유지하세요.", initialRequest: '공유 킥보드 문제로 시민들의 의견이 나뉘고 있습니다. 지혜로운 해결책이 필요합니다.' },
        citizens: [
            { id: 'parent', name: '김민준', role: '초등학생 학부모', emoji: '👨‍👩‍👧‍👦', color: 0xf6ad55, pos: new THREE.Vector3(-15, 0, -45), persona: "당신은 초등학생 자녀를 둔 학부모 '김민준'입니다. 인도와 골목을 질주하는 공유 킥보드 때문에 아이의 안전이 매우 걱정됩니다. 강력한 규제와 처벌을 원하며, 안전 문제를 최우선으로 생각합니다. 불안하고 단호한 어조로 대화하세요.", initialRequest: '길에서 아이들이 너무 위험해요! 공유 킥보드 좀 어떻게 해주세요.' },
            { id: 'student', name: '박서연', role: '대학생 이용자', emoji: '👩‍🎓', color: 0x68d391, pos: new THREE.Vector3(15, 0, -45), persona: "당신은 등하교 시 공유 킥보드를 애용하는 대학생 '박서연'입니다. 킥보드는 저렴하고 편리한 교통수단이며, 과도한 규제는 이동의 자유를 침해한다고 생각합니다. 이용자 편의를 고려한 대책을 주장하며, 약간 억울하고 답답한 심정으로 대화하세요.", initialRequest: '킥보드는 편리한 교통수단인데, 무조건 막기만 하면 저희는 어떡하나요?' },
            { id: 'owner', name: '최영수', role: '상점 주인', emoji: '👨‍🍳', color: 0xf687b3, pos: new THREE.Vector3(-10, 0, -25), persona: "당신은 작은 가게를 운영하는 '최영수'입니다. 가게 입구에 아무렇게나 버려진 킥보드 때문에 영업에 큰 방해를 받고 있습니다. 무단 주차된 킥보드를 강력하게 견인하거나 과태료를 부과해야 한다고 생각합니다. 짜증 섞인 목소리로 불만을 토로하세요.", initialRequest: '가게 앞에 아무렇게나 세워둔 킥보드 때문에 장사를 못하겠어요!' },
            { id: 'disabled', name: '이지혜', role: '휠체어 이용자', emoji: '👩‍🦽', color: 0x9f7aea, pos: new THREE.Vector3(10, 0, -25), persona: '당신은 휠체어를 이용하는 이지혜입니다. 이동권 보장이 최우선입니다.', initialRequest: '인도를 막고 있는 킥보드는 저희에겐 거대한 벽이에요. 이동권을 보장해주세요.' },
        ],
    },
    pet: {
        title: '반려동물 갈등 (동쪽)',
        councilor: { id: 'councilor_pet', name: '이 민원', emoji: '🐾', color: 0xffd700, pos: new THREE.Vector3(35, 0, 0), persona: "당신은 '이 민원' 시의원입니다. 반려동물 공원 문제로 주민 갈등이 심각하여 고심이 깊습니다. 반려인과 비반려인 모두를 위한 해결책을 모색하고 있습니다. 신중하고 공감하는 태도로 대화하세요.", initialRequest: '반려동물 공원 문제, 어떻게 하면 모두가 만족할 수 있을까요?' },
        citizens: [
            { id: 'pet_owner', name: '강아지 사랑', role: '반려견주', emoji: '🐶', color: 0xf6ad55, pos: new THREE.Vector3(45, 0, -5), persona: '강아지가 마음껏 뛰어놀 공간이 없어 안타깝습니다.', initialRequest: '우리 강아지가 마음껏 뛰어놀 수 있는 반려동물 공원을 만들어주세요.' },
            { id: 'resident', name: '조용한 주민', role: '인근 주민', emoji: '🏡', color: 0x68d391, pos: new THREE.Vector3(45, 0, 5), persona: '개 짖는 소음과 배설물 문제로 스트레스가 많습니다.', initialRequest: '공원에 개들이 짖고 배설물도 너무 많아요. 조용한 공원을 돌려주세요.' },
            { id: 'non_pet_owner', name: '아이 엄마', role: '비반려인', emoji: '👩‍👧', color: 0xf687b3, pos: new THREE.Vector3(25, 0, -10), persona: '아이들의 안전이 최우선입니다.', initialRequest: '목줄 풀린 개들 때문에 아이들이 불안에 떨고 있어요. 안전 대책이 시급합니다.' },
            { id: 'vet', name: '박 수의사', role: '수의사', emoji: '🩺', color: 0x9f7aea, pos: new THREE.Vector3(25, 0, 10), persona: '반려인 교육과 공간 분리가 필요합니다.', initialRequest: '반려동물과 사람이 함께 행복할 수 있는 규칙과 공간이 필요합니다.' },
        ],
    },
    youth: {
        title: '청소년 공간 부족 (남쪽)',
        councilor: { id: 'councilor_youth', name: '박 미래', emoji: '🎧', color: 0xffd700, pos: new THREE.Vector3(0, 0, 35), persona: '청소년들의 목소리를 듣고 싶어합니다.', initialRequest: '우리 시의 미래인 청소년들을 위한 공간, 어떻게 마련해야 할까요?' },
        citizens: [
            { id: 'teenager', name: '이 학생', role: '고등학생', emoji: '🧑‍🎤', color: 0xf6ad55, pos: new THREE.Vector3(-15, 0, 45), persona: '자유롭게 활동할 공간이 필요합니다.', initialRequest: '친구들과 편하게 놀 수 있는 우리들만의 공간이 있었으면 좋겠어요.' },
            { id: 'police', name: '나 순경', role: '지구대 경찰', emoji: '👮', color: 0x68d391, pos: new THREE.Vector3(15, 0, 45), persona: '건전한 공간이 있다면 예방에 도움이 됩니다.', initialRequest: '청소년들이 갈 곳이 없어 거리를 방황하면 범죄에 노출되기 쉬워요. 대책이 필요합니다.' },
            { id: 'elder', name: '어르신', role: '동네 어르신', emoji: '👴', color: 0xf687b3, pos: new THREE.Vector3(-10, 0, 25), persona: '학생들이 시끄럽게 떠드는 모습을 걱정합니다.', initialRequest: '학생들이 밤늦게 시끄럽게 떠들고 담배 피우는 모습이 보기 안쓰러워요. 쉴 곳이 없어서 그런가...' },
            { id: 'pc_owner', name: 'PC방 사장', role: 'PC방 운영자', emoji: '💻', color: 0x9f7aea, pos: new THREE.Vector3(10, 0, 25), persona: '건전한 놀이 공간이 지역에 좋습니다.', initialRequest: 'PC방 말고는 갈 곳이 없는 요즘 아이들이 안타까워요. 시에서 건전한 놀이 공간을 만들어주세요.' },
        ],
    },
    trash: {
        title: '쓰레기 무단 투기 (서쪽)',
        councilor: { id: 'councilor_trash', name: '최 환경', emoji: '🗑️', color: 0xffd700, pos: new THREE.Vector3(-35, 0, 0), persona: '강력한 단속과 의식 개선이 필요합니다.', initialRequest: '깨끗한 도시를 위해 쓰레기 무단 투기 문제를 해결할 좋은 방법이 없을까요?' },
        citizens: [
            { id: 'cleaner', name: '환경미화원', role: '환경미화원', emoji: '🧹', color: 0xf6ad55, pos: new THREE.Vector3(-45, 0, -5), persona: '분리수거 미이행이 심각합니다.', initialRequest: '분리수거도 안 된 쓰레기들 때문에 일이 몇 배는 힘들어졌어요. 무단 투기를 막을 방법이 필요합니다.' },
            { id: 'villa_resident', name: '빌라 주민', role: '빌라 주민', emoji: '🏘️', color: 0x68d391, pos: new THREE.Vector3(-45, 0, 5), persona: '종량제 봉투 지원이 필요합니다.', initialRequest: '종량제 봉투 값이 너무 비싸서 그런지 자꾸 쓰레기를 몰래 버리는 사람이 있어요.' },
            { id: 'restaurant_owner', name: '식당 사장', role: '음식점 주인', emoji: '🍽️', color: 0xf687b3, pos: new THREE.Vector3(-25, 0, -10), persona: 'CCTV 설치 지원을 원합니다.', initialRequest: '가게 앞에 누가 자꾸 쓰레기를 버리고 가서 골치가 아파요. CCTV라도 달아야 할 판입니다.' },
            { id: 'office_worker', name: '직장인', role: '1인 가구 직장인', emoji: '🧑‍💼', color: 0x9f7aea, pos: new THREE.Vector3(-25, 0, 10), persona: '상시 수거 시스템이 필요합니다.', initialRequest: '쓰레기 버리는 날짜와 시간이 정해져 있으니 바쁜 직장인들은 맞추기가 너무 힘들어요.' },
        ],
    },
};

const INITIAL_STATE: Omit<SimState, 'setSimulationStarted' | 'setCanInteract' | 'setActiveNPC' | 'setCurrentOrdinanceIssue' | 'setKey' | 'pushConversation' | 'markQuestDone' | 'setNpcState' | 'setOrdinanceDraft' | 'hydrateFromLocalStorage' | 'persistToLocalStorage' | 'addBadge' | 'clearAllConversations'> = {
    simulationStarted: false,
    canInteract: false,
    activeNPC: null,
    currentOrdinanceIssue: null,
    keys: { w: false, a: false, s: false, d: false },
    npcStates: {},
    conversationHistories: {},
    issues: initialIssues,
    questsCompleted: Object.fromEntries(Object.keys(initialIssues).map(k => [k, new Set<string>()])),
    MAP_SIZE: 200,
    WORLD_SIZE: 100,
    ordinanceDrafts: {},
    badges: [],
};

export const useSimStore = create<SimState>((set, get) => ({
    ...INITIAL_STATE,
    setSimulationStarted(v) { set({ simulationStarted: v }); },
    setCanInteract(v) { set({ canInteract: v }); },
    setActiveNPC(npc) { set({ activeNPC: npc }); },
    setCurrentOrdinanceIssue(issueKey) { set({ currentOrdinanceIssue: issueKey }); },
    setKey(key, v) { set({ keys: { ...get().keys, [key]: v } }); },
    pushConversation(id, msg) {
        const prev = get().conversationHistories[id] ?? [];
        set({ conversationHistories: { ...get().conversationHistories, [id]: [...prev, msg] } });
        get().persistToLocalStorage();
    },
    markQuestDone(issueKey, npcId) {
        const qc = get().questsCompleted;
        const next = new Set(qc[issueKey] ?? new Set());
        next.add(npcId);
        set({ questsCompleted: { ...qc, [issueKey]: next } });
        get().persistToLocalStorage();
    },
    setNpcState(id, state) {
        set({ npcStates: { ...get().npcStates, [id]: state } });
        get().persistToLocalStorage();
    },
    setOrdinanceDraft(issueKey, text) {
        set({ ordinanceDrafts: { ...get().ordinanceDrafts, [issueKey]: text } });
        get().persistToLocalStorage();
    },
    addBadge(npcId) {
        const current = get().badges;
        if (current.includes(npcId)) return;
        set({ badges: [...current, npcId] });
        get().persistToLocalStorage();
    },
    clearAllConversations() {
        set({ conversationHistories: {} });
        get().persistToLocalStorage();
    },
    resetAllProgress() {
        try { localStorage.removeItem('sim-state'); } catch {}
        const emptyQuests: Record<string, Set<string>> = Object.fromEntries(
            Object.keys(get().issues).map(k => [k, new Set<string>()])
        );
        set({
            simulationStarted: false,
            canInteract: false,
            activeNPC: null,
            currentOrdinanceIssue: null,
            npcStates: {},
            conversationHistories: {},
            questsCompleted: emptyQuests,
            ordinanceDrafts: {},
            badges: [],
        });
        get().persistToLocalStorage();
    },
    hydrateFromLocalStorage() {
        try {
            const raw = localStorage.getItem('sim-state');
            if (!raw) return;
            const data = JSON.parse(raw);
            const questsCompleted: Record<string, Set<string>> = Object.fromEntries(
                Object.entries(data.questsCompleted ?? {}).map(([k, arr]) => [k, new Set(arr as string[])])
            );
            set({
                npcStates: data.npcStates ?? {},
                conversationHistories: data.conversationHistories ?? {},
                questsCompleted,
                ordinanceDrafts: data.ordinanceDrafts ?? {},
                badges: data.badges ?? [],
            });
        } catch {}
    },
    persistToLocalStorage() {
        try {
            const { npcStates, conversationHistories, questsCompleted, ordinanceDrafts, badges } = get();
            const qcObj = Object.fromEntries(Object.entries(questsCompleted).map(([k, s]) => [k, Array.from(s)]));
            localStorage.setItem('sim-state', JSON.stringify({ npcStates, conversationHistories, questsCompleted: qcObj, ordinanceDrafts, badges }));
        } catch {}
    },
}));

