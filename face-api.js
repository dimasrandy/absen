<!-- Sertakan face-api.js di file HTML -->
<script src="https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js"></script>
<video id="videoElement" autoplay muted playsinline></video>
<div id="overlay"></div> <!-- Untuk memunculkan centang hijau -->

<script>
const SCRIPT_URL = 'URL_WEB_APP_ANDA';
let labeledFaceDescriptors = [];
let faceMatcher;
let cameraStream;
let standbyTimer;

// Load Model AI (Simpan folder /models di root GitHub Pages)
async function loadModels() {
  await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
  await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
  await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
  fetchMemberData();
}

// Ambil data anggota dan descriptor dari Google Sheets
async function fetchMemberData() {
  const res = await fetch(SCRIPT_URL + '?action=getDescriptors');
  const members = await res.json();
  
  labeledFaceDescriptors = members.map(m => {
    const descArray = new Float32Array(Object.values(m.descriptor));
    return new faceapi.LabeledFaceDescriptors(m.nama + '||' + m.id, [descArray]);
  });
  
  faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.5); // 50% kecocokan minimum
  startCamera();
}

async function startCamera() {
  const video = document.getElementById('videoElement');
  cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
  video.srcObject = cameraStream;
  
  // Fitur Screen Wake Lock agar layar tidak mati saat pengajian berlangsung (Poin 9)
  if ('wakeLock' in navigator) {
    try { await navigator.wakeLock.request('screen'); } catch (err) { console.log(err); }
  }

  // Timer Standby 45 Menit (2700000 ms)
  standbyTimer = setTimeout(modeStandby, 2700000);
}

// Looping deteksi wajah pada video
document.getElementById('videoElement').addEventListener('play', async () => {
  setInterval(async () => {
    if (!faceMatcher) return;
    const detections = await faceapi.detectAllFaces('videoElement').withFaceLandmarks().withFaceDescriptors();
    
    if (detections.length > 0) {
      const bestMatch = faceMatcher.findBestMatch(detections[0].descriptor);
      if (bestMatch.label !== "unknown") {
        const [nama, id] = bestMatch.label.split('||');
        prosesAbsen(id, nama);
      }
    }
  }, 1000); // scan setiap 1 detik
});

async function prosesAbsen(id, nama) {
  // Tampilkan Pop Up Centang Hijau
  document.getElementById('overlay').innerHTML = `✅ ${nama} Berhasil Absen`;
  
  // Post ke Spreadsheet
  await fetch(SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'absenWajah', id_anggota: id, nama: nama })
  });
}

function modeStandby() {
  cameraStream.getTracks().forEach(track => track.stop());
  document.getElementById('videoElement').style.opacity = '0.2';
  document.getElementById('overlay').innerHTML = 'Mode Standby. Ketuk untuk mengaktifkan.';
}

// Ketuk layar untuk bangun dari standby
document.body.addEventListener('click', () => {
  if (!cameraStream.active) {
    document.getElementById('videoElement').style.opacity = '1';
    startCamera();
  }
});

loadModels();
</script>
