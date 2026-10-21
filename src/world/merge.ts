import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// 움직이지 않는 메시를 재질별로 하나로 합쳐 그리기 횟수(draw call)를 줄인다. 크롬북 성능용.
// keep 안의 객체(반투명 처리하는 건물 등)는 건드리지 않는다.

function toFloat(attr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) {
    // 압축(양자화)된 정수 속성은 변환 행렬을 곱하기 전에 실수로 풀어 둔다
    const out = new Float32Array(attr.count * attr.itemSize);
    const get = [attr.getX, attr.getY, attr.getZ, attr.getW];
    for (let i = 0; i < attr.count; i++) {
        for (let k = 0; k < attr.itemSize; k++) out[i * attr.itemSize + k] = get[k].call(attr, i);
    }
    return new THREE.BufferAttribute(out, attr.itemSize);
}

function prepared(mesh: THREE.Mesh) {
    const src = mesh.geometry;
    const g = new THREE.BufferGeometry();
    for (const name of Object.keys(src.attributes)) g.setAttribute(name, toFloat(src.attributes[name] as THREE.BufferAttribute));
    g.setIndex(src.index ? Array.from(src.index.array) : [...Array(src.attributes.position.count).keys()]);
    g.applyMatrix4(mesh.matrixWorld);
    return g;
}

export function mergeStatic(scene: THREE.Scene, root: THREE.Object3D, keep: THREE.Object3D[] = []) {
    root.updateMatrixWorld(true);
    const kept = new Set<THREE.Object3D>();
    keep.forEach((k) => k.traverse((o) => kept.add(o)));
    const groups = new Map<string, THREE.Mesh[]>();
    root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || kept.has(mesh) || (mesh as THREE.SkinnedMesh).isSkinnedMesh || Array.isArray(mesh.material)) return;
        const attrs = Object.keys(mesh.geometry.attributes).sort().join(',');
        const key = `${mesh.material.uuid}|${attrs}|${mesh.castShadow}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(mesh);
    });
    const merged = new THREE.Group();
    merged.name = `${root.name}-merged`;
    let before = 0;
    for (const meshes of groups.values()) {
        if (meshes.length < 2) continue;
        const geometry = mergeGeometries(meshes.map(prepared), false);
        if (!geometry) continue;
        const m = new THREE.Mesh(geometry, meshes[0].material);
        m.castShadow = meshes[0].castShadow;
        m.receiveShadow = true;
        merged.add(m);
        before += meshes.length;
        meshes.forEach((x) => x.removeFromParent());
    }
    merged.matrixAutoUpdate = false;
    scene.add(merged);
    return { before, after: merged.children.length };
}
