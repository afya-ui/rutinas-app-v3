const { google } = require("googleapis");

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

async function getSheets() {
  const auth = await getAuth();
  return google.sheets({ version: "v4", auth });
}

async function readSheet(sheets, range) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range });
  return res.data.values || [];
}

async function readSheetSafe(sheets, range) {
  try {
    return await readSheet(sheets, range);
  } catch (err) {
    return [];
  }
}

async function updateRow(sheets, range, values) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: "RAW",
    requestBody: { values: [values] },
  });
}

async function appendRow(sheets, range, values) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
}

async function ensureSheet(sheets, title, header) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const exists = (meta.data.sheets || []).some(s => s.properties && s.properties.title === title);

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
  }

  const currentHeader = await readSheetSafe(sheets, `${title}!A1:Z1`);
  if (!currentHeader.length || !currentHeader[0].length) {
    await updateRow(sheets, `${title}!A1:${String.fromCharCode(64 + header.length)}1`, header);
  }
}

function normalize(v) {
  return String(v || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function same(a, b) {
  return normalize(a) === normalize(b);
}

function cleanList(v) {
  return normalize(v)
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
}

function mapCategoria(c) {
  c = normalize(c);
  if (c.includes("derma")) return "dermato";
  if (c.includes("suplement")) return "suplementos";
  if (c.includes("ejercicio")) return "ejercicio";
  if (c.includes("bienestar")) return "bienestar";
  if (c.includes("sueno") || c.includes("sue")) return "sueno";
  if (c.includes("wellness")) return "wellness";
  return c || "wellness";
}

function frecuenciaToTiempos(frecuencia) {
  let f = normalize(frecuencia)
    .replace("cada", "")
    .replace("horas", "h")
    .replace("hora", "h")
    .replace("hrs", "h")
    .replace(/\s/g, "");

  if (f === "8h" || f === "8") return ["manana", "tarde", "noche"];
  if (f === "12h" || f === "12") return ["manana", "noche"];
  if (f === "24h" || f === "24") return ["manana"];
  return ["manana"];
}

function horarioToTiempos(horario, frecuencia) {
  const h = cleanList(horario);
  if (h.length > 0) {
    return h.map(x => {
      if (x === "mañana" || x === "manana") return "manana";
      if (x === "tarde") return "tarde";
      if (x === "noche") return "noche";
      return x;
    }).filter(x => ["manana", "tarde", "noche"].includes(x));
  }
  return frecuenciaToTiempos(frecuencia);
}

function buildPlan(rows) {
  const plan = {};

  for (const row of rows) {
    const [nombre, categoria, frecuencia, horario, dias, inicio, duracion, nota, activo] = row;
    if (!nombre) continue;
    if (["no", "false", "0", "inactivo"].includes(normalize(activo))) continue;

    const cat = mapCategoria(categoria);
    const tiempos = horarioToTiempos(horario, frecuencia);
    const diasFinal = dias && normalize(dias) !== "todos" ? cleanList(dias) : "todos";

    if (!plan[cat]) plan[cat] = { manana: {}, tarde: {}, noche: {} };

    for (const t of tiempos) {
      plan[cat][t][nombre] = {
        days: diasFinal,
        note: nota || "",
        inicio: inicio || null,
        diasCiclo: duracion ? Number(duracion) : null,
        frecuencia: frecuencia || "",
      };
    }
  }

  return plan;
}

function rowToCheck(row) {
  const [fecha, categoria, tiempo, nombre, completado] = row;
  return { fecha, categoria, tiempo, nombre, completado: String(completado) === "true" };
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };

  try {
    const sheets = await getSheets();
    const { action, data } = JSON.parse(event.body || "{}");

    if (action === "getPlan") {
      const rows = await readSheet(sheets, "plan!A2:I");
      return { statusCode: 200, headers, body: JSON.stringify({ plan: buildPlan(rows) }) };
    }

    if (action === "getChecks") {
      const { fecha } = data || {};
      const rows = await readSheetSafe(sheets, "checks!A2:E");
      const checks = {};

      for (const row of rows) {
        const [f, categoria, tiempo, nombre, completado] = row;
        if (fecha && f !== fecha) continue;
        if (!checks[categoria]) checks[categoria] = {};
        if (!checks[categoria][tiempo]) checks[categoria][tiempo] = {};
        checks[categoria][tiempo][nombre] = String(completado) === "true";
      }

      return { statusCode: 200, headers, body: JSON.stringify({ checks }) };
    }

    if (action === "getAllChecks") {
      const rows = await readSheetSafe(sheets, "checks!A2:E");
      const checks = rows.filter(r => r[0]).map(rowToCheck);
      return { statusCode: 200, headers, body: JSON.stringify({ checks }) };
    }

    if (action === "getHistorial") {
      const { categoria, tiempo, nombre } = data || {};
      const rows = await readSheetSafe(sheets, "checks!A2:E");
      const historial = [];

      for (const row of rows) {
        const [fecha, c, t, n, completado] = row;
        if (same(c, categoria) && same(t, tiempo) && same(n, nombre)) {
          historial.push({ fecha, completado: String(completado) === "true" });
        }
      }

      historial.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
      return { statusCode: 200, headers, body: JSON.stringify({ historial }) };
    }

    if (action === "saveCheck") {
      const { fecha, categoria, tiempo, nombre, completado } = data || {};
      if (!fecha || !categoria || !tiempo || !nombre) throw new Error("Faltan datos para guardar el check");

      await ensureSheet(sheets, "checks", ["fecha", "categoria", "tiempo", "nombre", "completado"]);
      const rows = await readSheetSafe(sheets, "checks!A2:E");
      let foundIndex = -1;

      for (let i = 0; i < rows.length; i++) {
        const [f, c, t, n] = rows[i];
        if (String(f) === String(fecha) && same(c, categoria) && same(t, tiempo) && same(n, nombre)) {
          foundIndex = i;
          break;
        }
      }

      const values = [fecha, categoria, tiempo, nombre, String(!!completado)];
      if (foundIndex >= 0) {
        const sheetRow = foundIndex + 2;
        await updateRow(sheets, `checks!A${sheetRow}:E${sheetRow}`, values);
      } else {
        await appendRow(sheets, "checks!A:E", values);
      }

      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    if (action === "getEvoluciones") {
      const rows = await readSheetSafe(sheets, "evolucion!A2:H");
      const evoluciones = rows.filter(r => r[0] || r[1] || r[2]).map(r => ({
        fecha_inicio: r[0] || "",
        fecha_fin: r[1] || "",
        categoria: r[2] || "",
        foto_inicio_url: r[3] || "",
        foto_fin_url: r[4] || "",
        score: r[5] || "",
        nota: r[6] || "",
        creado: r[7] || "",
      }));
      evoluciones.sort((a, b) => String(b.fecha_fin || b.fecha_inicio).localeCompare(String(a.fecha_fin || a.fecha_inicio)));
      return { statusCode: 200, headers, body: JSON.stringify({ evoluciones }) };
    }

    if (action === "saveEvolucion") {
      const d = data || {};
      await ensureSheet(sheets, "evolucion", ["fecha_inicio", "fecha_fin", "categoria", "foto_inicio_url", "foto_fin_url", "score", "nota", "creado"]);
      await appendRow(sheets, "evolucion!A:H", [
        d.fecha_inicio || "",
        d.fecha_fin || "",
        d.categoria || "",
        d.foto_inicio_url || "",
        d.foto_fin_url || "",
        d.score || "",
        d.nota || "",
        new Date().toISOString(),
      ]);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: "Acción no válida" }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
