# DeKa Office

Kantor virtual 3D untuk agen AI Anda. Setiap agen punya meja dan satu bot kecil. Bot-bot itu berjalan melewati pintu, mengambil kopi, bermain arcade, dan berkumpul di ruang meeting saat tim bekerja bersama.

![DeKa Office](https://dekabot.app/img/office.jpg)

**[Demo langsung](https://dekabot.app/office/)** · [English](README.md)

Ini halaman web statis biasa (HTML + JavaScript + [Three.js](https://threejs.org)). Tidak ada proses build dan tidak ada database. Siapa mengerjakan apa dibaca dari satu file kecil, `status.json`.

## Dua tampilan

| File | Isinya |
|---|---|
| `game.html` | **Tampilan game.** Denah kantor startup dengan 8 ruangan (meeting, teleconference, game, server, pantry, istirahat, perpustakaan fokus, chill lounge), ruang kerja terbuka, dan resepsionis. Bot mencari jalan sendiri, istirahat, saling memberi perintah, dan berkumpul di ruang meeting. Antarmuka berbahasa Indonesia atau Inggris. |
| `index.html` | **Tampilan klasik.** Satu kantor terbuka dengan satu meja per bot, mode jalan orang pertama, dan tema berwarna. |

## Mulai cepat

Yang Anda butuhkan: Git, Python 3.8 atau lebih baru, dan browser modern. Three.js dimuat dari CDN, jadi Anda juga perlu koneksi internet.

```bash
git clone https://github.com/dannykosasih/deka-office.git
cd deka-office
python realtime-server.py
```

Lalu buka:

- http://127.0.0.1:8080/game.html untuk tampilan game
- http://127.0.0.1:8080/ untuk tampilan klasik

`realtime-server.py` menyajikan folder ini dan langsung mendorong `status.json` ke halaman begitu file berubah. Server hanya bisa dijangkau dari komputer Anda sendiri.

Ingin yang lebih sederhana? `python -m http.server 8080` juga bisa; halaman lalu membaca ulang `status.json` tiap 5 detik, bukan menerima dorongan langsung. Jangan membuka file dengan klik ganda (`file://`): browser memblokir skrip dan file datanya.

## Cara kerjanya

```
agen Anda ──► status.json ──► realtime-server.py ──► halaman (bot bergerak)
                  ▲
            roster.json = siapa saja bot-nya
```

- `roster.json` menjelaskan bot-nya: siapa, masuk zona mana, dan memakai gambar apa.
- `status.json` berisi apa yang sedang dikerjakan tiap bot: `working`, `waiting` (butuh keputusan manusia), atau `idle`, plus label tugas singkat.
- Halaman menggambar satu bot untuk setiap entri di `roster.json` dan menganimasikannya dari `status.json`.

## Sesuaikan dengan kebutuhan Anda

### 1. Tulis bot Anda di `roster.json`

Setiap entri di `bots` seperti ini:

```json
{ "id": "research", "name": "Research", "zone": "Research & Data",
  "role": "Mencari dan menyusun informasi dari web.",
  "agent": "my-research", "voxel": "research", "workplace": "whiteboard" }
```

| Kolom | Artinya |
|---|---|
| `id` | Id singkat yang unik. Id yang sama dipakai di `status.json`. |
| `name`, `role` | Tampil di name tag dan di panel samping. |
| `zone` | Nama kelompok. Harus sama dengan salah satu zona di daftar `zones` (nama, warna, posisi), yang memberi bot warnanya. |
| `agent` | Opsional. Nama agen yang diwakili bot ini (dipakai tombol "buka chat"). Isi `null` kalau tidak ada. |
| `voxel` / `portrait` | Opsional, gambar bot (lihat di bawah). Tanpa gambar, bot memakai robot bawaan berwarna zona. |
| `workplace` | Opsional. Tempat bot berjalan saat bekerja sendirian (tampilan game), misalnya `whiteboard` atau `server-racks`. |

Di tampilan game, meja diatur sesuai urutan bot di file.

### 2. Pakai gambar Anda sendiri

Taruh sprite PNG transparan di `portraits/voxels/` (kira-kira rasio 2:3, seluruh badan, menghadap penonton), lalu isi kolom `voxel` dengan nama file tanpa `.png`. Sprite yang ada di sini adalah karakter milik penulis. Ganti dengan karya Anda sebelum Anda mempublikasikan apa pun.

### 3. Ubah status bot

Dari terminal (butuh `bash` dan `python3`; di Windows pakai Git Bash atau WSL):

```bash
./set-status.sh research working "Mencari sumber"
./set-status.sh research waiting "Butuh keputusan"
./set-status.sh research idle "Siap"
```

Atau ubah `status.json` langsung. Formatnya:

```json
{ "updated": "2026-01-01T09:00:00+07:00",
  "bots": { "research": { "state": "working", "task": "Mencari sumber" } } }
```

Untuk mengirim bot ke suatu tempat, tambahkan tempat sebagai argumen keempat atau kolom `"goto"` di `status.json`:

```bash
./set-status.sh research working "Sinkron tim" meeting     # jalan ke ruang meeting
./set-status.sh research idle "Kembali" desk                # jalan kembali ke meja
```

Tempat yang tersedia antara lain `meeting`, `tele`, `arcade`, `coffee`, `snack`, `nap`, `focus`, `cinema`, `boba`, `server`, `whiteboard`, `reception`, dan `desk:<id bot lain>` untuk mengunjungi bot lain.

### 4. Ubah ruangannya

Denah, dinding, dan furnitur adalah kode di `game/world.js` (satu fungsi per ruangan). Kalau Anda memakai asisten coding AI, cukup jelaskan perubahannya, misalnya "perbesar ruang meeting dan tambah tanaman", lalu biarkan ia mengubah file itu.

## Tampilkan aktivitas agen sungguhan dengan Claude Code

Claude Code bisa menjalankan perintah setiap kali sub-agen mulai atau berhenti. Hook kecil mengubahnya menjadi status bot.

`.claude/hooks/office_status.py`:

```python
import datetime, json, pathlib, sys

PREFIX = "deka-"                                   # agen diberi nama deka-<id bot>, misalnya deka-research
state = sys.argv[1]                                # "working" atau "idle"
agent = json.load(sys.stdin).get("agent_type", "")
if not agent.startswith(PREFIX):
    sys.exit(0)
bot = agent[len(PREFIX):]
path = pathlib.Path(__file__).resolve().parents[2] / "status.json"   # status.json di sebelah index.html
data = json.loads(path.read_text(encoding="utf-8"))
if bot in data["bots"]:
    data["bots"][bot] = {"state": state, "task": "Working on a request" if state == "working" else "Ready"}
    data["updated"] = datetime.datetime.now().astimezone().isoformat(timespec="seconds")
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
```

`.claude/settings.json`:

```json
{
  "hooks": {
    "SubagentStart": [{ "matcher": "deka-.*", "hooks": [{ "type": "command", "command": "python \"$CLAUDE_PROJECT_DIR/.claude/hooks/office_status.py\" working" }] }],
    "SubagentStop":  [{ "matcher": "deka-.*", "hooks": [{ "type": "command", "command": "python \"$CLAUDE_PROJECT_DIR/.claude/hooks/office_status.py\" idle" }] }]
  }
}
```

Jalankan Claude Code dari folder yang berisi `.claude/`, biarkan `python realtime-server.py` tetap berjalan, dan bot mulai bekerja begitu agennya bekerja. Labelnya sengaja dibuat umum; jangan pernah menyalin isi permintaan asli ke halaman publik.

## Kontrol (tampilan game)

| Aksi | Caranya |
|---|---|
| Melihat sekeliling | Seret untuk memutar, gulir untuk zoom. Tombol ruangan di atas menerbangkan kamera ke sana. |
| Membuka bot | Klik bot itu. Panelnya bisa mengirim bot ke suatu tempat, menyuruhnya mengunjungi bot lain, atau memberinya perintah (visual). |
| Main sebagai karakter | `P` (mengendalikan bot dengan id `danny`; ganti namanya di `game/main.js` kalau milik Anda berbeda). Jalan dengan `WASD`, lari dengan `Shift`, bicara dengan bot terdekat dengan `E`. |
| Demo pekerjaan tim | `D` |
| Bot santai beristirahat, hidup atau mati | `L` |
| Mode malam | `N` |
| Bahasa | tombol **ID / EN** |

Tampilan klasik: `F` mode jalan orang pertama, `T` tema, `N` malam.

## Terbitkan (GitHub Pages)

Workflow di `.github/workflows/pages.yml` men-deploy seluruh folder. Di repositori Anda buka **Settings → Pages → Build and deployment → Source: GitHub Actions**, lalu push ke `main`.

GitHub Pages itu statis, jadi tidak ada dorongan langsung di sana. Halaman membaca ulang `status.json` tiap 5 detik dari yang Anda commit. `sync-status.sh` adalah pembantu opsional yang meng-commit dan mem-push `status.json` kira-kira tiap menit kalau file berubah; ia menghasilkan banyak commit kecil, jadi pakai hanya kalau cocok untuk Anda.

Halamannya publik. Jaga label tugas tetap umum: tanpa nama klien dan tanpa data pribadi.

## Sebelum Anda mempublikasikan fork

Repositori ini masih memuat beberapa hal milik penulis aslinya:

- `404.html`, dan skrip pengalihan tiga baris di bagian atas `index.html` dan `game.html`, mengirim pengunjung satu domain tertentu ke tempat lain. Hapus semuanya.
- Tombol "buka chat asli" dan jembatan chat di `game/main.js` menunjuk ke aplikasi chat milik penulis (`dekabot.app`). Hapus atau ubah.
- `roster.json`, `status.json`, dan sprite menggambarkan bot milik penulis.

## Isi folder

```
game.html, game/         tampilan game (world.js ruangan, bots.js, life.js perilaku, nav.js pencari jalan, i18n.js)
index.html               tampilan klasik
roster.json              bot, zona, dan tempat
status.json              apa yang sedang dikerjakan bot
realtime-server.py       server lokal yang mendorong status.json ke halaman
set-status.sh            pembantu untuk mengubah status satu bot
sync-status.sh           opsional: push status.json ke GitHub kira-kira tiap menit
lang.js                  tombol bahasa ID / EN
portraits/, voxels/      gambar
.github/workflows/       deploy GitHub Pages
```

## Kredit dan lisensi

Dibuat dengan [Three.js](https://threejs.org) (MIT) dan Claude Code. Repositori ini belum punya file lisensi, jadi mohon tanya penulisnya sebelum memakai gambar atau kodenya dalam sebuah produk.
