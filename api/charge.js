// POST /api/charge  ->  cria uma cobrança na Nova Pay
// Variáveis de ambiente na Vercel: NOVAPAY_CI, NOVAPAY_CS
// Opcionais: ALLOWED_ORIGINS (ex.: https://meusite.com,https://outro.com) e MAX_AMOUNT (padrão 5000)

const URL_NOVAPAY = "https://api.anovapay.com.br/charges";

module.exports = async (req, res) => {
  const allowed = (process.env.ALLOWED_ORIGINS || "*").split(",").map((s) => s.trim());
  const origin = req.headers.origin || "";
  const originOk = allowed.includes("*") || allowed.includes(origin);

  if (originOk) {
    res.setHeader("Access-Control-Allow-Origin", allowed.includes("*") ? "*" : origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });
  if (!originOk) return res.status(403).json({ error: "Origem não permitida" });

  const { NOVAPAY_CI, NOVAPAY_CS } = process.env;
  if (!NOVAPAY_CI || !NOVAPAY_CS) {
    return res.status(500).json({ error: "Credenciais da Nova Pay não configuradas" });
  }

  let body = req.body || {};
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: "JSON inválido" }); }
  }

  // amount em reais (não em centavos)
  const amount = Math.round(Number(body.amount) * 100) / 100;
  const max = Number(process.env.MAX_AMOUNT || 5000);
  if (!Number.isFinite(amount) || amount <= 0 || amount > max) {
    return res.status(400).json({ error: "Valor inválido" });
  }
  const description = String(body.description || "Pedido").slice(0, 140);

  try {
    const r = await fetch(URL_NOVAPAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", ci: NOVAPAY_CI, cs: NOVAPAY_CS },
      body: JSON.stringify({ amount, description }),
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!r.ok) return res.status(r.status).json({ error: "Falha ao criar a cobrança", details: data });
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ error: "Não foi possível falar com a Nova Pay" });
  }
};
