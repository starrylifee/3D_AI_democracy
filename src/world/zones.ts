import * as THREE from 'three';
import { gltfLoader } from './loader';
import { mergeStatic } from './merge';
import type { Obstacle } from './town';

// 구역별 소품(public/models/zone_props.glb)을 놓는다. 각 구역의 갈등이 눈에 보이도록 시민 근처에 배치한다.
// 좌표는 시민 위치(useSimStore의 pos)와 마을 건물·도로를 피해서 정했다.

type Place = { name: string; x: number; z: number; rot?: number; s?: number; solid?: [number, number] };

const PLACES: Place[] = [
    // 북쪽 · 공유 킥보드: 점자블록 위에 넘어진 킥보드, 가게 앞을 막은 킥보드, 정해진 주차 구역
    ...[-22, -26, -30, -34].map((z) => ({ name: 'sc_tactile_strip', x: 7.5, z })),
    { name: 'sc_scooter_fallen', x: 7.6, z: -29, rot: 20 },
    { name: 'sc_kiosk', x: -11.5, z: -29.5, solid: [1.6, 1.1] },
    { name: 'sc_scooter', x: -8, z: -27, rot: 30 },
    { name: 'sc_scooter_fallen', x: -12.5, z: -26.8, rot: 80 },
    { name: 'sc_scooter_fallen', x: -12, z: -42.5, rot: -30 },
    { name: 'sc_parking_zone', x: 12, z: -38, rot: 90 },
    { name: 'sc_scooter', x: 11.4, z: -38.5, rot: 90 },
    { name: 'sc_scooter', x: 12.4, z: -37.3, rot: 90 },
    { name: 'sc_sign_caution', x: -7, z: -23, solid: [0.4, 0.4] },

    // 동쪽 · 반려동물 공원: 울타리 친 놀이터(남쪽 가운데가 열린 문), 개집, 허들, 배변봉투 함
    { name: 'pt_grass_patch', x: 38.8, z: -11, s: 0.9 },
    { name: 'pt_fence', x: 34.8, z: -5.8, solid: [2, 0.2] },
    { name: 'pt_fence_gate', x: 38.8, z: -5.8 },
    { name: 'pt_fence', x: 42.8, z: -5.8, solid: [2, 0.2] },
    ...[-7.8, -11.8, -15.6].flatMap((z) => [
        { name: 'pt_fence', x: 32.8, z, rot: 90, solid: [2, 0.2] as [number, number] },
        { name: 'pt_fence', x: 44.8, z, rot: 90, solid: [2, 0.2] as [number, number] },
    ]),
    { name: 'pt_doghouse', x: 41.5, z: -14, solid: [0.9, 0.9] },
    { name: 'pt_hurdle', x: 36, z: -10.5 },
    { name: 'pt_hurdle', x: 39.5, z: -9.2, rot: 15 },
    { name: 'pt_sign', x: 29, z: -15.5, solid: [1.6, 0.3] },
    { name: 'pt_waste_station', x: 30.5, z: -7, solid: [0.5, 0.4] },
    { name: 'yt_bench', x: 35, z: 12.5, solid: [1.6, 0.5] },
    { name: 'pt_waste_station', x: 39, z: 8.5, solid: [0.5, 0.4] },

    // 남쪽 · 청소년 공간: 농구 코트, 작은 무대, PC방 간판, 자판기, 스케이트 램프, 어르신 쉼터 벤치
    { name: 'yt_court', x: -11.3, z: 34 },
    { name: 'yt_basketball_hoop', x: -11.3, z: 28.9, solid: [0.6, 1.0] },
    { name: 'yt_stage', x: 11, z: 37, solid: [3.1, 2.1] },
    { name: 'yt_pc_sign', x: 13.5, z: 23, solid: [0.8, 0.4] },
    { name: 'yt_vending', x: 7.6, z: 30, rot: -90, solid: [0.7, 0.45] },
    { name: 'yt_skate_ramp', x: 14, z: 29.5, rot: -90, solid: [2.1, 1.6] },
    { name: 'yt_bench', x: -12.5, z: 22.2, solid: [1.6, 0.5] },

    // 서쪽 · 쓰레기 무단 투기: 분리수거함 옆에 몰래 버린 물건, 종량제 봉투 더미, CCTV, 청소차, 미화원 손수레
    { name: 'tr_recycle_set', x: -38, z: -9, solid: [2.3, 0.6] },
    { name: 'tr_dumped_pile', x: -32.5, z: -11.5, rot: 10, solid: [1.8, 1.6] },
    { name: 'tr_bag_pile', x: -43, z: -10.5, solid: [1.1, 1.1] },
    { name: 'tr_bag_pile', x: -27.5, z: -14, rot: 40, solid: [1.1, 1.1] },
    { name: 'tr_cctv_pole', x: -34, z: -15.5, solid: [0.4, 0.4] },
    { name: 'tr_cleaner_cart', x: -47.5, z: -8.5, solid: [0.6, 0.9] },
    { name: 'tr_garbage_truck', x: -38, z: 12, rot: 90, solid: [1.6, 3.6] },
    { name: 'tr_bag_pile', x: -44, z: 9.5, rot: -20, solid: [1.1, 1.1] },
];

export async function buildZoneProps(scene: THREE.Scene, obstacles: Obstacle[], url = '/models/zone_props.glb') {
    const lib = (await gltfLoader.loadAsync(url)).scene;
    const root = new THREE.Group();
    root.name = 'zone-props';
    for (const p of PLACES) {
        const src = lib.getObjectByName(p.name);
        if (!src) continue;
        const o = src.clone(true);
        o.position.set(p.x, 0, p.z);
        o.rotation.y = THREE.MathUtils.degToRad(p.rot ?? 0);
        o.scale.setScalar(p.s ?? 1);
        o.traverse((c) => {
            if ((c as THREE.Mesh).isMesh) {
                c.castShadow = true;
                c.receiveShadow = true;
            }
        });
        root.add(o);
        if (p.solid) {
            // solid는 돌리기 전 기준 반폭. 90도 돌린 소품은 가로·세로를 바꿔 준다
            const turned = Math.abs(Math.round((p.rot ?? 0) / 90)) % 2 === 1;
            const [hx, hz] = turned ? [p.solid[1], p.solid[0]] : p.solid;
            obstacles.push({ minX: p.x - hx, maxX: p.x + hx, minZ: p.z - hz, maxZ: p.z + hz, type: 'building', label: p.name });
        }
    }
    scene.add(root);
    mergeStatic(scene, root);
    return root;
}
