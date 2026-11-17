// Vercel Serverless Function: POST /api/parse
// Env vars: ANTHROPIC_API_KEY (wajib), APP_SECRET (opsional), CLAUDE_MODEL (opsional)
const OUT = ['Makan & Minum', 'Jajan Makanan', 'Jajan Minuman', 'Transportasi', 'Belanja', 'Tagihan', 'Kesehatan', 'Hiburan', 'Pendidikan', 'Lainnya'];
const IN = ['Gaji', 'Usaha', 'Pemasukan lain'];

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST' });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: 'ANTHROPIC_API_KEY belum diatur' });

  const need = process.env.APP_SECRET;
  if (need && req.headers['x-app-secret'] !== need) return res.status(401).json({ error: 'Kode akses salah' });

  const { text, today, cats } = req.body || {};
  if (typeof text !== 'string' || !text.trim() || text.length > 200) {
    return res.status(400).json({ error: 'Teks tidak valid' });
  }
  const day = /^\d{4}-\d\d-\d\d$/.test(today) ? today : new Date().toISOString().slice(0, 10);

  const ok = a => (Array.isArray(a) ? a.filter(x => typeof x === 'string' && x.length <= 40).slice(0, 30) : []);
  const O = ok(cats && cats.out).length ? ok(cats.out) : OUT;
  const I = ok(cats && cats.in).length ? ok(cats.in) : IN;
  const system = `Kamu parser transaksi keuangan pribadi berbahasa Indonesia.
Balas HANYA dengan satu objek JSON tanpa teks lain: {"amount":<integer rupiah>,"type":"in"|"out","category":"<kategori>","note":"<catatan singkat>","date":"YYYY-MM-DD"}
Kategori pengeluaran (type out): ${O.join(', ')}.
Kategori pemasukan (type in): ${I.join(', ')}.
Makan & Minum = makan berat/rutin (nasi, lauk, makan siang). Jajan Makanan = camilan/jajanan. Jajan Minuman = kopi, boba, teh, minuman kemasan.
"rb"/"ribu"/"k" = 1.000, "jt"/"juta" = 1.000.000. "20.000" = 20000.
Hari ini ${day}. "kemarin" = sehari sebelumnya. Tanpa keterangan waktu, pakai hari ini.
Jika nominal tidak ada, isi amount 0.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || 'claude-haiku-5-5',
        max_tokens: 200,
        system,
        messages: [{ role: 'user', content: text.trim() }]
      })
    });
    if (!r.ok) return res.status(502).json({ error: 'Anthropic API error ' + r.status });
    const d = await r.json();
    const raw = (d.content || []).map(b => b.text || '').join('');
    const j = JSON.parse(raw.replace(/```json|```/g, '').trim());
    return res.status(200).json(j);
  } catch (e) {
    return res.status(502).json({ error: 'Gagal membaca transaksi' });
  }
};
