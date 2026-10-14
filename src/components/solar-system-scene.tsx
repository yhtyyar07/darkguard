"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import * as THREE from "three";

const planets = [
  { name: "Mercury", radius: 0.2, orbit: 3.1, color: "#a7a39d", speed: 0.78 },
  { name: "Venus", radius: 0.34, orbit: 4.8, color: "#d7a879", speed: 0.56 },
  { name: "Earth", radius: 0.38, orbit: 6.8, color: "#54a6cf", speed: 0.42 },
  { name: "Mars", radius: 0.29, orbit: 9.1, color: "#cf785c", speed: 0.33 },
  { name: "Jupiter", radius: 0.9, orbit: 12.7, color: "#d8ad82", speed: 0.22 },
  { name: "Saturn", radius: 0.72, orbit: 16.5, color: "#d8c38d", speed: 0.17 },
  { name: "Uranus", radius: 0.54, orbit: 20.1, color: "#77c5c5", speed: 0.13 },
  { name: "Neptune", radius: 0.52, orbit: 23.8, color: "#527fd0", speed: 0.1 },
];

export default function SolarSystemScene() {
  const canvasHost = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(true);
  const playingRef = useRef(playing);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    const host = canvasHost.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#05080d");
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 220);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight("#9bb4ca", 0.42));
    scene.add(new THREE.PointLight("#ffd28a", 95, 90, 1.4));

    const starPositions = new Float32Array(2200 * 3);
    for (let index = 0; index < starPositions.length; index += 3) {
      starPositions[index] = (Math.random() - 0.5) * 190;
      starPositions[index + 1] = (Math.random() - 0.5) * 120;
      starPositions[index + 2] = (Math.random() - 0.5) * 100 - 20;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: "#dce8f3",
        size: 0.105,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.78,
      })
    );
    scene.add(stars);

    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(1.18, 48, 48),
      new THREE.MeshBasicMaterial({ color: "#ffc06d" })
    );
    scene.add(sun);

    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = 128;
    glowCanvas.height = 128;
    const glowContext = glowCanvas.getContext("2d");
    if (glowContext) {
      const glow = glowContext.createRadialGradient(64, 64, 3, 64, 64, 64);
      glow.addColorStop(0, "rgba(255, 197, 116, 0.62)");
      glow.addColorStop(0.24, "rgba(249, 151, 72, 0.22)");
      glow.addColorStop(1, "rgba(249, 151, 72, 0)");
      glowContext.fillStyle = glow;
      glowContext.fillRect(0, 0, 128, 128);
    }
    const sunGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(glowCanvas),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      })
    );
    sunGlow.scale.set(9.5, 9.5, 1);
    scene.add(sunGlow);

    const planetObjects = planets.map((planet, index) => {
      const orbitPoints = new THREE.EllipseCurve(
        0,
        0,
        planet.orbit,
        planet.orbit,
        0,
        Math.PI * 2,
        false,
        0
      )
        .getPoints(180)
        .map((point) => new THREE.Vector3(point.x, point.y, -0.04));
      const orbit = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(orbitPoints),
        new THREE.LineBasicMaterial({
          color: index < 4 ? "#71808d" : "#566674",
          transparent: true,
          opacity: 0.25,
        })
      );
      scene.add(orbit);

      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(planet.radius, 32, 32),
        new THREE.MeshStandardMaterial({
          color: planet.color,
          roughness: 0.84,
          metalness: 0.02,
          emissive: planet.color,
          emissiveIntensity: 0.035,
        })
      );
      scene.add(mesh);

      if (planet.name === "Saturn") {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(planet.radius * 1.5, 0.1, 2, 80),
          new THREE.MeshBasicMaterial({
            color: "#d8c69b",
            transparent: true,
            opacity: 0.76,
          })
        );
        ring.rotation.x = Math.PI / 2.5;
        mesh.add(ring);
      }

      return {
        mesh,
        orbit: planet.orbit,
        speed: planet.speed,
        angle: index * 0.83 + 0.35,
      };
    });

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      const aspect = width / height;
      camera.aspect = aspect;
      const framing = aspect < 0.85 ? 1.6 / aspect : 1;
      camera.position.set(0, 23 * framing, 49 * framing);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frameId = 0;
    let lastFrame = 0;
    const animate = (time: number) => {
      frameId = window.requestAnimationFrame(animate);
      const delta = lastFrame ? Math.min((time - lastFrame) / 1000, 0.05) : 0;
      lastFrame = time;

      if (playingRef.current && !motionPreference.matches) {
        for (const planet of planetObjects) {
          planet.angle += delta * planet.speed * 0.12;
          planet.mesh.position.set(
            Math.cos(planet.angle) * planet.orbit,
            Math.sin(planet.angle) * planet.orbit,
            0
          );
          planet.mesh.rotation.y += delta * 0.18;
        }
        stars.rotation.z += delta * 0.0008;
      }

      renderer.render(scene, camera);
    };
    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            if ("map" in material && material.map) material.map.dispose();
            material.dispose();
          }
        } else if (object instanceof THREE.Sprite) {
          object.material.map?.dispose();
          object.material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <main className="relative h-[100svh] min-h-[540px] w-full overflow-hidden bg-[#05080d] text-[#f1eee7]">
      <div ref={canvasHost} className="absolute inset-0" aria-label="Animated solar system" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(5,8,13,0.68)_0%,rgba(5,8,13,0.18)_43%,rgba(5,8,13,0)_75%),linear-gradient(0deg,rgba(5,8,13,0.62)_0%,transparent_34%)]" />

      <header className="pointer-events-none absolute left-6 top-8 max-w-[min(34rem,80vw)] sm:left-12 sm:top-12 lg:left-20 lg:top-16">
        <p className="mb-4 text-[10px] font-medium uppercase text-[#c4a779] sm:text-xs">
          A study of our neighborhood
        </p>
        <h1 className="font-serif text-5xl leading-[0.96] sm:text-7xl lg:text-8xl">
          The solar
          <br />
          system
        </h1>
        <p className="mt-5 max-w-xs text-sm leading-6 text-[#c5c7c7] sm:text-base">
          Eight worlds, one star, and the quiet rhythm between them.
        </p>
      </header>

      <div className="pointer-events-none absolute bottom-8 left-6 right-24 sm:bottom-12 sm:left-12 lg:bottom-14 lg:left-20">
        <p className="mb-3 text-[9px] uppercase text-[#a3abb0] sm:text-[10px]">
          The planetary sequence
        </p>
        <div className="flex max-w-3xl flex-wrap gap-x-3 gap-y-2 text-[10px] text-[#e0ddd4] sm:gap-x-5 sm:text-xs">
          {planets.map((planet, index) => (
            <span key={planet.name} className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: planet.color }} />
              <span className="text-[#777f85]">0{index + 1}</span>
              {planet.name}
            </span>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setPlaying((current) => !current)}
        aria-label={playing ? "Pause planetary motion" : "Resume planetary motion"}
        title={playing ? "Pause motion" : "Resume motion"}
        className="absolute bottom-8 right-6 grid h-11 w-11 place-items-center border border-white/20 bg-black/30 text-white backdrop-blur-sm transition-colors hover:border-[#c4a779] hover:text-[#e1c38d] sm:bottom-12 sm:right-12 lg:bottom-14 lg:right-20"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
    </main>
  );
}