import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// public/models의 GLB는 gltf-transform(meshopt)으로 압축돼 있어 해독기가 필요하다
export const gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
