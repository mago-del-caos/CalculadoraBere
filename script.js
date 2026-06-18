import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// =========================================
// ESTADO GLOBAL DE LA APLICACIÓN
// =========================================
const AppState = {
    expression: "0.5 * sin(x * a) + 1",
    a: 1.0,
    b: 1.0,
    mode: '2D', // '2D' o '3D'
    isMobile: window.innerWidth <= 768,
    isDraggingCalc: false,
    isAnimating: false,
    calcExpanded: false,
    isDarkMode: false
};

const themes = {
    light: { bg: 0xf8fafc, paper: 0xffffff, grid: 0xe2e8f0, axes: 0x0f172a },
    dark: { bg: 0x0a0f1d, paper: 0x1e293b, grid: 0x334155, axes: 0x94a3b8 }
};

// Referencias DOM
const els = {
    display: document.getElementById('display'),
    valA: document.getElementById('val-a'),
    valB: document.getElementById('val-b'),
    statusText: document.getElementById('status-text'),
    statusDot: document.getElementById('status-dot'),
    tooltip: document.getElementById('tooltip'),
    calc: document.getElementById('calculator'),
    calcHeader: document.getElementById('calc-header'),
    mobileHandle: document.getElementById('mobile-handle'),
    btnMinimize: document.getElementById('btn-minimize'),
    keypad: document.getElementById('keypad'),
    btn2D: document.getElementById('btn-2d'),
    btn3D: document.getElementById('btn-3d'),
    sliderA: document.getElementById('slider-a'),
    sliderB: document.getElementById('slider-b'),
    themeBtn: document.getElementById('theme-toggle')
};

// =========================================
// SETUP THREE.JS
// =========================================
const container = document.getElementById('viewport');
const scene = new THREE.Scene();
scene.background = new THREE.Color(themes.light.bg);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 10); 
camera.up.set(0, 1, 0); 
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Iluminación
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
scene.add(dirLight);

// =========================================
// CONSTRUCCIÓN DE ESCENA 3D
// =========================================
const group3D = new THREE.Group();
scene.add(group3D);

const geometry3D = new THREE.PlaneGeometry(14, 14, 100, 100); 
geometry3D.rotateX(-Math.PI / 2);

const count = geometry3D.attributes.position.count;
geometry3D.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));

const material3D = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: 0.2,
    metalness: 0.1,
    flatShading: false
});

const mesh3D = new THREE.Mesh(geometry3D, material3D);
mesh3D.castShadow = true;
mesh3D.receiveShadow = true;
mesh3D.visible = false;
group3D.add(mesh3D);

const gridHelper3D = new THREE.GridHelper(20, 20, 0x94a3b8, 0xe2e8f0);
group3D.add(gridHelper3D);
const axesHelper3D = new THREE.AxesHelper(2);
group3D.add(axesHelper3D);

// =========================================
// CONSTRUCCIÓN DE ESCENA 2D
// =========================================
const group2D = new THREE.Group();
scene.add(group2D);

const planeGeo = new THREE.PlaneGeometry(12, 8);
const planeMat = new THREE.MeshBasicMaterial({ color: themes.light.paper, side: THREE.DoubleSide });
const paperPlane = new THREE.Mesh(planeGeo, planeMat);
paperPlane.position.z = -0.1;
group2D.add(paperPlane);

const grid2DMat = new THREE.LineBasicMaterial({ color: themes.light.grid });
const grid2DGroup = new THREE.Group();

for (let i = -6; i <= 6; i++) {
    const pointsV = [new THREE.Vector3(i, -4, 0), new THREE.Vector3(i, 4, 0)];
    grid2DGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pointsV), grid2DMat));
}
for (let i = -4; i <= 4; i++) {
    const pointsH = [new THREE.Vector3(-6, i, 0), new THREE.Vector3(6, i, 0)];
    grid2DGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pointsH), grid2DMat));
}
group2D.add(grid2DGroup);

const axisMat = new THREE.LineBasicMaterial({ color: themes.light.axes });
const xAxisGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-6, 0, 0), new THREE.Vector3(6, 0, 0)]);
const yAxisGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -4, 0), new THREE.Vector3(0, 4, 0)]);
group2D.add(new THREE.Line(xAxisGeo, axisMat));
group2D.add(new THREE.Line(yAxisGeo, axisMat));

const curveRes = 400;
const curve2DGeo = new THREE.BufferGeometry();
const curve2DPos = new Float32Array(curveRes * 3);
curve2DGeo.setAttribute('position', new THREE.BufferAttribute(curve2DPos, 3));

const curve2DMat = new THREE.LineBasicMaterial({ color: 0xef4444 });
const curve2D = new THREE.Line(curve2DGeo, curve2DMat);
group2D.add(curve2D);

// =========================================
// MOTOR MATEMÁTICO
// =========================================
function evaluate(x, y = 0) {
    try {
        let expr = AppState.expression.toLowerCase();
        expr = expr.replace(/\^/g, '**');
        
        // Mapeo logaritmos y otras funciones
        expr = expr.replace(/\bln\(/g, 'Math.log(');
        expr = expr.replace(/\blog\(/g, 'Math.log10(');
        
        const funcs = ['sin','cos','tan','asin','acos','atan','sqrt','abs','exp','pow','floor','ceil','round'];
        funcs.forEach(f => {
            expr = expr.replace(new RegExp(`\\b${f}\\(`, 'g'), `Math.${f}(`);
        });
        
        expr = expr.replace(/\bpi\b/g, 'Math.PI');
        expr = expr.replace(/\be\b/g, 'Math.E');

        // Pasamos z = 0 para evitar errores si el usuario introduce z en una función 2D
        const f = new Function('x', 'y', 'z', 'a', 'b', `return ${expr};`);
        const r = f(x, y, 0, AppState.a, AppState.b);
        return (isNaN(r) || !isFinite(r)) ? null : r;
    } catch (e) { 
        return null; 
    }
}

function updateGraphics() {
    // Malla 3D
    const pos3D = geometry3D.attributes.position;
    const col3D = geometry3D.attributes.color;
    const cLow = new THREE.Color(0x3b82f6);
    const cHigh = new THREE.Color(0xef4444);
    const tempC = new THREE.Color();

    for (let i = 0; i < pos3D.count; i++) {
        const x = pos3D.getX(i);
        const y = pos3D.getZ(i);
        const z = evaluate(x, y);
        
        if (z !== null) {
            pos3D.setY(i, z);
            const t = THREE.MathUtils.clamp((z + 5) / 10, 0, 1);
            tempC.lerpColors(cLow, cHigh, t);
            col3D.setXYZ(i, tempC.r, tempC.g, tempC.b);
        } else {
            pos3D.setY(i, 0);
        }
    }
    pos3D.needsUpdate = true;
    col3D.needsUpdate = true;
    geometry3D.computeVertexNormals();

    // Curva 2D
    const pos2D = curve2DGeo.attributes.position;
    for (let i = 0; i < curveRes; i++) {
        const x = (i / (curveRes - 1)) * 12 - 6;
        const y = evaluate(x, 0);
        if (y !== null) {
            pos2D.setXYZ(i, x, y, 0);
        } else {
            pos2D.setXYZ(i, x, 0, 0);
        }
    }
    pos2D.needsUpdate = true;
}

// =========================================
// LÓGICA DE UI Y EVENTOS
// =========================================

// Delegación de eventos para el teclado
els.keypad.addEventListener('click', (e) => {
    const btn = e.target.closest('button.key');
    if (!btn) return;

    if (btn.dataset.insert) {
        insertText(btn.dataset.insert);
    } else if (btn.dataset.action === 'clear') {
        clearDisplay();
    } else if (btn.dataset.action === 'backspace') {
        backspace();
    } else if (btn.dataset.action === 'calculate') {
        calculate();
    }
});

function insertText(char) {
    AppState.expression += char;
    updateDisplay();
    updateGraphics();
}

function clearDisplay() {
    AppState.expression = "";
    updateDisplay();
    updateGraphics();
}

function backspace() {
    AppState.expression = AppState.expression.slice(0, -1);
    updateDisplay();
    updateGraphics();
}

function calculate() {
    els.display.style.color = '#fff';
    setTimeout(() => els.display.style.color = 'var(--screen-text)', 200);
    updateGraphics();
}

function updateDisplay() {
    const text = AppState.expression || "0";
    els.display.innerHTML = text + '<span class="cursor"></span>';
}

// Sliders
els.sliderA.addEventListener('input', (e) => {
    AppState.a = parseFloat(e.target.value);
    els.valA.innerText = AppState.a.toFixed(1);
    updateGraphics();
});

els.sliderB.addEventListener('input', (e) => {
    AppState.b = parseFloat(e.target.value);
    els.valB.innerText = AppState.b.toFixed(1);
    updateGraphics();
});

// =========================================
// LÓGICA DE MODO (2D <-> 3D)
// =========================================
function setMode(mode) {
    if (AppState.isAnimating) return;
    AppState.mode = mode;
    AppState.isAnimating = true;

    els.btn2D.classList.toggle('active', mode === '2D');
    els.btn3D.classList.toggle('active', mode === '3D');
    
    els.statusText.innerText = mode === '2D' ? "MODO 2D" : "MODO 3D";
    els.statusDot.style.background = mode === '2D' ? "#22c55e" : "#3b82f6";

    let targetPos, targetLookAt, targetUp;

    if (mode === '2D') {
        group3D.visible = false;
        group2D.visible = true;
        targetPos = new THREE.Vector3(0, 0, 10);
        targetLookAt = new THREE.Vector3(0, 0, 0);
        targetUp = new THREE.Vector3(0, 1, 0);
    } else {
        group3D.visible = true;
        group2D.visible = false;
        targetPos = new THREE.Vector3(8, 6, 8);
        targetLookAt = new THREE.Vector3(0, 0, 0);
        targetUp = new THREE.Vector3(0, 1, 0);
    }

    const startPos = camera.position.clone();
    const startUp = camera.up.clone();
    const startTarget = controls.target.clone();
    
    let progress = 0;
    
    function animateCamera() {
        progress += 0.025;
        if (progress > 1) progress = 1;
        
        const ease = 1 - Math.pow(1 - progress, 3); 
        
        camera.position.lerpVectors(startPos, targetPos, ease);
        camera.up.lerpVectors(startUp, targetUp, ease);
        controls.target.lerpVectors(startTarget, targetLookAt, ease);
        controls.update();

        if (progress < 1) {
            requestAnimationFrame(animateCamera);
        } else {
            AppState.isAnimating = false;
            controls.enableRotate = (mode === '3D');
        }
    }
    animateCamera();
}

els.btn2D.addEventListener('click', () => setMode('2D'));
els.btn3D.addEventListener('click', () => setMode('3D'));

// =========================================
// TEMA OSCURO / CLARO
// =========================================
els.themeBtn.addEventListener('click', () => {
    AppState.isDarkMode = !AppState.isDarkMode;
    document.documentElement.classList.toggle('dark-mode', AppState.isDarkMode);
    els.themeBtn.innerText = AppState.isDarkMode ? "☀️" : "🌙";
    
    const theme = AppState.isDarkMode ? themes.dark : themes.light;
    scene.background.setHex(theme.bg);
    paperPlane.material.color.setHex(theme.paper);
    grid2DMat.color.setHex(theme.grid);
    axisMat.color.setHex(theme.axes);
});

// =========================================
// SISTEMA DRAG & DROP (PC) & MOBILE DRAWER
// =========================================
if (AppState.isMobile) {
    setMode('2D');
    expandMobile();
} else {
    setMode('2D');
}

let dragOffset = { x: 0, y: 0 };

els.calcHeader.addEventListener('mousedown', (e) => {
    if (AppState.isMobile) return;
    AppState.isDraggingCalc = true;
    dragOffset.x = e.clientX - els.calc.offsetLeft;
    dragOffset.y = e.clientY - els.calc.offsetTop;
    els.calcHeader.style.cursor = 'grabbing';
});

window.addEventListener('mouseup', () => {
    AppState.isDraggingCalc = false;
    els.calcHeader.style.cursor = AppState.isMobile ? 'default' : 'grab';
});

window.addEventListener('mousemove', (e) => {
    if (AppState.isDraggingCalc && !AppState.isMobile) {
        let newX = e.clientX - dragOffset.x;
        let newY = e.clientY - dragOffset.y;
        newX = Math.max(0, Math.min(window.innerWidth - els.calc.offsetWidth, newX));
        newY = Math.max(0, Math.min(window.innerHeight - els.calc.offsetHeight, newY));
        els.calc.style.left = newX + 'px';
        els.calc.style.top = newY + 'px';
        els.calc.style.right = 'auto';
    }
});

function expandMobile() {
    els.calc.classList.add('expanded');
    AppState.calcExpanded = true;
    els.btnMinimize.style.background = '#94a3b8';
}

function minimizeMobile() {
    els.calc.classList.remove('expanded');
    AppState.calcExpanded = false;
    els.btnMinimize.style.background = '#ef4444';
}

els.btnMinimize.addEventListener('click', () => {
    if (AppState.calcExpanded) minimizeMobile(); else expandMobile();
});

let touchStartY = 0;
els.calcHeader.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
}, {passive: true});

els.calcHeader.addEventListener('touchmove', (e) => {
    const touchY = e.touches[0].clientY;
    const diff = touchStartY - touchY;
    if (diff > 50 && !AppState.calcExpanded) expandMobile();
    if (diff < -50 && AppState.calcExpanded) minimizeMobile();
}, {passive: true});

// =========================================
// INTERACCIÓN CON EL GRÁFICO (Raycaster)
// =========================================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const pointerMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee })
);
scene.add(pointerMesh);
pointerMesh.visible = false;

function handlePointer(clientX, clientY) {
    if (clientX > window.innerWidth - els.calc.offsetWidth && !AppState.isMobile) return;
    if (AppState.isMobile && clientY > window.innerHeight - els.calc.offsetHeight) return;

    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const target = AppState.mode === '2D' ? curve2D : mesh3D;
    const intersects = raycaster.intersectObject(target);

    if (intersects.length > 0) {
        const point = intersects[0].point;
        pointerMesh.position.copy(point);
        pointerMesh.visible = true;
        
        els.tooltip.style.display = 'block';
        els.tooltip.style.left = clientX + 'px';
        els.tooltip.style.top = clientY + 'px';
        
        if (AppState.mode === '2D') {
            els.tooltip.innerText = `x: ${point.x.toFixed(2)}, y: ${point.y.toFixed(2)}`;
        } else {
            els.tooltip.innerText = `x: ${point.x.toFixed(2)}, z: ${point.z.toFixed(2)}`;
        }
    } else {
        pointerMesh.visible = false;
        els.tooltip.style.display = 'none';
    }
}

window.addEventListener('mousemove', (e) => handlePointer(e.clientX, e.clientY));
window.addEventListener('touchmove', (e) => {
    if(e.touches.length > 0) handlePointer(e.touches[0].clientX, e.touches[0].clientY);
}, {passive: true});

// =========================================
// LOOP PRINCIPAL Y RESIZE
// =========================================
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    const isNowMobile = window.innerWidth <= 768;
    if (isNowMobile !== AppState.isMobile) {
        location.reload(); 
    }
});

// Inicialización
updateDisplay();
updateGraphics();
animate();
