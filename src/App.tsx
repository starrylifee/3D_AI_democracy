import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSimStore } from './store/useSimStore';
import { callChatAPI, callJudgeAPI } from './lib/api';

// NPC별 말투/행동 지침
const NPC_STYLE: Record<string, string> = {
    // 시의원들: 전문적이고 중립적, 학생에게 제출 유도
    councilor_scooter: '말투: 전문적이고 중립적인 존댓말. 호칭은 "학생". 해결책을 직접 제시하기보다 조례안 제출을 유도. 감정 과잉 금지. 금지: 장황한 배경설명, AI 언급.',
    councilor_pet: '말투: 공감적이고 신중한 존댓말. 다양한 이해관계자 고려를 드러내되 중립 유지. 학생에게 제안 보완을 요청. 금지: AI 언급, 장황한 추상화.',
    councilor_youth: '말투: 따뜻하고 격려하는 존댓말. 청소년 관점 존중, 실현 가능성 질문 1개. 금지: 설교조, AI 언급.',
    councilor_trash: '말투: 단호한 행정 톤의 존댓말. 근거 중심, 실행 가능성 점검 질문 1개. 금지: 과도한 감탄사, AI 언급.',

    // scooter 이슈 시민들
    parent: '역할: 초등학생 학부모. 말투: 걱정이 섞인 단호한 존댓말(요/니다체). 안전 최우선, 구체적 위험 예시 선호. 금지: "잘 모르겠다", 추상적 일반론.',
    student: '역할: 대학생 이용자. 말투: 공손하지만 캐주얼한 존댓말(요체). 편의와 자유 강조. 간결한 문장. 금지: 공격적 표현, 장황한 변명.',
    owner: '역할: 상점 주인. 말투: 직설적이고 약간 짜증 섞인 존댓말. 영업 방해, 출입 동선 강조. 금지: 과한 비난, 추상화.',
    disabled: '역할: 휠체어 이용자. 말투: 예의 바르나 권리 중심의 단호한 존댓말. 이동권, 보편적 설계 언급. 금지: 사과 유도, 모호한 표현.',

    // pet 이슈 시민들
    pet_owner: '역할: 반려견주. 말투: 애정 어린 존댓말. 공간 필요와 책임 있는 이용 언급. 금지: 과도한 요구, 추상화.',
    resident: '역할: 인근 주민. 말투: 피곤함이 묻어나는 존댓말. 소음/배설물 문제를 구체적으로 지적. 금지: 막연한 불만.',
    non_pet_owner: '역할: 비반려인(아이 엄마). 말투: 아이 안전 최우선의 걱정스런 존댓말. 구체적 위험 묘사 1개. 금지: 일반화된 혐오.',
    vet: '역할: 수의사. 말투: 전문가형 존댓말. 교육/구역 분리 등 실천적 제안. 금지: 추상적 칭찬, AI 언급.',

    // youth 이슈 시민들
    teenager: '역할: 고등학생. 말투: 밝고 짧은 존댓말(요체). 하고 싶은 활동을 구체적으로 1가지 제시. 금지: 장문, 설교.',
    police: '역할: 지구대 경찰. 말투: 단문 위주의 실무형 존댓말. 예방/관리의 필요 언급. 금지: 감정 과잉.',
    elder: '역할: 동네 어르신. 말투: 구수한 존댓말. "허허", "에구" 등 가벼운 감탄사 허용. 짧은 문장 1~2개. 회상/걱정 위주, AI/모름체 금지.',
    pc_owner: '역할: PC방 운영자. 말투: 실리적 존댓말. 건전한 대안 공간의 효과를 기대. 금지: 과장.',

    // trash 이슈 시민들
    cleaner: '역할: 환경미화원. 말투: 현장감 있는 짧은 존댓말. 분리수거/무단투기 사례 언급. 금지: 장황한 원론.',
    villa_resident: '역할: 빌라 주민. 말투: 부탁조의 존댓말. 비용/지원 호소. 금지: 막연한 일반화.',
    restaurant_owner: '역할: 음식점 주인. 말투: 영업 방해에 대한 단호한 존댓말. CCTV/단속 필요 언급. 금지: 과한 분노 표출.',
    office_worker: '역할: 1인 가구 직장인. 말투: 바쁜 현실을 반영한 간결한 존댓말. 탄력 수거/시간 대안 선호. 금지: 장문.',
};

function buildSystemText(npc: any, npcState: any) {
    const stateDescription = npcState === 'happy'
        ? ' 현재 당신의 개인적 문제는 대부분 해결되어 마음이 한결 가벼운 상태입니다.'
        : npcState === 'sad'
        ? ' 현재 당신의 개인적 문제가 해결되지 않아 불만과 답답함이 있는 상태입니다.'
        : ' 당신은 일상적인 감정 상태입니다.';
    const voice = NPC_STYLE[npc.id] ?? `말투: ${npc.role}의 실제 사람이 쓰는 자연스러운 존댓말. 금지: AI 언급, 장황한 일반론.`;
    const hardRules = '규칙: (1) 두 문장 이내. (2) 먼저 간단히 핵심을 말하고 (3) 필요하면 마지막에 매우 짧은 질문 1개만. (4) 같은 의미 반복 금지. (5) AI/모름체/사과 남발 금지. (6) 과도한 해결책 강요 금지.';
    return `${npc.persona}${stateDescription}\n${voice}\n${hardRules}`;
}

// 상수: 상호작용 반경(월드 좌표 단위)
const INTERACT_RADIUS = 3.2;

export default function App() {
    const {
        simulationStarted, setSimulationStarted,
        canInteract, setCanInteract,
        activeNPC, setActiveNPC,
        currentOrdinanceIssue, setCurrentOrdinanceIssue,
        keys, setKey,
        npcStates, setNpcState,
        conversationHistories, pushConversation,
        issues, questsCompleted, markQuestDone,
        MAP_SIZE, WORLD_SIZE,
        hydrateFromLocalStorage,
        ordinanceDrafts, setOrdinanceDraft,
        addBadge,
    } = useSimStore();

    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const miniMapRef = useRef<HTMLDivElement>(null);
    const questLogRef = useRef<HTMLDivElement>(null);
    const interactionPromptRef = useRef<HTMLDivElement>(null);

    const playerRef = useRef<THREE.Group | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const mixersRef = useRef<THREE.AnimationMixer[]>([]);
    const characterModelRef = useRef<THREE.Object3D | null>(null);
    const playerRigRef = useRef<{
        group: THREE.Group;
        leftArm: THREE.Object3D;
        rightArm: THREE.Object3D;
        leftLeg: THREE.Object3D;
        rightLeg: THREE.Object3D;
        body: THREE.Object3D;
        head: THREE.Object3D;
        isWalking: boolean;
        walkTime: number;
    } | null>(null);
    const animIdRef = useRef<number | null>(null);
    const isSendingRef = useRef<boolean>(false);
    const currentZoneRef = useRef<string | null>(null);
    const pendingZoneRef = useRef<{ key: string; name: string; proposed: THREE.Vector3 } | null>(null);
    const lastValidPosRef = useRef<THREE.Vector3>(new THREE.Vector3());
    const cameraZoomRef = useRef<number>(1.0);
    const obstaclesRef = useRef<Array<{ minX: number; maxX: number; minZ: number; maxZ: number; type: 'building' | 'pillar' | 'noentry'; label?: string }>>([]);

    useEffect(() => {
        hydrateFromLocalStorage();
    }, [hydrateFromLocalStorage]);

    useEffect(() => {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87CEEB);
        scene.fog = new THREE.Fog(0x87CEEB, 50, 150);
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 5, 10);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); });
        rendererRef.current = renderer;
        cameraRef.current = camera;
        sceneRef.current = scene;
        if (canvasContainerRef.current) canvasContainerRef.current.appendChild(renderer.domElement);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(50, 50, 25);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 4096;
        directionalLight.shadow.mapSize.height = 4096;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 200;
        directionalLight.shadow.camera.left = -100;
        directionalLight.shadow.camera.right = 100;
        directionalLight.shadow.camera.top = 100;
        directionalLight.shadow.camera.bottom = -100;
        scene.add(directionalLight);

        const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE), new THREE.MeshStandardMaterial({ color: 0x559033 }));
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x4A5568 });
        const road1 = new THREE.Mesh(new THREE.PlaneGeometry(10, WORLD_SIZE), roadMaterial);
        road1.rotation.x = -Math.PI/2; road1.position.y = 0.01; scene.add(road1);
        const road2 = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_SIZE, 10), roadMaterial);
        road2.rotation.x = -Math.PI/2; road2.position.y = 0.01; scene.add(road2);

        const cityHall = new THREE.Group();
        const mainBuilding = new THREE.Mesh(new THREE.BoxGeometry(30, 15, 10), new THREE.MeshStandardMaterial({ color: 0xE2E8F0 }));
        mainBuilding.position.set(0, 7.5, 0);
        mainBuilding.castShadow = true; mainBuilding.receiveShadow = true;
        cityHall.add(mainBuilding);
        // 충돌: 시청 본관 AABB 등록 (약간의 여유 패딩)
        obstaclesRef.current.push({
            minX: -15 - 0.6,
            maxX: 15 + 0.6,
            minZ: -5 - 0.6,
            maxZ: 5 + 0.6,
            type: 'building',
            label: 'cityhall'
        });
        for (let i = 0; i < 5; i++) {
            const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 10, 16), new THREE.MeshStandardMaterial({ color: 0xF7FAFC }));
            pillar.position.set(-12 + i * 6, 5, 6);
            pillar.castShadow = true;
            cityHall.add(pillar);
            // 충돌: 기둥은 소형 정사각 AABB로 처리
            const px = -12 + i * 6; const pz = 6; const r = 1.2;
            obstaclesRef.current.push({ minX: px - r, maxX: px + r, minZ: pz - r, maxZ: pz + r, type: 'pillar', label: `pillar_${i}` });
        }
        scene.add(cityHall);

        const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0xA0AEC0 });
        function createBuilding(x: number, z: number, w: number, h: number, d: number) {
            const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), buildingMaterial);
            building.position.set(x, h/2, z);
            building.castShadow = true;
            building.receiveShadow = true;
            scene.add(building);
            // 충돌: 빌딩 AABB 등록 (여유 패딩 0.6)
            const pad = 0.6;
            obstaclesRef.current.push({
                minX: x - w/2 - pad,
                maxX: x + w/2 + pad,
                minZ: z - d/2 - pad,
                maxZ: z + d/2 + pad,
                type: 'building'
            });
        }
        createBuilding(-30, -30, 25, 20, 25);
        createBuilding(30, -30, 25, 30, 25);
        createBuilding(-30, 30, 25, 25, 25);
        createBuilding(30, 30, 25, 15, 25);

        // 출입불가 구역(예시): 공사장 2곳
        const noEntryMaterial = new THREE.MeshStandardMaterial({ color: 0xCC2A2A, opacity: 0.25, transparent: true });
        function addNoEntryZone(cx: number, cz: number, w: number, d: number, label?: string) {
            const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, d), noEntryMaterial);
            plane.rotation.x = -Math.PI/2; plane.position.set(cx, 0.02, cz);
            scene.add(plane);
            const pad = 0.2;
            obstaclesRef.current.push({
                minX: cx - w/2 - pad,
                maxX: cx + w/2 + pad,
                minZ: cz - d/2 - pad,
                maxZ: cz + d/2 + pad,
                type: 'noentry',
                label
            });
        }
        addNoEntryZone(0, -18, 8, 6, 'noentry_north_cross');
        addNoEntryZone(-20, 0, 10, 8, 'noentry_west_side');

        const player = new THREE.Group();
        player.position.set(0, 0, 15);
        playerRef.current = player;
        scene.add(player);
        lastValidPosRef.current.copy(player.position);

        // 얼굴 스프라이트 제거 (머리만 유지)

        function createCuteCharacter(baseColor: THREE.ColorRepresentation, scale = 1) {
            const group = new THREE.Group();
            group.scale.setScalar(scale);
            const bodyMaterial = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.6, metalness: 0.05 });
            const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xFFE7C7, roughness: 1.0 });

            const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.7), bodyMaterial);
            body.position.y = 1.1; body.castShadow = true; body.receiveShadow = true;

            const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 24), skinMaterial);
            head.position.y = 2.2; head.castShadow = true;

            const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.6, 8, 16), bodyMaterial);
            leftArm.position.set(-0.85, 1.35, 0);
            const rightArm = leftArm.clone(); rightArm.position.x = 0.85;

            const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.7, 8, 16), bodyMaterial);
            leftLeg.position.set(-0.35, 0.35, 0);
            const rightLeg = leftLeg.clone(); rightLeg.position.x = 0.35;

            group.add(body, head, leftArm, rightArm, leftLeg, rightLeg);

            const rig = {
                group, leftArm, rightArm, leftLeg, rightLeg, body, head,
                isWalking: false,
                walkTime: 0,
                setEmotion: (_state: 'neutral' | 'happy' | 'sad') => {}
            };
            (group as any).userData.rig = rig;
            return rig;
        }

        // Player character
        const playerRig = createCuteCharacter(0x6BA4FF, 1.0);
        player.add(playerRig.group);
        playerRigRef.current = playerRig;

        // Initialize NPCs and UI using procedural characters
        initNPCs();
        initUI();

        function getZoneForPosition(pos: THREE.Vector3): string | null {
            const x = pos.x; const z = pos.z;
            if (z < -10) return 'scooter';
            if (z > 10) return 'youth';
            if (x > 10) return 'pet';
            if (x < -10) return 'trash';
            return null;
        }

        function isOutsideWorld(x: number, z: number) {
            const half = WORLD_SIZE / 2;
            return x < -half || x > half || z < -half || z > half;
        }

        function isBlocked(x: number, z: number) {
            if (isOutsideWorld(x, z)) return true;
            for (const ob of obstaclesRef.current) {
                if (x >= ob.minX && x <= ob.maxX && z >= ob.minZ && z <= ob.maxZ) return true;
            }
            return false;
        }

        // (removed) zone debug overlay

        function drawMiniMapBackground() {
            const container = miniMapRef.current as HTMLDivElement | null;
            if (!container) return;
            let canvas = container.querySelector('canvas') as HTMLCanvasElement | null;
            if (!canvas) {
                canvas = document.createElement('canvas');
                canvas.width = 200; canvas.height = 200;
                canvas.style.position = 'absolute';
                canvas.style.left = '0'; canvas.style.top = '0';
                container.insertBefore(canvas, container.firstChild);
            }
            const ctx = canvas.getContext('2d')!;
            ctx.clearRect(0,0,200,200);
            // background
            ctx.fillStyle = 'rgba(20,20,20,0.8)';
            ctx.fillRect(0,0,200,200);
            // zones
            ctx.fillStyle = 'rgba(49, 130, 206, 0.25)'; // scooter (north)
            ctx.fillRect(0, 0, 200, 80);
            ctx.fillStyle = 'rgba(72, 187, 120, 0.25)'; // youth (south)
            ctx.fillRect(0, 120, 200, 80);
            ctx.fillStyle = 'rgba(246, 173, 85, 0.25)'; // pet (east)
            ctx.fillRect(120, 0, 80, 200);
            ctx.fillStyle = 'rgba(159, 122, 234, 0.25)'; // trash (west)
            ctx.fillRect(0, 0, 80, 200);
            // roads cross
            ctx.fillStyle = '#4A5568';
            ctx.fillRect(96, 0, 8, 200);
            ctx.fillRect(0, 96, 200, 8);
            // border
            ctx.strokeStyle = 'rgba(203,213,224,0.6)';
            ctx.lineWidth = 2;
            ctx.strokeRect(1,1,198,198);
        }

        drawMiniMapBackground();

        const clock = new THREE.Clock();
        function animate() {
            animIdRef.current = requestAnimationFrame(animate);
            const delta = clock.getDelta();
            const camera = cameraRef.current!;
            const player = playerRef.current!;
            const state = useSimStore.getState();
            if (state.simulationStarted) {
                const moveDirection = new THREE.Vector3();
                if (state.keys.w) moveDirection.z -= 1; if (state.keys.s) moveDirection.z += 1;
                if (state.keys.a) moveDirection.x -= 1; if (state.keys.d) moveDirection.x += 1;
                moveDirection.normalize();

                const rig = playerRigRef.current;
                if (rig) {
                    if (moveDirection.length() > 0) {
                        rig.isWalking = true;
                        rig.walkTime += delta * 6.0;
                        const targetAngle = Math.atan2(moveDirection.x, moveDirection.z);
                        player.rotation.y = THREE.MathUtils.lerp(player.rotation.y, targetAngle, 0.2);
                    } else {
                        rig.isWalking = false;
                        rig.walkTime = 0;
                    }
                    const swing = Math.sin(rig.walkTime) * (rig.isWalking ? 0.6 : 0.05);
                    const counterSwing = Math.sin(rig.walkTime + Math.PI) * (rig.isWalking ? 0.6 : 0.05);
                    rig.leftArm.rotation.x = swing;
                    rig.rightArm.rotation.x = counterSwing;
                    rig.leftLeg.rotation.x = counterSwing;
                    rig.rightLeg.rotation.x = swing;
                    rig.body.position.y = 1.1 + (rig.isWalking ? Math.abs(Math.sin(rig.walkTime * 2)) * 0.05 : Math.sin(clock.elapsedTime) * 0.02);
                }

                if (moveDirection.length() > 0) {
                    const speed = 7.0 * delta;
                    const proposed = player.position.clone().add(moveDirection.multiplyScalar(speed));
                    const currZone = currentZoneRef.current ?? getZoneForPosition(player.position);
                    const nextZone = getZoneForPosition(proposed);
                    const zoneModal = document.getElementById('zone-modal') as HTMLDivElement | null;
                    const zoneOpen = zoneModal && !zoneModal.classList.contains('hidden');
                    // 존 이동 모달 처리
                    if (!zoneOpen && currZone !== nextZone && nextZone) {
                        const issue = useSimStore.getState().issues[nextZone];
                        pendingZoneRef.current = { key: nextZone, name: issue?.title ?? nextZone, proposed };
                        const titleEl = document.getElementById('zone-title') as HTMLHeadingElement | null;
                        const bodyEl = document.getElementById('zone-body') as HTMLParagraphElement | null;
                        if (titleEl) titleEl.textContent = `${issue?.title ?? nextZone} 존으로 이동`;
                        if (bodyEl) bodyEl.textContent = `${issue?.title ?? nextZone} 이슈 존으로 넘어가시겠습니까?`;
                        zoneModal?.classList.remove('hidden');
                    } else if (!zoneOpen) {
                        // 충돌 처리: 전체 이동, 축 분리 대체 시도, 실패 시 정지
                        const nx = proposed.x; const nz = proposed.z;
                        if (!isBlocked(nx, nz)) {
                            player.position.set(nx, player.position.y, nz);
                            lastValidPosRef.current.copy(player.position);
                            currentZoneRef.current = nextZone ?? currZone ?? null;
                        } else {
                            // 축 분리 슬라이딩
                            const tryX = !isBlocked(nx, player.position.z);
                            const tryZ = !isBlocked(player.position.x, nz);
                            if (tryX) {
                                player.position.set(nx, player.position.y, player.position.z);
                            } else if (tryZ) {
                                player.position.set(player.position.x, player.position.y, nz);
                            }
                            lastValidPosRef.current.copy(player.position);
                            currentZoneRef.current = getZoneForPosition(player.position) ?? currZone ?? null;
                        }
                    }
                }

                const cameraOffset = new THREE.Vector3(0, 10 * cameraZoomRef.current, 12 * cameraZoomRef.current);
                const cameraTarget = player.position.clone().add(cameraOffset);
                camera.position.lerp(cameraTarget, 0.1);
                camera.lookAt(player.position);

                let foundInteractable = false;
                const playerZone = getZoneForPosition(player.position);
                Object.entries(state.issues).forEach(([issueKey, issue]) => {
                    [...issue.citizens, issue.councilor].forEach(npc => {
                        const distance = player.position.distanceTo(npc.pos);
                        const npcZone = getZoneForPosition(npc.pos);
                        const canInteractHere = distance < INTERACT_RADIUS && (npcZone ? playerZone === npcZone : true);
                        if (npc.marker) (npc.marker as any).visible = canInteractHere;
                        if (canInteractHere && !foundInteractable) {
                            setActiveNPC({ ...npc, issueKey });
                            foundInteractable = true;
                        }
                    });
                });
                if (!foundInteractable) setActiveNPC(null);
                setCanInteract(foundInteractable);

                const playerMapIcon = document.getElementById('player-map-icon');
                if (playerMapIcon) {
                    const [mapX, mapY] = worldToMapCoords(player.position.x, player.position.z);
                    (playerMapIcon as HTMLElement).style.left = `${mapX}px`;
                    (playerMapIcon as HTMLElement).style.top = `${mapY}px`;
                }
            }
            mixersRef.current.forEach(mixer => mixer.update(delta));
            renderer.render(scene, camera);
        }

        animate();

        function onResize() {
            const camera = cameraRef.current!;
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            rendererRef.current!.setSize(window.innerWidth, window.innerHeight);
        }
        window.addEventListener('resize', onResize);
        function onWheel(e: WheelEvent) {
            // 채팅/모달 열려있으면 카메라 줌 비활성화 (배경 락)
            const chatOpen = !(document.getElementById('chat-modal') as HTMLDivElement)?.classList.contains('hidden');
            const ordinanceOpen = !(document.getElementById('ordinance-modal') as HTMLDivElement)?.classList.contains('hidden');
            const resultOpen = !(document.getElementById('result-modal') as HTMLDivElement)?.classList.contains('hidden');
            const zoneOpen = !(document.getElementById('zone-modal') as HTMLDivElement)?.classList.contains('hidden');
            const uiLocked = chatOpen || ordinanceOpen || resultOpen || zoneOpen;
            if (uiLocked) return;
            cameraZoomRef.current = THREE.MathUtils.clamp(cameraZoomRef.current + (e.deltaY > 0 ? 0.1 : -0.1), 0.5, 2.0);
        }
        window.addEventListener('wheel', onWheel, { passive: true });
        function onKeyDown(e: KeyboardEvent) {
            const key = e.key.toLowerCase();
            if (!useSimStore.getState().simulationStarted) return;
            const chatOpen = !(document.getElementById('chat-modal') as HTMLDivElement)?.classList.contains('hidden');
            const ordinanceOpen = !(document.getElementById('ordinance-modal') as HTMLDivElement)?.classList.contains('hidden');
            const resultOpen = !(document.getElementById('result-modal') as HTMLDivElement)?.classList.contains('hidden');
            const zoneOpen = !(document.getElementById('zone-modal') as HTMLDivElement)?.classList.contains('hidden');
            const uiLocked = chatOpen || ordinanceOpen || resultOpen || zoneOpen;
            if (['w','a','s','d'].includes(key)) {
                if (uiLocked) { e.preventDefault(); return; }
                setKey(key as any, true);
            }
            const st = useSimStore.getState();
            if (key === 'e' && st.canInteract && st.activeNPC && !uiLocked) {
                e.preventDefault();
                e.stopPropagation();
                handleInteraction(st.activeNPC as any);
            }
        }
        function onKeyUp(e: KeyboardEvent) {
            const key = e.key.toLowerCase();
            if (['w','a','s','d'].includes(key)) setKey(key as any, false);
        }
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        return () => {
            window.removeEventListener('resize', onResize);
            window.removeEventListener('wheel', onWheel as any);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
            try {
                const r = rendererRef.current;
                if (r) {
                    r.dispose();
                    (r as any).forceContextLoss?.();
                    const canvas = r.domElement;
                    canvas.parentNode && canvas.parentNode.removeChild(canvas);
                }
            } catch {}
            rendererRef.current = null;
            sceneRef.current = null;
            cameraRef.current = null;
            mixersRef.current = [];
            characterModelRef.current = null;
            playerRigRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function initUI() {
        const questLog = questLogRef.current;
        if (!questLog) return;
        let html = '';
        Object.entries(issues).forEach(([key, issue]) => {
            html += `<div class="mb-4"><h3 class="font-bold border-b border-gray-500 pb-1 mb-2">${issue.title}</h3><ul id="quest-list-${key}" class="list-none space-y-1">`;
            issue.citizens.forEach(citizen => {
                html += `<li id="quest-${citizen.id}"><span>⚪</span> ${citizen.name} (${citizen.role})</li>`;
            });
            html += `</ul><p id="quest-complete-notice-${key}" class="text-yellow-400 font-bold mt-2 hidden">모든 의견을 들었습니다! 담당 시의원을 찾아가세요.</p></div>`;
        });
        questLog.innerHTML = html;
    }

    function createExclamationMarkTexture() {
        const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
        const context = canvas.getContext('2d')!;
        context.fillStyle = '#FFD700'; context.font = 'bold 54px Arial';
        context.textAlign = 'center'; context.textBaseline = 'middle';
        context.fillText('!', 32, 36);
        return new THREE.CanvasTexture(canvas);
    }

    function worldToMapCoords(worldX: number, worldZ: number) {
        const mapX = (worldX / WORLD_SIZE) * MAP_SIZE + (MAP_SIZE / 2);
        const mapY = (worldZ / WORLD_SIZE) * MAP_SIZE + (MAP_SIZE / 2);
        return [mapX - 4, mapY - 4];
    }

    function initNPCs() {
        const scene = sceneRef.current!;
        const mapContainer = miniMapRef.current!;
        Object.values(issues).forEach(issue => {
            const allNpcs = [...issue.citizens, issue.councilor];
            allNpcs.forEach(npcData => {
                const npcContainer = new THREE.Group();
                const rig = (function() {
                    const baseColor = new THREE.Color(npcData.color);
                    return (function create() {
                        const group = new THREE.Group();
                        const bodyMaterial = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.6, metalness: 0.05 });
                        const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xFFE7C7, roughness: 1.0 });
                        const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.4, 0.6), bodyMaterial); body.position.y = 0.9;
                        const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 20), skinMaterial); head.position.y = 1.8;
                        // 얼굴 스프라이트 제거: 머리만 유지
                        const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 8, 16), bodyMaterial); leftArm.position.set(-0.75, 1.1, 0);
                        const rightArm = leftArm.clone(); rightArm.position.x = 0.75;
                        const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.55, 8, 16), bodyMaterial); leftLeg.position.set(-0.3, 0.25, 0);
                        const rightLeg = leftLeg.clone(); rightLeg.position.x = 0.3;
                        group.add(body, head, leftArm, rightArm, leftLeg, rightLeg);
                        const rigObj = { group, leftArm, rightArm, leftLeg, rightLeg, body, head, isWalking: false, walkTime: 0, setEmotion: (_e: 'neutral'|'happy'|'sad') => {} } as any;
                        (group as any).userData.rig = rigObj; return rigObj;
                    })();
                })();
                npcContainer.add(rig.group);
                npcContainer.position.copy(npcData.pos);
                scene.add(npcContainer);

                (npcData as any).actions = { state: 'neutral' };

                const spriteMaterial = new THREE.SpriteMaterial({ map: createExclamationMarkTexture(), color: 0xffff00 });
                const sprite = new THREE.Sprite(spriteMaterial);
                sprite.scale.set(1, 1.5, 1);
                sprite.position.set(0, 2.5, 0);
                sprite.visible = false;
                npcContainer.add(sprite);
                (npcData as any).object = npcContainer;
                (npcData as any).marker = sprite;

                const npcIcon = document.createElement('div');
                npcIcon.className = 'map-icon';
                npcIcon.style.position = 'absolute';
                npcIcon.style.width = '8px';
                npcIcon.style.height = '8px';
                npcIcon.style.borderRadius = '50%';
                npcIcon.style.backgroundColor = `#${new THREE.Color(npcData.color).getHexString()}`;
                if (npcData.id && String(npcData.id).includes('councilor')) {
                    npcIcon.style.outline = '2px solid #FFD700';
                    npcIcon.style.boxShadow = '0 0 6px #FFD700';
                }
                const [mapX, mapY] = worldToMapCoords(npcData.pos.x, npcData.pos.z);
                npcIcon.style.left = `${mapX}px`;
                npcIcon.style.top = `${mapY}px`;
                mapContainer.appendChild(npcIcon);
            });
        });
    }

    function handleInteraction(npc: any) {
        const issueKey = npc.issueKey as string;
        if (npc.id.includes('councilor')) {
            if (questsCompleted[issueKey] && questsCompleted[issueKey].size === 4) {
                setCurrentOrdinanceIssue(issueKey);
                (document.getElementById('ordinance-modal') as HTMLDivElement)?.classList.remove('hidden');
                (document.getElementById('ordinance-title') as HTMLHeadingElement).textContent = `${issues[issueKey].title} 해결 조례안 제출`;
                (document.getElementById('ordinance-text') as HTMLTextAreaElement).value = ordinanceDrafts[issueKey] ?? '';
            } else {
                openChatModal(npc);
            }
        } else {
            openChatModal(npc);
            if (questsCompleted[issueKey] && !questsCompleted[issueKey].has(npc.id)) {
                markQuestDone(issueKey, npc.id);
                const li = document.getElementById(`quest-${npc.id}`);
                if (li) li.innerHTML = `<span>✅</span> <span class="line-through text-gray-400">${npc.name} (${npc.role})</span>`;
                if (questsCompleted[issueKey].size === 4) {
                    const notice = document.getElementById(`quest-complete-notice-${issueKey}`);
                    notice?.classList.remove('hidden');
                }
            }
        }
    }

    function openChatModal(npc: any) {
        (document.getElementById('chat-avatar') as HTMLDivElement).textContent = npc.emoji;
        // 시의원 표기: 이름 + " 시의원"
        const isCouncilor = String(npc.role).includes('의원') || String(npc.id).includes('councilor');
        (document.getElementById('chat-name') as HTMLHeadingElement).textContent = isCouncilor ? `${npc.name} 시의원` : npc.name;
        (document.getElementById('chat-role') as HTMLParagraphElement).textContent = npc.role;
        const messagesDiv = document.getElementById('chat-messages') as HTMLDivElement;
        messagesDiv.innerHTML = '';
        (window as any)._activeNPC = npc;

        const history = conversationHistories[npc.id] ?? [];
        history.forEach(msg => addChatMessage(msg.role, msg.text));
        if (history.length === 0) {
            const state = npcStates[npc.id] ?? 'neutral';
            let greeting = '';
            if (isCouncilor) {
                // 시의원 초기 멘트 + 조례안 제출 안내
                greeting = `${npc.initialRequest}\n문제를 해결할 수 있는 조례안을 제출해주세요.`;
            } else {
                greeting = state === 'neutral' ? npc.initialRequest : state === 'happy' ? '안녕하세요! 덕분에 문제가 해결되어 정말 기쁩니다. 감사합니다!' : `아직 문제가 해결되지 않았어요... ${npc.initialRequest}`;
            }
            addChatMessage('model', greeting);
            pushConversation(npc.id, { role: 'model', text: greeting });
        }
        (document.getElementById('chat-modal') as HTMLDivElement).classList.remove('hidden');
        const input = (document.getElementById('chat-input') as HTMLInputElement);
        input.value = '';
        input.focus();
        // 이동 키 즉시 해제하여 채팅 중 이동 방지
        setKey('w', false); setKey('a', false); setKey('s', false); setKey('d', false);
    }

    async function onSendChat() {
        const npc = (window as any)._activeNPC;
        if (!npc) return;
        const input = document.getElementById('chat-input') as HTMLInputElement;
        const text = input.value.trim();
        if (!text || isSendingRef.current) return;
        isSendingRef.current = true;
        addChatMessage('user', text);
        pushConversation(npc.id, { role: 'user', text });
        input.value = '';
        input.disabled = true;
        input.placeholder = 'AI 응답 대기 중...';

        const sendBtn = document.getElementById('chat-send-btn') as HTMLButtonElement;
        sendBtn.disabled = true; sendBtn.textContent = '...';
        const typingEl = addModelTyping();
        const state = npcStates[npc.id];
        const systemText = buildSystemText(npc, state);
        try {
            const latest = useSimStore.getState().conversationHistories[npc.id] ?? [];
            const history = latest.map(m => ({ role: m.role, text: m.text }));
            const responseText = await callChatAPI(history, systemText);
            replaceTypingMessage(typingEl, responseText);
            pushConversation(npc.id, { role: 'model', text: responseText });
        } catch (e) {
            replaceTypingMessage(typingEl, '죄송합니다. 지금은 답변을 드릴 수 없습니다.');
        } finally {
            sendBtn.disabled = false; sendBtn.textContent = '전송';
            isSendingRef.current = false;
            input.disabled = false;
            input.placeholder = '메시지를 입력하세요...';
            input.focus();
        }
    }

    function addChatMessage(role: 'user' | 'model', text: string) {
        const messagesDiv = document.getElementById('chat-messages') as HTMLDivElement;
        const wrapper = document.createElement('div');
        wrapper.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'}`;
        wrapper.innerHTML = `<div class="chat-message rounded-lg px-4 py-2 ${role === 'user' ? 'bg-blue-600' : 'bg-gray-700'}">${text.replace(/\n/g, '<br>')}</div>`;
        messagesDiv.appendChild(wrapper);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        return wrapper;
    }

    function addModelTyping() {
        const messagesDiv = document.getElementById('chat-messages') as HTMLDivElement;
        const wrapper = document.createElement('div');
        wrapper.className = 'flex justify-start';
        wrapper.innerHTML = `<div class="chat-message rounded-lg px-4 py-2 bg-gray-700">작성중...</div>`;
        messagesDiv.appendChild(wrapper);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        return wrapper;
    }

    function replaceTypingMessage(wrapper: HTMLElement, text: string) {
        const bubble = wrapper.querySelector('.chat-message') as HTMLDivElement | null;
        if (bubble) {
            bubble.innerHTML = text.replace(/\n/g, '<br>');
        }
    }

    async function onSubmitOrdinance() {
        (document.getElementById('ordinance-modal') as HTMLDivElement).classList.add('hidden');
        const resultModal = document.getElementById('result-modal') as HTMLDivElement;
        const spinner = document.getElementById('loading-spinner') as HTMLDivElement;
        const content = document.getElementById('result-content') as HTMLDivElement;
        resultModal.classList.remove('hidden');
        spinner.classList.remove('hidden');
        content.innerHTML = '';

        const ordinanceText = (document.getElementById('ordinance-text') as HTMLTextAreaElement).value;
        const issueKey = currentOrdinanceIssue!;
        const issue = issues[issueKey];
        const ctx = `Issue: ${issue.title}. Citizens' concerns: ${issue.citizens.map(c => `${c.name}(${c.role}): ${c.persona}`).join('; ')}. Student's proposal: ${ordinanceText}`;
        try {
            const parsed = await callJudgeAPI(ctx);
            displayResult(parsed);
            updateNpcStates(parsed?.citizen_outcomes);
            // 성공/실패와 상관없이 현재 초안은 저장
            setOrdinanceDraft(issueKey, ordinanceText);
        } catch (e) {
            displayResult({ status: 'error', feedback: 'AI 평가를 가져오는 데 실패했습니다. JSON 형식 오류일 수 있습니다.' });
        } finally {
            spinner.classList.add('hidden');
        }
    }

    function displayResult(result: any) {
        const contentDiv = document.getElementById('result-content') as HTMLDivElement;
        let html = '';
        if (result.status === 'success' || result.status === 'partial_success') {
            html = `<div class=\"bg-green-900 border-l-4 border-green-500 text-green-300 p-4 mb-4 rounded-r-lg\"><p class=\"font-bold text-xl\">[${result.status === 'success' ? '미션 성공!' : '부분 성공!'}] 조례안이 시행되었습니다!</p></div><h3 class=\"font-bold text-lg mb-2\">AI 시의원 평가:</h3><p class=\"bg-gray-700 p-3 rounded\">${result.feedback}</p>`;
        } else if (result.status === 'failure') {
            html = `<div class=\"bg-red-900 border-l-4 border-red-500 text-red-300 p-4 mb-4 rounded-r-lg\"><p class=\"font-bold text-xl\">[추가 미션 발생!] 조례안 보완이 필요합니다.</p></div><h3 class=\"font-bold text-lg mb-2\">AI 시의원 평가:</h3><p class=\"bg-gray-700 p-3 rounded mb-4\">${result.feedback}</p><div class=\"bg-yellow-900 p-4 rounded-lg border-yellow-600\"><p class=\"font-bold text-yellow-300\">&lt;추가 미션&gt;</p><p class=\"text-yellow-400\">${result.mission}</p></div>`;
        } else {
            html = `<div class=\"bg-red-900 border-l-4 border-red-500 text-red-300 p-4 mb-4 rounded-r-lg\"><p class=\"font-bold text-xl\">오류 발생</p></div><p class=\"bg-gray-700 p-3 rounded\">${result.feedback}</p>`;
        }
        if (typeof result.score === 'number') {
            html = `<div class=\"mb-2 text-sm text-gray-300\">총점: <span class=\"font-bold text-blue-300\">${result.score}</span> / 100</div>` + html;
        }
        if (result.mission && result.status !== 'failure') {
            html += `<div class=\"mt-4 bg-yellow-900 p-4 rounded-lg border border-yellow-600\"><p class=\"font-bold text-yellow-300\">&lt;남은 과제&gt;</p><p class=\"text-yellow-400\">${result.mission}</p></div>`;
        }
        contentDiv.innerHTML = html;
    }

    function updateNpcStates(outcomes?: Array<{ id: string; state: 'happy' | 'sad' }>) {
        if (!outcomes) return;
        let awarded = false;
        outcomes.forEach(outcome => {
            setNpcState(outcome.id, outcome.state as any);
            const npc = Object.values(issues).flatMap(i => [...i.citizens, i.councilor]).find(n => n.id === outcome.id) as any;
            if (npc?.object?.userData?.rig) {
                const rig = npc.object.userData.rig as { setEmotion: (e: 'neutral'|'happy'|'sad') => void };
                rig.setEmotion(outcome.state);
            }
            if (outcome.state === 'happy' && !awarded) {
                awarded = true;
                try { addBadge(outcome.id); } catch {}
            }
        });
        // 민원 1건 해결 시 배지 토스트
        try {
            const toast = document.createElement('div');
            toast.className = 'fixed top-4 left-1/2 -translate-x-1/2 bg-blue-700 text-white px-4 py-2 rounded shadow-lg z-50';
            toast.textContent = '배지 획득! 시민의 민원을 해결했습니다.';
            document.body.appendChild(toast);
            setTimeout(() => { toast.remove(); }, 2500);
        } catch {}
    }

    return (
        <div className="text-white" style={{ width: '100vw', height: '100vh' }}>
            <div id="canvas-container" ref={canvasContainerRef} style={{ position: 'fixed', inset: 0 }} />

            <div className="ui-overlay text-white">
                <div id="intro-screen" className={`modal-backdrop ui-element fixed inset-0 flex flex-col items-center justify-center text-center p-4 ${simulationStarted ? 'hidden' : ''}`}>
                    <div className="bg-gray-900 p-8 rounded-xl shadow-lg max-w-lg">
                        <h1 className="text-3xl font-bold text-blue-400 mb-4">3D 민주시민 시뮬레이션: 늘푸른시</h1>
                        <p className="mb-6">가상 세계를 불러왔습니다.</p>
                        <div className="text-left bg-gray-800 p-4 rounded-lg">
                            <h2 className="font-bold text-lg mb-2">조작 방법</h2>
                            <p><span className="font-bold text-blue-300">W, A, S, D 또는 방향키:</span> 이동</p>
                            <p><span className="font-bold text-blue-300">E:</span> 시민과 대화 / 조례안 제출</p>
                            <h2 className="font-bold text-lg mt-4 mb-2">미션</h2>
                            <p>1. 시민들과 대화하여 4가지 문제에 대한 의견을 듣고</p>
                            <p>2. 담당 시의원에게 조례안을 제출하세요.</p>
                        </div>
                        <button onClick={() => setSimulationStarted(true)} className="mt-8 bg-blue-600 font-bold py-3 px-8 rounded-lg hover:bg-blue-700 transition-colors w-full">시뮬레이션 시작하기</button>
                    </div>
                </div>

                <div className={`ui-element absolute top-4 left-4 ${simulationStarted ? '' : 'hidden'}`}>
                    <button id="toggle-people" onClick={() => {
                        const el = document.getElementById('quest-log') as HTMLDivElement;
                        const btn = document.getElementById('toggle-people') as HTMLButtonElement;
                        if (!el || !btn) return;
                        el.classList.toggle('hidden');
                        btn.textContent = el.classList.contains('hidden') ? '사람목록(열기)' : '사람목록(접기)';
                    }} className="mb-2 bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded">사람목록(접기)</button>
                    <div id="quest-log" ref={questLogRef} className="bg-black bg-opacity-50 p-4 rounded-lg max-w-sm" />
                    
                </div>

                <div className={`ui-element absolute top-4 left-1/2 -translate-x-1/2 ${simulationStarted ? '' : 'hidden'}`}>
                    <button id="toggle-mission" onClick={() => {
                        const el = document.getElementById('mission-panel') as HTMLDivElement;
                        const btn = document.getElementById('toggle-mission') as HTMLButtonElement;
                        if (!el || !btn) return;
                        el.classList.toggle('hidden');
                        btn.textContent = el.classList.contains('hidden') ? '미션(열기)' : '미션(접기)';
                    }} className="mb-2 bg-green-700 hover:bg-green-600 px-3 py-1 rounded">미션(열기)</button>
                    <div id="mission-panel" className="bg-black bg-opacity-50 p-4 rounded-lg max-w-md hidden">
                        <h3 className="font-bold mb-2">미션</h3>
                        <p>1) 시민들과 대화하여 4가지 문제에 대한 의견을 듣고</p>
                        <p>2) 담당 시의원에게 조례안을 제출하세요.</p>
                        <div className="mt-3 text-sm text-gray-300">
                            <p className="font-bold text-blue-300">조작</p>
                            <p>이동: WASD 또는 방향키(↑ ↓ ← →)</p>
                            <p>대화/제출: E</p>
                        </div>
                    </div>
                </div>

                <div id="mini-map-container" ref={miniMapRef} className={`ui-element ${simulationStarted ? '' : 'hidden'}`} style={{ position: 'absolute', top: '1rem', right: '1rem', width: 200, height: 200, backgroundColor: 'rgba(0,0,0,0.5)', border: '2px solid #4A5568', borderRadius: 8 }}>
                    <div id="player-map-icon" className="map-icon" style={{ position: 'absolute', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#4299E1', border: '1px solid white', zIndex: 10 }} />
                    <div style={{ position: 'absolute', bottom: 4, left: 6, fontSize: 10, color: '#CBD5E0' }}>
                        <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#4299E1', border: '1px solid white' }} /> 나
                        <span className="inline-block w-2 h-2 rounded-full ml-3" style={{ background: '#FFD700' }} /> 시의원
                    </div>
                </div>

                <div id="zone-modal" className="modal-backdrop fixed inset-0 flex items-center justify-center hidden">
                    <div className="ui-element bg-gray-800 border border-gray-600 p-6 rounded-xl shadow-lg max-w-sm w-full mx-4">
                        <h2 id="zone-title" className="text-2xl font-bold text-blue-300 mb-2">존 이동</h2>
                        <p id="zone-body" className="text-gray-300 mb-4">이슈 존으로 넘어가시겠습니까?</p>
                        <div className="flex justify-end space-x-3">
                            <button onClick={() => {
                                const modal = document.getElementById('zone-modal') as HTMLDivElement;
                                modal.classList.add('hidden');
                                // 취소: 원위치로 롤백
                                const player = playerRef.current!;
                                player.position.copy(lastValidPosRef.current);
                                // 이동키 해제
                                setKey('w', false); setKey('a', false); setKey('s', false); setKey('d', false);
                            }} className="bg-gray-600 px-4 py-2 rounded hover:bg-gray-700">취소</button>
                            <button onClick={() => {
                                const modal = document.getElementById('zone-modal') as HTMLDivElement;
                                const info = (pendingZoneRef.current);
                                if (info) {
                                    const player = playerRef.current!;
                                    player.position.copy(info.proposed);
                                    lastValidPosRef.current.copy(player.position);
                                    currentZoneRef.current = info.key;
                                }
                                pendingZoneRef.current = null;
                                modal.classList.add('hidden');
                            }} className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700">확인</button>
                        </div>
                    </div>
                </div>

                <div id="interaction-prompt" ref={interactionPromptRef} className={`ui-element absolute bottom-1/4 left-1/2 -translate-x-1/2 bg-black bg-opacity-75 p-3 rounded-lg text-center ${canInteract ? '' : 'hidden'}`}>
                    <p>'<span className="font-bold text-blue-300">E</span>' 키를 눌러 대화하기</p>
                </div>

                <div id="chat-modal" className="modal-backdrop fixed inset-0 flex items-center justify-center hidden">
                    <div className="ui-element bg-gray-800 border border-gray-600 rounded-xl shadow-lg max-w-lg w-full mx-4 flex flex-col" style={{ height: '70vh' }}>
                        <div className="flex items-center p-4 border-b border-gray-600">
                            <div id="chat-avatar" className="text-4xl mr-4" />
                            <div>
                                <h2 id="chat-name" className="text-2xl font-bold" />
                                <p id="chat-role" className="text-gray-400" />
                            </div>
                            <button onClick={() => (document.getElementById('chat-modal') as HTMLDivElement).classList.add('hidden')} className="ml-auto bg-gray-700 w-8 h-8 rounded-full hover:bg-gray-600">X</button>
                        </div>
                        <div id="chat-messages" className="flex-grow p-4 overflow-y-auto flex flex-col space-y-4" />
                        <div className="p-4 border-t border-gray-600 flex items-center">
                            <input type="text" id="chat-input" className="w-full bg-gray-900 text-white p-3 rounded-lg border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="메시지를 입력하세요..." onKeyDown={(e) => { if (e.key === 'Enter') onSendChat(); }} />
                            <button onClick={onSendChat} id="chat-send-btn" className="ml-4 bg-blue-600 font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors">전송</button>
                            <button onClick={() => {
                                // 모든 대화 초기화
                                try {
                                    useSimStore.getState().clearAllConversations();
                                    const messagesDiv = document.getElementById('chat-messages') as HTMLDivElement;
                                    messagesDiv.innerHTML = '';
                                    const npc = (window as any)._activeNPC;
                                    if (npc) {
                                        const state = useSimStore.getState().npcStates[npc.id] ?? 'neutral';
                                        let greeting = '';
                                        const isCouncilor = String(npc.role).includes('의원') || String(npc.id).includes('councilor');
                                        if (isCouncilor) greeting = `${npc.initialRequest}\n문제를 해결할 수 있는 조례안을 제출해주세요.`;
                                        else greeting = state === 'neutral' ? npc.initialRequest : state === 'happy' ? '안녕하세요! 덕분에 문제가 해결되어 정말 기쁩니다. 감사합니다!' : `아직 문제가 해결되지 않았어요... ${npc.initialRequest}`;
                                        addChatMessage('model', greeting);
                                        useSimStore.getState().pushConversation(npc.id, { role: 'model', text: greeting });
                                    }
                                } catch {}
                            }} className="ml-2 bg-gray-700 font-bold py-3 px-4 rounded-lg hover:bg-gray-600 transition-colors">대화 초기화</button>
                        </div>
                    </div>
                </div>

                <div id="ordinance-modal" className="modal-backdrop fixed inset-0 flex items-center justify-center hidden">
                    <div className="ui-element bg-gray-800 border border-gray-600 p-6 rounded-xl shadow-lg max-w-lg w-full mx-4">
                        <h2 id="ordinance-title" className="text-2xl font-bold text-green-400 mb-4">조례안 제출</h2>
                        <p className="text-gray-300 mb-4">시민들의 의견을 종합하여 조례안을 작성해주세요. AI 시의원이 여러분의 제안을 평가할 것입니다.</p>
                        <textarea id="ordinance-text" className="w-full h-48 bg-gray-900 text-white p-3 rounded-lg border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="이곳에 조례안 내용을 구체적으로 작성해주세요..." />
                        <div className="text-right mt-2">
                            <button onClick={() => {
                                navigator.clipboard.readText().then(t => {
                                    const ta = document.getElementById('ordinance-text') as HTMLTextAreaElement;
                                    if (t) {
                                        ta.value = t;
                                        ta.dispatchEvent(new Event('input'));
                                    }
                                }).catch(() => {
                                    // ignore
                                });
                            }} className="text-sm underline text-blue-300 hover:text-blue-200">클립보드에서 붙여넣기</button>
                        </div>
                        <div className="flex justify-end space-x-4 mt-4">
                            <button onClick={() => (document.getElementById('ordinance-modal') as HTMLDivElement).classList.add('hidden')} className="bg-gray-600 font-bold py-2 px-6 rounded-lg hover:bg-gray-700 transition-colors">취소</button>
                            <button onClick={onSubmitOrdinance} id="submit-ordinance-btn" className="bg-green-600 font-bold py-2 px-6 rounded-lg hover:bg-green-700 transition-colors">제출하기</button>
                        </div>
                    </div>
                </div>

                <div id="result-modal" className="modal-backdrop fixed inset-0 flex items-center justify-center hidden">
                    <div className="ui-element bg-gray-800 border border-gray-600 p-6 rounded-xl shadow-lg max-w-lg w-full mx-4">
                        <div id="result-content" />
                        <div id="loading-spinner" className="text-center p-8 hidden">
                            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-400 mx-auto" />
                            <p className="mt-4">AI 시의원이 조례안을 검토 중입니다...</p>
                        </div>
                        <button onClick={() => (document.getElementById('result-modal') as HTMLDivElement).classList.add('hidden')} className="mt-6 bg-blue-600 font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors w-full">확인</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

