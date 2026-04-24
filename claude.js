exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 200, headers, body: JSON.stringify({ error: "Send a POST request with { message, today }" }) };
  }

  const SYSTEM_PROMPT = `Eres un asistente que configura rutinas de bienestar personal. El usuario describirá en lenguaje natural sus rutinas de dermatología, suplementos, ejercicio y sueño.

Tu tarea es devolver SOLO un JSON válido con esta estructura exacta (sin texto extra, sin markdown, sin backticks):

{
  "dermato": {
    "manana": { "Nombre producto": { "days": "todos", "note": "dosis", "inicio": null, "diasCiclo": null } },
    "tarde": {},
    "noche": {}
  },
  "suplementos": { "manana": {}, "tarde": {}, "noche": {} },
  "ejercicio": { "manana": {}, "tarde": {}, "noche": {} },
  "sueno": { "manana": {}, "tarde": {}, "noche": {} }
}

Reglas:
- Días válidos: lunes, martes, miercoles, jueves, viernes, sabado, domingo
- Si aplica todos los días usa "todos"
- Si el usuario menciona duración en días pon diasCiclo con el número e inicio con la fecha de hoy
- Si no se menciona horario: derma va a noche, suplementos a manana, ejercicio a manana
- Devuelve SOLO el JSON puro, sin texto adicional antes o después`;

  try {
    let body = {};
    try { body = JSON.parse(event.body || "{}"); } catch(e) { body = {}; }

    const message = body.message || "";
    const today = body.today || new Date().toISOString().split("T")[0];

    if (!message) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "message is required" }) };
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 2000,
        system: SYSTEM_PROMPT + "\n\nFecha de hoy: " + today,
        messages: [{ role: "user", content: message }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Anthropic API error:", JSON.stringify(data));
      return { statusCode: 500, headers, body: JSON.stringify({ error: data.error?.message || "API error" }) };
    }

    const text = data.content.map((c) => c.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();

    try {
      const plan = JSON.parse(clean);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, plan }) };
    } catch(parseErr) {
      console.error("JSON parse error. Raw:", text);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: false, raw: text }) };
    }
  } catch (err) {
    console.error("Handler error:", err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
