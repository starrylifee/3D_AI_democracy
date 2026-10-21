import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// 캐릭터 모델(public/models/characters/<id>.glb)을 불러와 동작(Idle/Walk/Sit)을 재생한다.
// 파일마다 키 2.4, 발바닥이 원점, 정면이 +Z다. 게임에서는 1.2배로 키워 쓴다.

export type CharacterHandle = {
    root: THREE.Object3D;
    mixer: THREE.AnimationMixer;
    play: (name: 'Idle' | 'Walk' | 'Sit') => void;
    // 한 번 재생하는 점프. 점프 동작이 없거나 이미 뛰는 중이면 false
    jump: () => boolean;
};

const loader = new GLTFLoader();
// 원본 키 2.4는 마을에 비해 작아 보여서 조금 키운다
const CHARACTER_SCALE = 1.2;

export async function loadCharacter(id: string): Promise<CharacterHandle> {
    const gltf = await loader.loadAsync(`/models/characters/${id}.glb`);
    const root = gltf.scene;
    root.scale.setScalar(CHARACTER_SCALE);
    root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
            o.castShadow = true;
            // 동작 중 경계 상자가 안 맞아 화면 끝에서 사라지는 것을 막는다
            o.frustumCulled = false;
        }
    });
    const mixer = new THREE.AnimationMixer(root);
    const actions = new Map(gltf.animations.map((clip) => [clip.name, mixer.clipAction(clip)]));
    let current: THREE.AnimationAction | null = null;
    let jumping = false;
    const play = (name: 'Idle' | 'Walk' | 'Sit') => {
        if (jumping) return;
        const next = actions.get(name) ?? actions.get('Idle');
        if (!next || next === current) return;
        next.reset().fadeIn(0.2).play();
        current?.fadeOut(0.2);
        current = next;
    };
    const jump = () => {
        const j = actions.get('Jump');
        if (!j || jumping) return false;
        jumping = true;
        j.reset();
        j.setLoop(THREE.LoopOnce, 1);
        j.clampWhenFinished = true;
        j.timeScale = 1.3;
        j.fadeIn(0.08).play();
        current?.fadeOut(0.08);
        current = j;
        const onFinished = (e: { action: THREE.AnimationAction }) => {
            if (e.action !== j) return;
            mixer.removeEventListener('finished', onFinished as any);
            jumping = false;
            play('Idle');
        };
        mixer.addEventListener('finished', onFinished as any);
        return true;
    };
    const first = actions.has('Sit') ? 'Sit' : 'Idle';
    play(first);
    // 시민들이 똑같이 움직이지 않게 시작 시점을 흩뜨린다
    const action = actions.get(first);
    if (action) action.time = Math.random() * action.getClip().duration;
    return { root, mixer, play, jump };
}
