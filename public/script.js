import * as THREE from 'three';
import { GLTFLoader } from 'https://unpkg.com/three@0.156.1/examples/jsm/loaders/GLTFLoader.js';

let scene, camera, renderer, model;
const canvas = document.getElementById("canvas");

init();

function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(1, 1, 1).normalize();
  scene.add(light);

  const loader = new GLTFLoader();
  loader.load("Duck.glb", gltf => {
    model = gltf.scene;
    scene.add(model);
    camera.position.z = 2;
    animate();
  });
}

function animate() {
  requestAnimationFrame(animate);
  if (model) model.rotation.y += 0.002;
  renderer.render(scene, camera);
}

async function sendMessage() {
  const input = document.getElementById("input");
  const text = input.value.trim();
  if (!text) return;

  const res = await fetch("/ai", {
    method: "POST",
    body: JSON.stringify({ message: text }),
    headers: { "Content-Type": "application/json" }
  });
  if (!res.ok) {
    const errText = await res.text();
    alert(`服务错误(${res.status}): ${errText}`);
    return;
  }
  const data = await res.json();

  // 显示文本回复
  const replyDiv = document.getElementById("reply");
  if (replyDiv && data.text) {
    replyDiv.textContent = data.text;
  }

  // 播放返回的语音
  const audio = document.getElementById("voice");
  if (data.audio) {
    const mime = data.mime || 'audio/mp3';
    audio.src = `data:${mime};base64,` + data.audio;
  }

  // 简单嘴型动作模拟
  if (model) {
    let i = 0;
    const interval = setInterval(() => {
      model.rotation.x = Math.sin(i / 5) * 0.05;
      i++;
      if (i > 50) clearInterval(interval);
    }, 50);
  }

  input.value = "";
}

// 使内联 onclick 能访问到模块内的函数
window.sendMessage = sendMessage;
