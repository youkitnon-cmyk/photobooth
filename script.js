const video = document.getElementById('video-feed');
const startBtn = document.getElementById('start-btn');
const countdownText = document.getElementById('countdown-text');
const flashOverlay = document.getElementById('flash-overlay');
const statusText = document.getElementById('status-text');
const resultArea = document.getElementById('result-area');
const photoPreview = document.getElementById('photo-preview');
const controlPanel = document.querySelector('.control-panel');
const downloadBtn = document.getElementById('download-btn');

// Selector Groups
const filterBtns = document.querySelectorAll('.filter-btn');
const colorBtns = document.querySelectorAll('.color-btn');
const stickerBtns = document.querySelectorAll('.sticker-btn');

// Canvas
const hiddenCanvas = document.getElementById('canvas-hidden');
const hiddenCtx = hiddenCanvas.getContext('2d');
const stripCanvas = document.createElement('canvas');
const stripCtx = stripCanvas.getContext('2d');

// Settings
const TOTAL_SHOTS = 4;
const COUNTDOWN_SEC = 3;
const PAUSE_MS = 2000;
const FRAME_PADDING = 30;

// State
let currentFilter = 'none';
let currentFrameColor = '#ffffff';
let selectedStickers = [];

// --- 1. UI Interaction ---

filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelector('.filter-btn.active').classList.remove('active');
        e.target.classList.add('active');
        currentFilter = e.target.getAttribute('data-filter');
        video.style.filter = currentFilter;
    });
});

colorBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelector('.color-btn.active').classList.remove('active');
        e.target.classList.add('active');
        currentFrameColor = e.target.getAttribute('data-color');
    });
});

stickerBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.target.classList.toggle('active');
        if (e.target.classList.contains('active')) {
            selectedStickers.push(e.target);
        } else {
            selectedStickers = selectedStickers.filter(item => item !== e.target);
        }
    });
});

downloadBtn.addEventListener('click', () => {
    const imgUrl = photoPreview.src;
    if (!imgUrl) return alert("ไม่พบรูปภาพ");

    const link = document.createElement('a');
    link.href = imgUrl;
    link.download = `photobooth_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// --- 2. Camera & Logic ---

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, 
            audio: false 
        });
        video.srcObject = stream;
    } catch (err) {
        console.error("Camera Error:", err);
        alert("กรุณากด 'อนุญาต' (Allow) ให้ใช้กล้อง");
    }
}

function startSession() {
    controlPanel.classList.add('disabled');
    startBtn.disabled = true;
    resultArea.style.display = 'none';
    statusText.innerText = "เริ่มถ่ายรูปกันเลย!";

    const w = video.videoWidth;
    const h = video.videoHeight;
    
    stripCanvas.width = w + (FRAME_PADDING * 2);
    stripCanvas.height = (h * TOTAL_SHOTS) + (FRAME_PADDING * (TOTAL_SHOTS + 1));
    
    stripCtx.fillStyle = currentFrameColor;
    stripCtx.fillRect(0, 0, stripCanvas.width, stripCanvas.height);

    processShot(1);
}

function processShot(shotNum) {
    statusText.innerText = `รูปที่ ${shotNum} / ${TOTAL_SHOTS}`;
    let count = COUNTDOWN_SEC;
    countdownText.style.display = 'block';
    countdownText.innerText = count;

    const timer = setInterval(() => {
        count--;
        if (count > 0) {
            countdownText.innerText = count;
        } else {
            clearInterval(timer);
            countdownText.style.display = 'none';
            capture(shotNum);
            
            if (shotNum < TOTAL_SHOTS) {
                statusText.innerText = "เปลี่ยนท่าโพส! 💃";
                setTimeout(() => processShot(shotNum + 1), PAUSE_MS);
            } else {
                finish();
            }
        }
    }, 1000);
}

function capture(shotNum) {
    flashOverlay.classList.add('flash-animation');
    setTimeout(() => flashOverlay.classList.remove('flash-animation'), 500);

    hiddenCanvas.width = video.videoWidth;
    hiddenCanvas.height = video.videoHeight;
    
    hiddenCtx.filter = currentFilter;
    hiddenCtx.translate(hiddenCanvas.width, 0);
    hiddenCtx.scale(-1, 1);
    hiddenCtx.drawImage(video, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
    
    hiddenCtx.filter = 'none';
    hiddenCtx.setTransform(1, 0, 0, 1, 0, 0);

    const x = FRAME_PADDING;
    const y = FRAME_PADDING + ((shotNum - 1) * (hiddenCanvas.height + FRAME_PADDING));
    stripCtx.drawImage(hiddenCanvas, x, y);
}

function finish() {
    statusText.innerText = "กำลังตกแต่งรูป... ✨";

    // --- ส่วนสำคัญ: ใส่ Try-Catch เพื่อกัน Error จากสติกเกอร์ ---
    try {
        if (selectedStickers.length > 0) {
            selectedStickers.forEach(sticker => {
                // เช็คว่ารูปโหลดสมบูรณ์หรือไม่
                if (sticker.complete && sticker.naturalWidth > 0) {
                    const size = stripCanvas.width * 0.20; // ขนาดสติกเกอร์ 20% ของเฟรม
                    const rx = Math.random() * (stripCanvas.width - size);
                    const ry = Math.random() * (stripCanvas.height - size);
                    stripCtx.drawImage(sticker, rx, ry, size, size);
                }
            });
        }
    } catch (err) {
        console.warn("Sticker Error (ข้ามการแปะสติกเกอร์):", err);
    }
    // -----------------------------------------------------

    statusText.innerText = "เสร็จแล้วจ้า! 🎉";
    controlPanel.classList.remove('disabled');
    startBtn.disabled = false;

    // แสดงผล
    try {
        const finalImage = stripCanvas.toDataURL('image/png');
        photoPreview.src = finalImage;
        resultArea.style.display = 'block';

        if(window.innerWidth < 768) {
            resultArea.scrollIntoView({ behavior: 'smooth' });
        }
    } catch (e) {
        alert("เกิดข้อผิดพลาดในการสร้างรูป (อาจเกิดจากรูปสติกเกอร์)");
        console.error(e);
    }
}

window.addEventListener('load', startCamera);
startBtn.addEventListener('click', startSession);