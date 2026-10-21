import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// 캐릭터 하나(몸 + 뼈에 붙은 모자·가방 등)를 메시 하나로 합친다. 크롬북 성능용.
// 재질 색은 꼭짓점 색으로 옮기고, 소품은 붙어 있던 뼈를 100% 따라 움직이게 스키닝 정보를 넣는다.

function floatAttr(attr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, size = attr.itemSize) {
    const out = new Float32Array(attr.count * size);
    const get = [attr.getX, attr.getY, attr.getZ, attr.getW];
    for (let i = 0; i < attr.count; i++) for (let k = 0; k < size; k++) out[i * size + k] = get[k].call(attr, i);
    return new THREE.BufferAttribute(out, size);
}

function part(mesh: THREE.Mesh, matrix: THREE.Matrix4 | null, boneIndex: number | null) {
    const src = mesh.geometry;
    const g = new THREE.BufferGeometry();
    const count = src.attributes.position.count;
    g.setAttribute('position', floatAttr(src.attributes.position, 3));
    if (src.attributes.normal) g.setAttribute('normal', floatAttr(src.attributes.normal, 3));
    else return null;
    if (boneIndex === null) {
        g.setAttribute('skinIndex', new THREE.BufferAttribute(Uint16Array.from(floatAttr(src.attributes.skinIndex, 4).array), 4));
        g.setAttribute('skinWeight', floatAttr(src.attributes.skinWeight, 4));
    } else {
        const idx = new Uint16Array(count * 4);
        const w = new Float32Array(count * 4);
        for (let i = 0; i < count; i++) { idx[i * 4] = boneIndex; w[i * 4] = 1; }
        g.setAttribute('skinIndex', new THREE.BufferAttribute(idx, 4));
        g.setAttribute('skinWeight', new THREE.BufferAttribute(w, 4));
    }
    const c = (mesh.material as THREE.MeshStandardMaterial).color ?? new THREE.Color(1, 1, 1);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.setIndex(src.index ? Array.from(src.index.array) : [...Array(count).keys()]);
    if (matrix) g.applyMatrix4(matrix);
    return g;
}

export function mergeCharacter(root: THREE.Object3D) {
    root.updateMatrixWorld(true);
    const skinned: THREE.SkinnedMesh[] = [];
    const rigid: THREE.Mesh[] = [];
    root.traverse((o) => {
        if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned.push(o as THREE.SkinnedMesh);
        else if ((o as THREE.Mesh).isMesh) rigid.push(o as THREE.Mesh);
    });
    if (skinned.length === 0) return false;
    const base = skinned[0];
    const skeleton = base.skeleton;
    const parts: THREE.BufferGeometry[] = [];
    const used: THREE.Mesh[] = [];
    for (const s of skinned) {
        if (Array.isArray(s.material) || s.skeleton !== skeleton || !s.bindMatrix.equals(base.bindMatrix) || !s.matrixWorld.equals(base.matrixWorld)) continue;
        const g = part(s, null, null);
        if (g) { parts.push(g); used.push(s); }
    }
    for (const r of rigid) {
        if (Array.isArray(r.material)) continue;
        let bone: THREE.Object3D | null = r.parent;
        while (bone && !(bone as THREE.Bone).isBone) bone = bone.parent;
        const bi = bone ? skeleton.bones.indexOf(bone as THREE.Bone) : -1;
        if (bi < 0) continue;
        // three.js 스키닝(attached 모드)의 월드 좌표 = 뼈행렬 × bindMatrix × p 이므로,
        // 지금 소품이 있는 월드 자리가 나오도록 p = bindMatrix⁻¹ × 뼈행렬⁻¹ × 소품월드 로 되돌린다
        const boneMatrix = bone!.matrixWorld.clone().multiply(skeleton.boneInverses[bi]);
        const m = base.bindMatrix.clone().invert()
            .multiply(boneMatrix.invert())
            .multiply(r.matrixWorld);
        const g = part(r, m, bi);
        if (g) { parts.push(g); used.push(r); }
    }
    if (parts.length < 2) return false;
    const merged = mergeGeometries(parts, false);
    if (!merged) return false;
    const src = base.material as THREE.MeshStandardMaterial;
    base.geometry = merged;
    base.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: src.roughness ?? 0.8, metalness: 0, flatShading: src.flatShading });
    used.filter((m) => m !== base).forEach((m) => m.removeFromParent());
    base.frustumCulled = true;
    base.computeBoundingSphere();
    // 팔다리를 휘두를 때 화면 가장자리에서 잘려 사라지지 않게 여유를 준다
    if (base.boundingSphere) base.boundingSphere.radius *= 1.4;
    return true;
}
