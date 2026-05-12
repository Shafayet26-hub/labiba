import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

// ─── GLSL SHADERS ────────────────────────────────────────────────────────────

const plasmaVert = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;

  uniform float uAudioScale;   // mic-driven radial deformation
  uniform float uTime;

  // lightweight noise for vertex displacement
  float hash(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  float noise3(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(
      mix(mix(hash(i),            hash(i+vec3(1,0,0)),f.x),
          mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
      mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
          mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),
      f.z);
  }

  void main() {
    vNormal   = normalize(normalMatrix * normal);
    float t   = uTime * 0.4;

    // organic blob deformation driven by audio
    float disp = noise3(normal * 2.8 + vec3(t * 0.5, t * 0.3, t * 0.7));
    disp       = (disp - 0.5) * 2.0;            // -1..1
    float bump = disp * uAudioScale * 0.35;     // audio-scaled

    vec3 displaced = position + normal * bump;
    vPosition = (modelMatrix * vec4(displaced, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const plasmaFrag = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uScale;
  uniform float uBrightness;
  uniform float uVoidThreshold;
  uniform vec3  uColorDeep;
  uniform vec3  uColorMid;
  uniform vec3  uColorBright;
  uniform float uAudioScale;  // brightens plasma on loud audio

  varying vec3 vNormal;
  varying vec3 vPosition;

  float hash(vec3 p) {
    p = fract(p * vec3(0.1031,0.1030,0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  float noise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(
      mix(mix(hash(i),            hash(i+vec3(1,0,0)),f.x),
          mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
      mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
          mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0; float a = 0.5; vec3 sh = vec3(100.0);
    for (int i = 0; i < 6; i++) { v += a * noise(p); p = p*2.0+sh; a *= 0.5; }
    return v;
  }

  void main() {
    vec3 p  = vPosition * (1.0 / uScale);
    float t = uTime * 0.3;

    vec3 q = vec3(
      fbm(p + vec3(0.0, 0.0, t)),
      fbm(p + vec3(5.2, 1.3, t*0.8)),
      fbm(p + vec3(1.7, 9.2, t*0.6))
    );
    vec3 r = vec3(
      fbm(p + 4.0*q + vec3(1.7, 9.2, t*0.5)),
      fbm(p + 4.0*q + vec3(8.3, 2.8, t*0.4)),
      fbm(p + 4.0*q + vec3(2.3, 5.7, t*0.7))
    );
    float f = clamp(fbm(p + 4.0*r), 0.0, 1.0);

    vec3 color = mix(uColorDeep,  uColorMid,   clamp(f*2.0,   0.0,1.0));
         color = mix(color,       uColorBright, clamp(f*f*3.5, 0.0,1.0));

    float fresnel = pow(1.0 - abs(dot(vNormal, normalize(vec3(0,0,1)))), 2.0);
    color += uColorBright * fresnel * (0.3 + uAudioScale * 0.4);

    float bright  = uBrightness + uAudioScale * 0.6;
    color        *= bright;

    float voidMask = step(uVoidThreshold, f);
    gl_FragColor   = vec4(color, voidMask * 0.95);
  }
`;

const shellVert = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewDir   = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const shellFrag = /* glsl */ `
  precision highp float;
  uniform vec3  uEdgeColor;
  uniform float uEdgeOpacity;
  uniform float uAudioScale;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float fresnel = pow(1.0 - abs(dot(vNormal, vViewDir)), 3.5);
    float alpha   = fresnel * (uEdgeOpacity + uAudioScale * 0.3);
    gl_FragColor  = vec4(uEdgeColor * fresnel, clamp(alpha, 0.0, 1.0));
  }
`;

const atmoVert = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewDir   = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const atmoFrag = /* glsl */ `
  precision highp float;
  uniform vec3  uAtmoColor;
  uniform float uIntensity;
  uniform float uAudioScale;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float fresnel = pow(1.0 - abs(dot(vNormal, vViewDir)), 2.0);
    float alpha   = fresnel * (uIntensity + uAudioScale * 0.5);
    gl_FragColor  = vec4(uAtmoColor * fresnel, clamp(alpha, 0.0, 0.85));
  }
`;

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function MagicPlasmaSphere() {
  const mountRef  = useRef(null);
  const threeRef  = useRef({});   // holds all three.js objects
  const audioRef  = useRef({});   // holds Web Audio objects
  const rafRef    = useRef(null);

  const [listening, setListening] = useState(false);
  const [error,     setError]     = useState(null);

  // ── bootstrap Three.js ──────────────────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current;
    const W  = el.clientWidth;
    const H  = el.clientHeight;

    // renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping        = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    el.appendChild(renderer.domElement);

    // scene / camera
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.01, 100);
    camera.position.set(0, 0, 2.5);

    // shared audio uniform (ref so animate loop can read it cheaply)
    const audioUni = { value: 0.0 };

    // ── plasma core ──
    const plasmaMat = new THREE.ShaderMaterial({
      vertexShader:   plasmaVert,
      fragmentShader: plasmaFrag,
      uniforms: {
        uTime:          { value: 0 },
        uScale:         { value: 0.1404 },
        uBrightness:    { value: 1.31 },
        uVoidThreshold: { value: 0.072 },
        uColorDeep:     { value: new THREE.Color(0x001433) },
        uColorMid:      { value: new THREE.Color(0x0084ff) },
        uColorBright:   { value: new THREE.Color(0x00ffe1) },
        uAudioScale:    audioUni,
      },
      transparent: true,
      side:        THREE.FrontSide,
      depthWrite:  false,
    });

    const plasmaMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 128, 128),
      plasmaMat
    );
    scene.add(plasmaMesh);

    // ── shell ──
    const shellMat = new THREE.ShaderMaterial({
      vertexShader:   shellVert,
      fragmentShader: shellFrag,
      uniforms: {
        uEdgeColor:   { value: new THREE.Color(0x0066ff) },
        uEdgeOpacity: { value: 0.72 },
        uAudioScale:  audioUni,
      },
      transparent: true,
      side:        THREE.FrontSide,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });

    const shellMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.01, 64, 64),
      shellMat
    );
    scene.add(shellMesh);

    // ── atmosphere ──
    const atmoMat = new THREE.ShaderMaterial({
      vertexShader:   atmoVert,
      fragmentShader: atmoFrag,
      uniforms: {
        uAtmoColor:  { value: new THREE.Color(0x0044ff) },
        uIntensity:  { value: 0.65 },
        uAudioScale: audioUni,
      },
      transparent: true,
      side:        THREE.BackSide,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });

    const atmoMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.25, 64, 64),
      atmoMat
    );
    scene.add(atmoMesh);

    // ── particles ──
    const pGeo  = new THREE.BufferGeometry();
    const pPos  = [];
    for (let i = 0; i < 3000; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 1.05 + Math.random() * 0.3;
      pPos.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
    }
    pGeo.setAttribute("position", new THREE.Float32BufferAttribute(pPos, 3));
    const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
      color:      0x88ccff,
      size:       0.006,
      transparent: true,
      opacity:    0.6,
      blending:   THREE.AdditiveBlending,
      depthWrite: false,
    }));
    scene.add(particles);

    // ── store refs ──
    threeRef.current = {
      renderer, scene, camera,
      plasmaMesh, shellMesh, atmoMesh, particles,
      plasmaMat, shellMat, atmoMat,
      audioUni,
    };

    // ── resize ──
    const onResize = () => {
      const W = el.clientWidth, H = el.clientHeight;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      renderer.setSize(W, H);
    };
    window.addEventListener("resize", onResize);

    // ── animate ──
    const clock    = new THREE.Clock();
    let   smoothed = 0;

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // smooth the audio value (exponential moving average)
      const raw      = audioUni.value;       // set by mic loop below
      smoothed       = smoothed * 0.88 + raw * 0.12;
      const aVal     = smoothed;

      // update shader uniforms
      plasmaMat.uniforms.uTime.value       = elapsed * 0.78;
      plasmaMat.uniforms.uAudioScale.value = aVal;
      shellMat.uniforms.uAudioScale.value  = aVal;
      atmoMat.uniforms.uAudioScale.value   = aVal;

      // scale the whole sphere group by audio
      const s = 1.0 + aVal * 0.28;
      plasmaMesh.scale.setScalar(s);
      shellMesh.scale.setScalar(s);
      atmoMesh.scale.setScalar(s);

      // gentle rotation + audio-modulated spin
      plasmaMesh.rotation.x += 0.002 + aVal * 0.004;
      plasmaMesh.rotation.y += 0.005 + aVal * 0.008;
      shellMesh.rotation.copy(plasmaMesh.rotation);
      particles.rotation.y  += 0.0003 + aVal * 0.001;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  // ── microphone ──────────────────────────────────────────────────────────
  const startMic = async () => {
    setError(null);
    try {
      const stream  = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx     = new (window.AudioContext || window.webkitAudioContext)();
      const source  = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize        = 256;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);

      const buf = new Uint8Array(analyser.frequencyBinCount);

      const { audioUni } = threeRef.current;

      const poll = () => {
        analyser.getByteFrequencyData(buf);
        // weighted average (emphasise mids 100-3000 Hz)
        let sum = 0, total = 0;
        for (let i = 2; i < buf.length * 0.6; i++) {
          sum   += buf[i];
          total += 1;
        }
        const avg       = total > 0 ? sum / total : 0;
        audioUni.value  = avg / 255;          // 0..1
        audioRef.current.rafId = requestAnimationFrame(poll);
      };
      poll();

      audioRef.current = { ctx, stream, analyser, rafId: null };
      setListening(true);
    } catch (e) {
      setError("Microphone access denied.");
    }
  };

  const stopMic = () => {
    const { ctx, stream, rafId } = audioRef.current;
    if (rafId) cancelAnimationFrame(rafId);
    stream?.getTracks().forEach(t => t.stop());
    ctx?.close();
    if (threeRef.current.audioUni) threeRef.current.audioUni.value = 0;
    setListening(false);
  };

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", background: "#000", overflow: "hidden" }}>
      {/* Three.js canvas mount */}
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

      {/* Mic button */}
      <div style={{
        position:   "absolute",
        bottom:     "2rem",
        left:       "50%",
        transform:  "translateX(-50%)",
        display:    "flex",
        flexDirection: "column",
        alignItems: "center",
        gap:        "0.5rem",
        fontFamily: "'Courier New', monospace",
        userSelect: "none",
      }}>
        <button
          onClick={listening ? stopMic : startMic}
          style={{
            width:        64,
            height:       64,
            borderRadius: "50%",
            border:       listening
              ? "2px solid #00ffe1"
              : "2px solid rgba(0,132,255,0.5)",
            background:   listening
              ? "rgba(0,255,225,0.12)"
              : "rgba(0,50,120,0.25)",
            cursor:       "pointer",
            display:      "flex",
            alignItems:   "center",
            justifyContent: "center",
            transition:   "all 0.3s ease",
            backdropFilter: "blur(8px)",
            boxShadow:    listening
              ? "0 0 20px rgba(0,255,225,0.4), 0 0 60px rgba(0,255,225,0.15)"
              : "0 0 12px rgba(0,100,255,0.3)",
          }}
        >
          {/* mic SVG icon */}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
               stroke={listening ? "#00ffe1" : "#4499ff"} strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="11" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="8"  y1="22" x2="16" y2="22" />
          </svg>
        </button>

        <span style={{
          fontSize:   "0.65rem",
          letterSpacing: "0.12em",
          color:      listening ? "#00ffe1" : "rgba(100,160,255,0.6)",
          transition: "color 0.3s",
        }}>
          {listening ? "LISTENING" : "TAP TO SPEAK"}
        </span>

        {error && (
          <span style={{ fontSize: "0.6rem", color: "#ff4466", marginTop: "0.25rem" }}>
            {error}
          </span>
        )}
      </div>

      {/* idle pulse ring (only when not listening) */}
      {!listening && (
        <style>{`
          @keyframes pulse-ring {
            0%   { transform: translate(-50%,-50%) scale(0.95); opacity: 0.6; }
            70%  { transform: translate(-50%,-50%) scale(1.15);  opacity: 0; }
            100% { transform: translate(-50%,-50%) scale(0.95); opacity: 0; }
          }
          .pulse-ring {
            position: absolute;
            top: 50%; left: 50%;
            width: 260px; height: 260px;
            border-radius: 50%;
            border: 1px solid rgba(0,132,255,0.25);
            animation: pulse-ring 3s ease-out infinite;
            pointer-events: none;
          }
        `}</style>
      )}
      {!listening && <div className="pulse-ring" />}
    </div>
  );
}
