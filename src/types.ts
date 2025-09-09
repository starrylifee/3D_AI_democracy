import * as THREE from 'three';

export type NpcState = 'neutral' | 'happy' | 'sad';

export interface Citizen {
    id: string;
    name: string;
    role: string;
    emoji: string;
    color: number;
    pos: THREE.Vector3;
    persona: string;
    initialRequest: string;
    object?: THREE.Group;
    marker?: THREE.Object3D;
    actions?: {
        mixer: THREE.AnimationMixer;
        idle: THREE.AnimationAction;
        happy: THREE.AnimationAction;
        sad: THREE.AnimationAction;
        current: THREE.AnimationAction;
    };
}

export interface Issue {
    title: string;
    councilor: Citizen;
    citizens: Citizen[];
}

export interface OrdinanceResult {
    status: 'success' | 'failure' | 'partial_success' | 'error';
    feedback: string;
    mission?: string;
    citizen_outcomes?: Array<{ id: string; state: 'happy' | 'sad' }>;
}

