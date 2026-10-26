// Interface strings for the office, Indonesian first, English second. The choice comes from lang.js (ID/EN switch).
const O = {
  "play": ["Main sebagai Danny (P)", "Play as Danny (P)"], "demo": ["Demo (D)", "Demo (D)"], "life": ["Hidup (L)", "Life (L)"], "night": ["Malam (N)", "Night (N)"],
  "chat": ["Buka chat asli dengan bot ini", "Open real chat with this bot"],
  "sec.go": ["Kirim ke suatu tempat", "Send somewhere"], "go": ["Pergi ke sana", "Go there"], "home": ["Kembali ke meja", "Back to desk"],
  "sec.order": ["Beri perintah ke", "Give an order to"], "ph": ["Tugas (label umum)", "Task (generic label)"], "order.send": ["Kirim", "Send"],
  "note": ["Halaman ini publik: gunakan label umum tanpa nama klien. Perintah di sini hanya demo visual dan tidak dikirim ke agen asli.", "The page is public: keep labels generic, with no client names. Orders here are a visual demo and are not sent to the real agents."],
  "upd.loading": ["Memuat status...", "Loading status..."], "upd.status": ["Status diperbarui", "Status updated"], "upd.live": ["langsung", "live"],
  "upd.chat": ["Langsung dari chat DeKa Bots", "Live from the DeKa Bots chat"], "upd.chatAll": ["Langsung dari chat DeKa Bots · semua perangkat", "Live from the DeKa Bots chat · all devices"],
  "upd.signin": ["Masuk di dekabot.app untuk melihat aktivitas chat", "Sign in at dekabot.app to see live chat activity"],
  "upd.nostatus": ["Tidak bisa membaca status.json", "Couldn't read status.json"], "upd.noroster": ["Tidak bisa membaca roster.json", "Couldn't read roster.json"],
  "grp.spots": ["Ruangan dan titik", "Rooms and spots"], "grp.desk": ["Kunjungi meja", "Visit a desk"],
  "st.working": ["Sedang mengerjakan", "Working on"], "st.waiting": ["Menunggu Danny:", "Waiting on Danny:"], "st.idle": ["Idle.", "Idle."],
  "task.chat": ["Bekerja di chat DeKa Bots", "Working in the DeKa Bots chat"], "task.wait": ["Menunggu persetujuan Anda", "Waiting for your approval"],
  "hint.nospot": ["Tidak ada tempat kosong di sana sekarang", "No free spot there right now"], "hint.noorder": ["Perintah tidak bisa disampaikan", "Can't deliver that order"],
  "hint.play": ["WASD untuk berjalan, Shift untuk lari, E untuk bicara dengan bot, seret untuk memutar kamera, P untuk berhenti", "WASD to walk, Shift to run, E to talk to a bot, drag to turn the camera, P to stop"],
  "hint.talk": ["E: bicara dengan {n}", "E: talk to {n}"],
  "hint.lifeOn": ["Bot yang santai kembali beristirahat", "Idle bots take breaks again"], "hint.lifeOff": ["Bot yang santai tetap di mejanya", "Idle bots stay at their desks"],
  "overview": ["Ringkasan", "Overview"], "tag.idle": ["idle", "idle"], "tag.queued": ["{n} antre", "{n} queued"],
  "log.done": ["✅ {n} selesai", "✅ {n} finished"], "log.demo": ["🎬 Demo: Chief of Staff memulai pekerjaan tim", "🎬 Demo: Chief of Staff starts a team job"],
  "log.sync": ["🤝 Semua berkumpul untuk sinkronisasi", "🤝 Everyone meets to sync"],
  "say.ok": ["👍 siap!", "👍 on it!"], "say.done": ["✅ selesai!", "✅ done!"], "say.new": ["📋 tugas baru", "📋 new task"], "say.hey": ["💬 hai {n}!", "💬 hey {n}!"],
  "act.coffee": ["istirahat kopi", "coffee break"], "act.snack": ["waktunya ngemil", "snack time"], "act.vending": ["ambil minuman", "grabbing a drink"],
  "act.arcade": ["main arcade", "playing arcade"], "act.table": ["main foosball!", "foosball!"], "act.couch": ["main konsol", "console time"],
  "act.nap": ["tidur sebentar", "power nap"], "act.sit": ["bersantai", "chilling"], "act.focus": ["fokus belajar", "deep focus"],
  "act.cinema": ["nonton film", "watching a movie"], "act.boba": ["istirahat boba", "boba break"], "act.chat": ["ngobrol dengan {n}", "chatting with {n}"],
  "place.meeting": ["Ruang meeting (tim)", "Meeting room (team)"], "place.tele": ["Ruang teleconference", "Teleconference room"], "place.arcade": ["Game room: arcade", "Game room: arcade"],
  "place.table": ["Game room: foosball", "Game room: foosball"], "place.couch": ["Game room: sofa konsol", "Game room: console sofa"], "place.coffee": ["Pantry: mesin kopi", "Pantry: coffee machine"],
  "place.snack": ["Pantry: snack bar", "Pantry: snack bar"], "place.vending": ["Pantry: vending machine", "Pantry: vending machine"], "place.nap": ["Ruang istirahat: nap pod", "Rest room: nap pod"],
  "place.sit": ["Ruang istirahat: sofa", "Rest room: sofa"], "place.focus": ["Perpustakaan fokus", "Focus library"], "place.cinema": ["Chill lounge: sofa film", "Chill lounge: movie sofa"],
  "place.boba": ["Chill lounge: boba bar", "Chill lounge: boba bar"], "place.server": ["Server lab (meja)", "Server lab (desk)"], "place.server-racks": ["Server lab (rack)", "Server lab (racks)"],
  "place.whiteboard": ["Papan tulis (ruang meeting)", "Whiteboard (meeting room)"], "place.reception": ["Resepsionis", "Reception"], "place.corridor": ["Koridor", "Corridor"],
  "room.Game Room": ["Ruang Game", "Game Room"], "room.Meeting Room": ["Ruang Meeting", "Meeting Room"], "room.Teleconference": ["Teleconference", "Teleconference"],
  "room.Server Lab": ["Server Lab", "Server Lab"], "room.Pantry": ["Pantry", "Pantry"], "room.Rest Room": ["Ruang Istirahat", "Rest Room"],
  "room.Focus Library": ["Perpustakaan Fokus", "Focus Library"], "room.Chill Lounge": ["Chill Lounge", "Chill Lounge"], "room.Open Workspace": ["Ruang Kerja Terbuka", "Open Workspace"],
  "room.Reception": ["Resepsionis", "Reception"]
};
export const lang = () => (window.DekaLang ? window.DekaLang.get() : "id");
export function tr(key, n) {
  const e = O[key]; if (!e) return n === undefined ? key : String(n);
  const t = e[lang() === "en" ? 1 : 0]; return n === undefined ? t : t.replace("{n}", n);
}
export const has = key => !!O[key];
export function onLang(cb) { if (window.DekaLang) window.DekaLang.on(cb); else cb(); }
