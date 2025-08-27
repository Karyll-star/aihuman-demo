import * as THREE from 'three';
import { GLTFLoader } from 'https://unpkg.com/three@0.156.1/examples/jsm/loaders/GLTFLoader.js';

let scene, camera, renderer, model;
const canvas = document.getElementById("canvas");
let isSending = false;

// Gal 对话框元素和打字机状态
const dialogueBox = document.getElementById('dialogueBox');
const dialogueTextEl = document.getElementById('dialogueText');
let typewriterTimer = null;
let typingFullText = '';
let typingIndex = 0;
let isTyping = false;

init();

function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const light = new THREE.DirectionalLight(0xffffff, 1.1);
  light.position.set(1, 1, 1).normalize();
  scene.add(light);
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));

  const loader = new GLTFLoader();
  loader.load("Duck.glb", gltf => {
    model = gltf.scene;
    // 模型归一化与居中
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    model.position.sub(center); // 将模型中心移到原点
    const maxAxis = Math.max(size.x, size.y, size.z);
    const scale = 1.0 / maxAxis; // 统一缩放到单位尺寸
    model.scale.setScalar(scale * 1.6); // 稍微放大一点
    scene.add(model);

    // 基于包围盒设置相机距离
    const fov = camera.fov * (Math.PI / 180);
    const targetZ = (maxAxis / 2) / Math.tan(fov / 2) * 1.6; // 放大系数
    camera.position.set(0, 0.1, targetZ);
    camera.lookAt(0, 0.1, 0);

    animate();
  });

  // 视口自适应
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // 点击对话框：若在打字则立即展示完整；否则无动作
  if (dialogueBox) {
    dialogueBox.addEventListener('click', () => {
      if (isTyping) {
        finishTypewriter();
      }
    });
  }
}

function animate() {
  requestAnimationFrame(animate);
  if (model) model.rotation.y += 0.002;
  renderer.render(scene, camera);
}

async function sendMessage() {
  if (isSending) return;
  const input = document.getElementById("input");
  const text = input.value.trim();
  if (!text) return;
  isSending = true;
  const sendBtn = document.getElementById('send');
  if (sendBtn) {
    sendBtn.disabled = true;
    const oldText = sendBtn.textContent;
    sendBtn.dataset.oldText = oldText || '';
    sendBtn.textContent = '发送中…';
  }
  const replyDiv = document.getElementById("reply");
  if (replyDiv) replyDiv.textContent = '思考中…';

  const res = await fetch("/ai", {
    method: "POST",
    body: JSON.stringify({ message: text }),
    headers: { "Content-Type": "application/json" }
  });
  if (!res.ok) {
    const errText = await res.text();
    alert(`服务错误(${res.status}): ${errText}`);
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = sendBtn.dataset.oldText || '发送';
    }
    isSending = false;
    return;
  }
  const data = await res.json();

  // 显示文本回复（逐字打字）
  const textToShow = data.text || '';
  if (replyDiv) replyDiv.textContent = textToShow; // 作为纯文本备份
  startTypewriter(textToShow);

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
  if (sendBtn) {
    sendBtn.disabled = false;
    sendBtn.textContent = sendBtn.dataset.oldText || '发送';
  }
  isSending = false;
}

// 打字机相关
function startTypewriter(text) {
  clearTypewriter();
  typingFullText = text;
  typingIndex = 0;
  isTyping = true;
  if (dialogueTextEl) dialogueTextEl.textContent = '';
  typewriterTimer = setInterval(() => {
    if (typingIndex >= typingFullText.length) {
      finishTypewriter();
      return;
    }
    const nextChar = typingFullText[typingIndex++];
    if (dialogueTextEl) dialogueTextEl.textContent += nextChar;
  }, 18); // 速度可调整
}

function finishTypewriter() {
  if (dialogueTextEl) dialogueTextEl.textContent = typingFullText;
  clearTypewriter();
}

function clearTypewriter() {
  if (typewriterTimer) clearInterval(typewriterTimer);
  typewriterTimer = null;
  isTyping = false;
}

// 使内联 onclick 能访问到模块内的函数
window.sendMessage = sendMessage;
