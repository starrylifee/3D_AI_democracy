import * as THREE from 'three';
import { gltfLoader } from './loader';
import { mergeStatic } from './merge';

// 마을 겉모습: public/models/town.glb의 조각들을 이름으로 꺼내 배치한다.
// 부딪힘 범위(시청·건물·공사장)는 App에서 이미 등록한 것을 그대로 쓰고, 여기서는 새로 놓는 소품(나무·차·가로등)만 추가한다.

export type Obstacle = { minX: number; maxX: number; minZ: number; maxZ: number; type: 'building' | 'pillar' | 'noentry'; label?: string };

export async function loadTownLibrary(url = '/models/town.glb'): Promise<THREE.Object3D> {
    const gltf = await gltfLoader.loadAsync(url);
    return gltf.scene;
}

// 결정적 난수(매번 같은 배치)
function seeded(seed: number) {
    let s = seed;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

// 카메라와 캐릭터 사이를 가리는 건물은 반투명하게 만든다. 건물마다 재질을 따로 복제해 둔다.
function makeFadeable(o: THREE.Object3D) {
    const mats: THREE.Material[] = [];
    o.traverse((c) => {
        const mesh = c as THREE.Mesh;
        if (!mesh.isMesh) return;
        const cloneMat = (m: THREE.Material) => { const n = m.clone(); mats.push(n); return n; };
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(cloneMat) : cloneMat(mesh.material);
    });
    o.updateWorldMatrix(true, true);
    return { box: new THREE.Box3().setFromObject(o), mats, fade: 1 };
}

export function buildTown(scene: THREE.Scene, lib: THREE.Object3D, obstacles: Obstacle[], worldSize: number) {
    const half = worldSize / 2;
    const root = new THREE.Group();
    root.name = 'town';
    scene.add(root);
    const fadeables: Array<ReturnType<typeof makeFadeable>> = [];
    const fadeObjects: THREE.Object3D[] = [];

    function put(name: string, x: number, z: number, opts: { rot?: number; s?: number; sy?: number; y?: number; shadow?: boolean } = {}) {
        const src = lib.getObjectByName(name);
        if (!src) return null;
        const o = src.clone(true);
        const s = opts.s ?? 1;
        o.scale.set(s, opts.sy ?? s, s);
        o.position.set(x, opts.y ?? 0, z);
        o.rotation.y = THREE.MathUtils.degToRad(opts.rot ?? 0);
        o.traverse((c) => {
            if ((c as THREE.Mesh).isMesh) {
                c.castShadow = opts.shadow ?? true;
                c.receiveShadow = true;
            }
        });
        root.add(o);
        return o;
    }
    function block(x: number, z: number, hx: number, hz: number, label: string) {
        obstacles.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz, type: 'building', label });
    }

    // 바닥: 걸을 수 있는 땅보다 넓게 깔아 경계 밖 숲까지 덮는다
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(worldSize * 2.6, worldSize * 2.6), new THREE.MeshStandardMaterial({ color: 0x7cc46a, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    root.add(ground);

    // 시청 앞 광장(가운데 40x20) 보도 타일, 십자 도로(폭 10). 타일 원본은 2x2.
    const TILE = 5;
    for (const x of [-15, -5, 5, 15]) for (const z of [-5, 5]) put('kk_base', x, z, { s: TILE, sy: 1, shadow: false });
    for (let z = 15; z < half; z += 10) {
        for (const sz of [z, -z]) put(Math.abs(sz) === 25 ? 'kk_road_straight_crossing' : 'kk_road_straight', 0, sz, { s: TILE, sy: 1, shadow: false });
    }
    for (let x = 25; x < half; x += 10) {
        for (const sx of [x, -x]) put(Math.abs(sx) === 25 ? 'kk_road_straight_crossing' : 'kk_road_straight', sx, 0, { s: TILE, sy: 1, rot: 90, shadow: false });
    }

    // 시청 (본관·기둥 부딪힘은 App에 이미 있음)
    const hall = put('cityhall', 0, 0);
    if (hall) { fadeables.push(makeFadeable(hall)); fadeObjects.push(hall); }

    // 네 모서리 건물 블록: 25x25 자리에 2x2로 4채 (원본 2x2 → 12x12)
    const blocks: Array<[number, number, string]> = [[-30, -30, 'ABCD'], [30, -30, 'EFGH'], [-30, 30, 'CEGA'], [30, 30, 'BDFH']];
    for (const [bx, bz, kinds] of blocks) {
        [...kinds].forEach((k, i) => {
            const b = put(`kk_building_${k}`, bx + (i % 2 ? 6 : -6), bz + (i < 2 ? -6 : 6), { s: 6 });
            if (b) { fadeables.push(makeFadeable(b)); fadeObjects.push(b); }
        });
    }

    // 가로등: 도로 가장자리에서 도로 쪽으로 팔을 뻗게 놓는다
    for (const z of [15, -15, 40, -40]) {
        for (const side of [1, -1]) {
            put('kk_streetlight', side * 6.5, z, { s: 6, rot: side > 0 ? 180 : 0 });
            block(side * 6.5, z, 0.4, 0.4, 'streetlight');
        }
    }
    for (const x of [40, -40]) {
        for (const side of [1, -1]) {
            put('kk_streetlight', x, side * 6.5, { s: 6, rot: side > 0 ? 90 : -90 });
            block(x, side * 6.5, 0.4, 0.4, 'streetlight');
        }
    }

    // 세워 둔 차 (원본 길이 0.94 → 약 5.6)
    const cars: Array<[string, number, number, number]> = [['kk_car_taxi', 3, -46, 0], ['kk_car_sedan', -3, -46, 180], ['kk_car_police', 3, 46.5, 0]];
    for (const [name, x, z, rot] of cars) {
        put(name, x, z, { s: 6, rot });
        block(x, z, 1.4, 2.9, 'car');
    }

    // 공사장: App이 등록한 출입 불가 구역을 흙바닥과 바리케이드로 둘러싼다
    const dirt = new THREE.MeshStandardMaterial({ color: 0xb08d5b, roughness: 1 });
    for (const ob of obstacles.filter((o) => o.type === 'noentry')) {
        const pad = 0.2;
        const minX = ob.minX + pad, maxX = ob.maxX - pad, minZ = ob.minZ + pad, maxZ = ob.maxZ - pad;
        const w = maxX - minX, d = maxZ - minZ, cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
        const patch = new THREE.Mesh(new THREE.PlaneGeometry(w, d), dirt);
        patch.rotation.x = -Math.PI / 2;
        patch.position.set(cx, 0.06, cz);
        patch.receiveShadow = true;
        root.add(patch);
        const step = 3;
        for (let x = minX + step / 2; x < maxX; x += step) {
            put('barricade', x, minZ, { s: 1.5 });
            put('barricade', x, maxZ, { s: 1.5 });
        }
        for (let z = minZ + step / 2; z < maxZ; z += step) {
            put('barricade', minX, z, { s: 1.5, rot: 90 });
            put('barricade', maxX, z, { s: 1.5, rot: 90 });
        }
        for (const [x, z] of [[minX, minZ], [maxX, minZ], [minX, maxZ], [maxX, maxZ]]) put('cone', x, z, { s: 1.5 });
        put('kk_box_A', cx - w / 4, cz, { s: 4, rot: 20 });
        put('kk_box_B', cx + w / 5, cz + d / 6, { s: 4, rot: -15 });
    }

    // 숲: 경계 밖을 한 바퀴 두르고, 건물 블록 바깥 빈터에도 몇 군데 심는다
    const rand = seeded(7);
    const tree = (x: number, z: number, s: number) =>
        put(rand() < 0.5 ? 'kn_grass_trees' : 'kn_grass_trees_tall', x, z, { s, rot: Math.floor(rand() * 4) * 90 });
    const ring = half + 6;
    for (let t = -ring; t <= ring; t += 8) {
        tree(t, -ring, 8); tree(t, ring, 8);
        if (Math.abs(t) < ring) { tree(-ring, t, 8); tree(ring, t, 8); }
    }
    for (const [x, z] of [[46.5, 25], [46.5, -25], [-46.5, 25], [-46.5, -25], [25, 46.5], [-25, 46.5], [25, -46.5], [-25, -46.5], [46.5, 46.5], [-46.5, 46.5], [46.5, -46.5], [-46.5, -46.5]]) {
        tree(x, z, 7);
        block(x, z, 3.5, 3.5, 'trees');
    }

    // 움직이지 않는 도로·나무·가로등 등은 재질별로 합친다 (반투명 처리할 건물은 제외)
    mergeStatic(scene, root, fadeObjects);

    // 매 프레임 호출: 카메라→캐릭터 시선에 걸린 건물을 서서히 반투명하게
    const ray = new THREE.Ray();
    const eye = new THREE.Vector3();
    const hit = new THREE.Vector3();
    function updateFade(camera: THREE.Camera, target: THREE.Vector3) {
        eye.set(target.x, target.y + 1.5, target.z);
        const dist = camera.position.distanceTo(eye);
        ray.origin.copy(camera.position);
        ray.direction.copy(eye).sub(camera.position).normalize();
        for (const f of fadeables) {
            const blocked = ray.intersectBox(f.box, hit) !== null && camera.position.distanceTo(hit) < dist;
            const goal = blocked ? 0.25 : 1;
            if (Math.abs(goal - f.fade) < 0.01) continue;
            f.fade += (goal - f.fade) * 0.15;
            if (Math.abs(goal - f.fade) < 0.01) f.fade = goal;
            for (const m of f.mats) {
                m.opacity = f.fade;
                m.transparent = f.fade < 1;
                m.depthWrite = f.fade >= 1;
            }
        }
    }
    return { root, updateFade };
}
