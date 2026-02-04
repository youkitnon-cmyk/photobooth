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

// State (ตั้งค่าเริ่มต้น)
let currentFilter = 'none'; 
let currentFrameColor = '#ffffff';
let selectedStickers = [];

// ==========================
// 1. ส่วนจัดการปุ่มต่างๆ
// ==========================

// --- แก้ไขจุดที่ 1: การเลือก Filter ---
filterBtns.forEach(btn => {
    btn.addEventListener('click', function() { // ใช้ function() แทน () => เพื่อใช้ this ได้
        // 1. เปลี่ยนสีปุ่มให้รู้ว่าเลือกแล้ว
        document.querySelector('.filter-btn.active').classList.remove('active');
        this.classList.add('active');
        
        // 2. จำค่าฟิลเตอร์ (ใช้ this.getAttribute จะแม่นยำกว่า)
        currentFilter = this.getAttribute('data-filter');
        console.log("เลือกฟิลเตอร์เป็น:", currentFilter); // เช็คใน Console ได้เลย
        
        // 3. แสดงผลที่หน้าจอกล้องทันที
        video.style.filter = currentFilter;
    });
});

colorBtns.forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelector('.color-btn.active').classList.remove('active');
        this.classList.add('active');
        currentFrameColor = this.getAttribute('data-color');
    });
});

stickerBtns.forEach(btn => {
    btn.addEventListener('click', function() {
        this.classList.toggle('active');
        if (this.classList.contains('active')) {
            selectedStickers.push(this);
        } else {
            selectedStickers = selectedStickers.filter(item => item !== this);
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

// ==========================
// 2. ระบบกล้องและการถ่ายรูป
// ==========================

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
    
    // ตั้งค่าขนาด Canvas ยาว
    stripCanvas.width = w + (FRAME_PADDING * 2);
    stripCanvas.height = (h * TOTAL_SHOTS) + (FRAME_PADDING * (TOTAL_SHOTS + 1));
    
    // เทสีพื้นหลังกรอบ
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
            capture(shotNum); // ถ่ายรูป
            
            if (shotNum < TOTAL_SHOTS) {
                statusText.innerText = "เปลี่ยนท่าโพส! 💃";
                setTimeout(() => processShot(shotNum + 1), PAUSE_MS);
            } else {
                finish();
            }
        }
    }, 1000);
}

// --- แก้ไขจุดที่ 2: ฟังก์ชันถ่ายภาพ (Capture) ---
function capture(shotNum) {
    // เล่นแสงแฟลช
    flashOverlay.classList.add('flash-animation');
    setTimeout(() => flashOverlay.classList.remove('flash-animation'), 500);

    // 1. ตั้งค่าขนาด Canvas เดี่ยว (การตั้งขนาดจะล้างค่าเก่าทั้งหมด)
    hiddenCanvas.width = video.videoWidth;
    hiddenCanvas.height = video.videoHeight;
    
    // 2. ใส่ฟิลเตอร์ *หลังจาก* ตั้งขนาด Canvas แล้วเสมอ
    // (ถ้าใส่ก่อนตั้งขนาด ค่าจะหายไป)
    if (currentFilter && currentFilter !== 'none') {
        hiddenCtx.filter = currentFilter;
    } else {
        hiddenCtx.filter = 'none';
    }

    // 3. กลับด้านภาพ (Mirror)
    hiddenCtx.translate(hiddenCanvas.width, 0);
    hiddenCtx.scale(-1, 1);
    
    // 4. วาดภาพจากวิดีโอลงไป
    hiddenCtx.drawImage(video, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
    
    // 5. รีเซ็ตค่าต่างๆ เพื่อความปลอดภัย
    hiddenCtx.filter = 'none';
    hiddenCtx.setTransform(1, 0, 0, 1, 0, 0);

    // 6. นำรูปที่ได้ไปแปะลง Canvas ยาว (Strip)
    const x = FRAME_PADDING;
    const y = FRAME_PADDING + ((shotNum - 1) * (hiddenCanvas.height + FRAME_PADDING));
    stripCtx.drawImage(hiddenCanvas, x, y);
}

function finish() {
    statusText.innerText = "กำลังตกแต่งรูป... ✨";

    try {
        if (selectedStickers.length > 0) {
            selectedStickers.forEach(sticker => {
                if (sticker.complete && sticker.naturalWidth > 0) {
                    const size = stripCanvas.width * 0.20; 
                    const rx = Math.random() * (stripCanvas.width - size);
                    const ry = Math.random() * (stripCanvas.height - size);
                    stripCtx.drawImage(sticker, rx, ry, size, size);
                }
            });
        }
    } catch (err) {
        console.warn("Sticker Error:", err);
    }

    statusText.innerText = "เสร็จแล้วจ้า! 🎉";
    controlPanel.classList.remove('disabled');
    startBtn.disabled = false;

    try {
        const finalImage = stripCanvas.toDataURL('image/png');
        photoPreview.src = finalImage;
        resultArea.style.display = 'block';

        if(window.innerWidth < 768) {
            resultArea.scrollIntoView({ behavior: 'smooth' });
        }
    } catch (e) {
        alert("เกิดข้อผิดพลาดในการสร้างรูป");
        console.error(e);
    }
}

// เริ่มทำงาน
window.addEventListener('load', startCamera);
startBtn.addEventListener('click', startSession);
