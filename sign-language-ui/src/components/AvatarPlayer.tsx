"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Renders a skinned-avatar .glb (SMPL-X mesh + animation produced by the
 * avatar_v2 text->avatar backend) with three.js, and exposes the same live
 * controls as the localhost:8090 prototype: a colour picker + wireframe toggle.
 *
 * The avatar is drawn on the viewer's GPU in the browser; no server video render.
 */

const SKIN_PRESETS = [
  "#dcae8f", "#b5835a", "#8d5524", "#ffd1a3", "#9fd3ff", "#b6f7c1", "#e0e0e0",
];

export default function AvatarPlayer({
  glbUrl,
  className = "",
}: {
  glbUrl: string;
  className?: string;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  // three.js objects kept across renders
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const meshMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const frameRef = useRef<number>(0);

  const [color, setColor] = useState<string>(SKIN_PRESETS[0]);
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ---- one-time scene setup ----
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight, false);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    camera.position.set(0, 1.4, 3);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.3, 0);
    controls.enableDamping = true;
    controlsRef.current = controls;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x33384a, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(2, 4, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.6);
    rim.position.set(-3, 2, -2);
    scene.add(rim);

    const clock = new THREE.Clock();
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      if (mixerRef.current) mixerRef.current.update(dt);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);
    onResize();

    return () => {
      cancelAnimationFrame(frameRef.current);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  // ---- (re)load the GLB whenever the url changes ----
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!scene || !camera || !controls || !glbUrl) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const disposeModel = () => {
      const prev = modelRef.current;
      if (prev) {
        scene.remove(prev);
        prev.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
          const mat = m.material;
          if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x) => x.dispose());
        });
      }
      modelRef.current = null;
      mixerRef.current = null;
      meshMatRef.current = null;
    };

    const loader = new GLTFLoader();
    loader.load(
      glbUrl,
      (gltf) => {
        if (cancelled) return;
        disposeModel();
        const model = gltf.scene;
        scene.add(model);
        modelRef.current = model;

        const skinned = model.getObjectByProperty("type", "SkinnedMesh") as
          | THREE.SkinnedMesh
          | undefined;
        if (skinned && skinned.material) {
          meshMatRef.current = skinned.material as THREE.MeshStandardMaterial;
        }
        applySkin();

        // frame the avatar
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        controls.target.copy(center);
        camera.position.set(center.x, center.y + size.y * 0.05, center.z + size.y * 1.4);

        if (gltf.animations.length) {
          const mixer = new THREE.AnimationMixer(model);
          mixer.clipAction(gltf.animations[0]).play();
          mixerRef.current = mixer;
        }
        setLoading(false);
      },
      undefined,
      (err) => {
        if (cancelled) return;
        setError("Could not load avatar.");
        setLoading(false);
        console.error("AvatarPlayer load error", err);
      },
    );

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glbUrl]);

  // ---- apply colour / wireframe to the loaded mesh ----
  const applySkin = () => {
    const mat = meshMatRef.current;
    if (!mat) return;
    mat.color.set(color);
    mat.wireframe = wireframe;
    mat.needsUpdate = true;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(applySkin, [color, wireframe]);

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="relative w-full overflow-hidden rounded-xl border border-[color:var(--border)] bg-slate-950">
        <div ref={mountRef} className="h-[360px] w-full" />
        {loading && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-300">
            Loading avatar…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-rose-300">
            {error}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--muted)]">
          Skin
        </span>
        <div className="flex items-center gap-1.5">
          {SKIN_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Skin colour ${c}`}
              className={`h-6 w-6 rounded-full border-2 transition-all ${
                color.toLowerCase() === c.toLowerCase()
                  ? "border-[color:var(--ink)]"
                  : "border-transparent"
              }`}
              style={{ background: c }}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            aria-label="Custom skin colour"
            className="h-6 w-6 cursor-pointer rounded-full border border-[color:var(--border)] bg-transparent p-0"
          />
        </div>
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-[color:var(--ink)]">
          <input
            type="checkbox"
            checked={wireframe}
            onChange={(e) => setWireframe(e.target.checked)}
          />
          Wireframe
        </label>
      </div>
    </div>
  );
}
