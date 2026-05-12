import { useEffect, useRef, useState } from "react";
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export default function PlasmaBlob({ color = '#0084ff', size = 1.0, onInterimTranscript, onFinalTranscript, onMicStart, isSpeaking = false }) {
  const mountRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const sceneStateRef = useRef({});
  const isSpeakingRef = useRef(false);
  const [micActive, setMicActive] = useState(false);
  const [micError, setMicError] = useState(false);

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      
      // Initialize Speech Recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        let finalBuffer = '';

        recognition.onresult = (event) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const result = event.results[i];
            if (result.isFinal) {
              finalBuffer += result[0].transcript + ' ';
              // Fire final callback — triggers Groq
              if (onFinalTranscript) onFinalTranscript(finalBuffer.trim());
              finalBuffer = ''; // reset for next sentence
            } else {
              interim += result[0].transcript;
            }
          }
          // Always update live preview
          if (onInterimTranscript) onInterimTranscript(interim);
        };

        recognition.onerror = (e) => {
          if (e.error !== 'no-speech') console.warn('SpeechRecognition error:', e.error);
        };

        recognition.start();
      }

      if (onMicStart) onMicStart();
      setMicActive(true);
    } catch {
      setMicError(true);
    }
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Scene
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.z = 2.4;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    mount.appendChild(renderer.domElement);

    let controls = null;
    if (OrbitControls) {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.enablePan = false;
      controls.enableZoom = false;
      controls.minDistance = 1.5;
      controls.maxDistance = 20;
    }

    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    const noiseFunctions = `
      vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
      vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
      vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
      vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
      float snoise(vec3 v){
        const vec2 C=vec2(1.0/6.0,1.0/3.0);
        const vec4 D=vec4(0.0,0.5,1.0,2.0);
        vec3 i=floor(v+dot(v,C.yyy));
        vec3 x0=v-i+dot(i,C.xxx);
        vec3 g=step(x0.yzx,x0.xyz);
        vec3 l=1.0-g;
        vec3 i1=min(g.xyz,l.zxy);
        vec3 i2=max(g.xyz,l.zxy);
        vec3 x1=x0-i1+C.xxx;
        vec3 x2=x0-i2+C.yyy;
        vec3 x3=x0-D.yyy;
        i=mod289(i);
        vec4 p=permute(permute(permute(
          i.z+vec4(0.0,i1.z,i2.z,1.0))
          +i.y+vec4(0.0,i1.y,i2.y,1.0))
          +i.x+vec4(0.0,i1.x,i2.x,1.0));
        float n_=0.142857142857;
        vec3 ns=n_*D.wyz-D.xzx;
        vec4 j=p-49.0*floor(p*ns.z*ns.z);
        vec4 x_=floor(j*ns.z);
        vec4 y_=floor(j-7.0*x_);
        vec4 x=x_*ns.x+ns.yyyy;
        vec4 y=y_*ns.x+ns.yyyy;
        vec4 h=1.0-abs(x)-abs(y);
        vec4 b0=vec4(x.xy,y.xy);
        vec4 b1=vec4(x.zw,y.zw);
        vec4 s0=floor(b0)*2.0+1.0;
        vec4 s1=floor(b1)*2.0+1.0;
        vec4 sh=-step(h,vec4(0.0));
        vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
        vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
        vec3 p0=vec3(a0.xy,h.x);
        vec3 p1=vec3(a0.zw,h.y);
        vec3 p2=vec3(a1.xy,h.z);
        vec3 p3=vec3(a1.zw,h.w);
        vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
        p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
        vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
        m=m*m;
        return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
      }
      float fbm(vec3 p){
        float t=0.0,a=0.5,f=1.0;
        for(int i=0;i<4;i++){t+=snoise(p*f)*a;a*=0.5;f*=2.0;}
        return t;
      }
    `;

    // Shell
    const shellGeo = new THREE.SphereGeometry(1.0, 64, 64);
    const shellVS = `
      varying vec3 vNormal;varying vec3 vViewPosition;
      void main(){
        vNormal=normalize(normalMatrix*normal);
        vec4 mvp=modelViewMatrix*vec4(position,1.0);
        vViewPosition=-mvp.xyz;
        gl_Position=projectionMatrix*mvp;
      }`;
    const shellFS = `
      varying vec3 vNormal;varying vec3 vViewPosition;
      uniform vec3 uColor;uniform float uOpacity;
      void main(){
        float f=pow(1.0-dot(normalize(vNormal),normalize(vViewPosition)),2.5);
        gl_FragColor=vec4(uColor,f*uOpacity);
      }`;

    const shellBack = new THREE.ShaderMaterial({
      vertexShader: shellVS, fragmentShader: shellFS,
      uniforms: { uColor: { value: new THREE.Color(0x000055) }, uOpacity: { value: 0.3 } },
      transparent: true, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false
    });
    const shellFront = new THREE.ShaderMaterial({
      vertexShader: shellVS, fragmentShader: shellFS,
      uniforms: { uColor: { value: new THREE.Color(0x0066ff) }, uOpacity: { value: 0.41 } },
      transparent: true, blending: THREE.AdditiveBlending, side: THREE.FrontSide, depthWrite: false
    });
    mainGroup.add(new THREE.Mesh(shellGeo, shellBack));
    mainGroup.add(new THREE.Mesh(shellGeo, shellFront));

    // Plasma
    const plasmaGeo = new THREE.SphereGeometry(0.998, 128, 128);
    const plasmaMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: 0.1404 },
        uBrightness: { value: 1.31 },
        uThreshold: { value: 0.072 },
        uMicScale: { value: 1.0 },
        uColorDeep: { value: new THREE.Color(0x001433) },
        uColorMid: { value: new THREE.Color(0x0084ff) },
        uColorBright: { value: new THREE.Color(0x00ffe1) }
      },
      vertexShader: `
        uniform float uMicScale;
        varying vec3 vPosition;varying vec3 vNormal;varying vec3 vViewPosition;
        ${noiseFunctions}
        void main(){
          vNormal=normalize(normalMatrix*normal);
          vec3 pos=position;
          float disp=fbm(pos*2.0+uMicScale*0.3)*0.08*(uMicScale-1.0)*6.0;
          pos+=normal*disp;
          pos*=mix(1.0,uMicScale,0.6);
          vPosition=pos;
          vec4 mvp=modelViewMatrix*vec4(pos,1.0);
          vViewPosition=-mvp.xyz;
          gl_Position=projectionMatrix*mvp;
        }`,
      fragmentShader: `
        uniform float uTime;uniform float uScale;uniform float uBrightness;uniform float uThreshold;uniform float uMicScale;
        uniform vec3 uColorDeep;uniform vec3 uColorMid;uniform vec3 uColorBright;
        varying vec3 vPosition;varying vec3 vNormal;varying vec3 vViewPosition;
        ${noiseFunctions}
        void main(){
          vec3 p=vPosition*uScale;
          vec3 q=vec3(
            fbm(p+vec3(0.0,uTime*0.05,0.0)),
            fbm(p+vec3(5.2,1.3,2.8)+uTime*0.05),
            fbm(p+vec3(2.2,8.4,0.5)-uTime*0.02)
          );
          float density=fbm(p+2.0*q);
          float t=(density+0.4)*0.8;
          float alpha=smoothstep(uThreshold,0.7,t);
          vec3 cWhite=vec3(1.0);
          vec3 color=mix(uColorDeep,uColorMid,smoothstep(uThreshold,0.5,t));
          color=mix(color,uColorBright,smoothstep(0.5,0.8,t));
          color=mix(color,cWhite,smoothstep(0.8,1.0,t));
          float facing=dot(normalize(vNormal),normalize(vViewPosition));
          float depth=(facing+1.0)*0.5;
          float flashBoost=max(0.0,(uMicScale-1.0)*0.5);
          gl_FragColor=vec4(color*(uBrightness+flashBoost),alpha*(0.02+0.98*depth));
        }`,
      transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false
    });
    const plasmaMesh = new THREE.Mesh(plasmaGeo, plasmaMat);
    mainGroup.add(plasmaMesh);

    // Particles
    const pCount = 600;
    const pPos = new Float32Array(pCount * 3);
    const pSizes = new Float32Array(pCount);
    for (let i = 0; i < pCount; i++) {
      const r = 0.95 * Math.cbrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pPos[i * 3 + 2] = r * Math.cos(phi);
      pSizes[i] = Math.random();
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute("aSize", new THREE.BufferAttribute(pSizes, 1));
    const pMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xffffff) } },
      vertexShader: `
        uniform float uTime;attribute float aSize;varying float vAlpha;
        void main(){
          vec3 pos=position;
          pos.y+=sin(uTime*0.2+pos.x)*0.02;
          pos.x+=cos(uTime*0.15+pos.z)*0.02;
          vec4 mvp=modelViewMatrix*vec4(pos,1.0);
          gl_Position=projectionMatrix*mvp;
          gl_PointSize=(8.0*aSize+4.0)*(1.0/-mvp.z);
          vAlpha=0.8+0.2*sin(uTime+aSize*10.0);
        }`,
      fragmentShader: `
        uniform vec3 uColor;varying float vAlpha;
        void main(){
          vec2 uv=gl_PointCoord-vec2(0.5);
          if(length(uv)>0.5)discard;
          float g=pow(1.0-length(uv)*2.0,1.8);
          gl_FragColor=vec4(uColor,g*vAlpha);
        }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
    });
    mainGroup.add(new THREE.Points(pGeo, pMat));

    sceneStateRef.current = { plasmaMat, pMat, plasmaMesh, mainGroup, shellBack, shellFront };

    // Smooth mic value
    let smoothMic = 1.0;

    const clock = new THREE.Clock();
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Mic reactivity
      if (analyserRef.current && dataArrayRef.current) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        const arr = dataArrayRef.current;
        let sum = 0;
        const half = Math.floor(arr.length * 0.4);
        for (let i = 0; i < half; i++) sum += arr[i];
        const avg = sum / half / 255;
        const target = 1.0 + avg * 0.65;
        smoothMic += (target - smoothMic) * 0.12;
      } else if (isSpeakingRef.current) {
        // Cortana-style living speech: layered oscillators at speech-like frequencies
        const speech =
          1.0 +
          Math.abs(Math.sin(t * 7.3 + Math.sin(t * 2.1) * 1.5)) * 0.22 +  // fast flutter
          Math.abs(Math.sin(t * 3.1 + Math.sin(t * 0.9) * 0.8)) * 0.14 +  // mid rhythm
          Math.sin(t * 1.4) * 0.06 +                                        // slow breath
          Math.abs(Math.sin(t * 11.7)) * 0.04;                              // micro tremor
        smoothMic += (speech - smoothMic) * 0.18;
      } else {
        // Idle breathing animation
        const breathe = 1.0 + Math.sin(t * 1.2) * 0.03;
        smoothMic += (breathe - smoothMic) * 0.05;
      }

      plasmaMat.uniforms.uTime.value = t * 0.78;
      plasmaMat.uniforms.uMicScale.value = smoothMic;
      pMat.uniforms.uTime.value = t;

      plasmaMesh.rotation.y = t * 0.08;
      mainGroup.rotation.x += 0.002;
      mainGroup.rotation.y += 0.005;

      if (controls) controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  // Keep isSpeakingRef in sync with prop
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);

  useEffect(() => {
    if (!sceneStateRef.current || !sceneStateRef.current.plasmaMat) return;
    const { plasmaMat, shellBack, shellFront, pMat, mainGroup } = sceneStateRef.current;
    
    const mainColor = new THREE.Color(color);
    const deepColor = mainColor.clone().multiplyScalar(0.2);
    const brightColor = mainColor.clone().addScalar(0.4);
    
    plasmaMat.uniforms.uColorDeep.value = deepColor;
    plasmaMat.uniforms.uColorMid.value = mainColor;
    plasmaMat.uniforms.uColorBright.value = brightColor;
    
    shellBack.uniforms.uColor.value = mainColor.clone().multiplyScalar(0.5);
    shellFront.uniforms.uColor.value = mainColor;
    pMat.uniforms.uColor.value = brightColor;
    
    // Smooth size updating if possible, but directly scaling mainGroup is fine
    mainGroup.scale.set(size, size, size);
  }, [color, size]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "visible" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

      {/* Mic button */}
      <div style={{
        position: "absolute", bottom: -70, left: "50%", transform: "translateX(-50%)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10, zIndex: 10
      }}>
        <button
          onClick={startMic}
          disabled={micActive}
          style={{
            width: 56, height: 56, borderRadius: "50%",
            background: micActive ? "rgba(0,132,255,0.35)" : "rgba(255,255,255,0.08)",
            border: micActive ? "1.5px solid #0084ff" : "1.5px solid rgba(255,255,255,0.25)",
            cursor: micActive ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.3s",
            boxShadow: micActive ? "0 0 18px rgba(0,132,255,0.5)" : "none",
            outline: "none"
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={micActive ? "#00ffe1" : "rgba(255,255,255,0.7)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="11" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="8" y1="22" x2="16" y2="22" />
          </svg>
        </button>
        <span style={{ fontSize: 12, color: micActive ? "#0084ff" : "rgba(255,255,255,0.4)", letterSpacing: "0.05em" }}>
          {micError ? "mic unavailable" : micActive ? "listening" : "tap to activate mic"}
        </span>
      </div>
    </div>
  );
}
