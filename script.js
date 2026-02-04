const video = document.getElementById('video-feed');
const startBtn = document.getElementById('start-btn');
const countdownText = document.getElementById('countdown-text');
const flashOverlay = document.getElementById('flash-overlay');
const statusText = document.getElementById('status-text');
const resultArea = document.getElementById('result-area');
const photoPreview = document.getElementById('photo-preview');
const controlPanel = document.querySelector('.control-panel');
const downloadBtn = document.getElementById('download-btn');

const filterBtns = document.querySelectorAll('.filter-btn');
const colorBtns = document.querySelectorAll('.color-btn');
const stickerBtns = document.querySelectorAll('.sticker-btn');

// --- จุดแก้ไขสำคัญสำหรับ iPad ---
// สร้าง Canvas ในหน่วยความจำ (Memory) แทนการใช้จาก HTML
// วิธีนี้ทำให้ Safari ไม่สามารถข้ามการประมวลผลฟิลเตอร์ได้
const hiddenCanvas = document.createElement('canvas'); 
const hiddenCtx = hiddenCanvas.getContext('2d');

const stripCanvas = document.createElement('canvas');
const stripCtx = stripCanvas.getContext('2d');
// --------------------------------

// Settings
const TOTAL_SHOTS = 4;
const COUNTDOWN_SEC = 3;
const PAUSE_MS = 2000;
const FRAME_PADDING = 30;

// State
let currentFilter = 'none';
let currentFrameColor = '#ffffff';
let selectedStickers = [];

// ==========================
// 1. UI Interaction
// ==========================

filterBtns.forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelector('.filter-btn.active').classList.remove('active');
        this.classList.add('active');
        
        // ใช้ this.getAttribute เพื่อความแม่นยำ
        currentFilter = this.getAttribute('data-filter');
        // แสดงผลที่จอกล้อง
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

    // สร้างลิงก์ดาวน์โหลด (บน iPad อาจต้องใช้การแตะค้าง)
    const link = document.createElement('a');
    link.href = imgUrl;
    link.download = `photobooth_${Date.now()}.png`;
    link.target = '_blank'; // ช่วยในบาง Browser
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// ==========================
// 2. Camera & Logic
// ==========================

async function startCamera() {
    try {
        // ขอความละเอียดที่เหมาะสมสำหรับมือถือ/ไอแพด
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, 
            audio: false 
        });
        video.srcObject = stream;
        // รอให้วิดีโอพร้อมเล่นจริงๆ ก่อน
        video.onloadedmetadata = () => {
            video.play();
        };
    } catch (err) {
        console.error("Camera Error:", err);
        alert("กรุณากด 'อนุญาต' (Allow) ให้ใช้กล้อง (โปรดเปิดผ่าน HTTPS หรือ Localhost)");
    }
}

function startSession() {
    controlPanel.classList.add('disabled');
    startBtn.disabled = true;
    resultArea.style.display = 'none';
    statusText.innerText = "เริ่มถ่ายรูปกันเลย!";

    // ดึงขนาดวิดีโอจริง ณ ตอนนั้น (สำคัญมากบน iPad)
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    
    // ตั้งค่า Canvas ยาว
    stripCanvas.width = w + (FRAME_PADDING * 2);
    stripCanvas.height = (h * TOTAL_SHOTS) + (FRAME_PADDING * (TOTAL_SHOTS + 1));
    
    // เทสีพื้นหลัง
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

    // 1. ตั้งค่าขนาด Canvas เดี่ยว (การตั้งขนาดจะล้างค่าเก่า)
    hiddenCanvas.width = video.videoWidth;
    hiddenCanvas.height = video.videoHeight;
    
    // 2. ใส่ฟิลเตอร์ *หลังจาก* ตั้งขนาด Canvas แล้วเสมอ
    // (สำคัญมากสำหรับ iPad: ต้องมีค่า default ถ้าไม่เลือก)
    if (currentFilter && currentFilter !== 'none') {
        hiddenCtx.filter = currentFilter;
    } else {
        hiddenCtx.filter = 'none';
    }

    // 3. กลับด้านภาพ (Mirror)
    hiddenCtx.translate(hiddenCanvas.width, 0);
    hiddenCtx.scale(-1, 1);
    
    // 4. วาดภาพ
    hiddenCtx.drawImage(video, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
    
    // 5. Reset ค่าต่างๆ
    hiddenCtx.filter = 'none';
    hiddenCtx.setTransform(1, 0, 0, 1, 0, 0);

    // 6. แปะลง Canvas ยาว
    const x = FRAME_PADDING;
    const y = FRAME_PADDING + ((shotNum - 1) * (hiddenCanvas.height + FRAME_PADDING));
    stripCtx.drawImage(hiddenCanvas, x, y);
}

function finish() {
    statusText.innerText = "กำลังตกแต่งรูป... ✨";

    // ใช้ try-catch กันเหนียวเผื่อรูปสติกเกอร์มีปัญหา
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

    // แสดงผล
    try {
        const finalImage = stripCanvas.toDataURL('image/png');
        photoPreview.src = finalImage;
        resultArea.style.display = 'block';

        // เลื่อนจอมาดูผลลัพธ์ (บนมือถือ)
        if(window.innerWidth < 768) {
            setTimeout(() => {
                resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);
        }
    } catch (e) {
        console.error(e);
        alert("เกิดข้อผิดพลาดในการสร้างรูป (อาจเกิดจาก CORS ของสติกเกอร์)");
    }
}

window.addEventListener('load', startCamera);
startBtn.addEventListener('click', startSession);