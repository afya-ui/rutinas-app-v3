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
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
  });
  return res.data.values || [];
}

function normalize(v) {
  return String(v || "").toLowerCase().trim();
}

function normalizeKey(v) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function sameKey(a, b) {
  return normalizeKey(a) === normalizeKey(b);
}

function cleanList(v) {
  return normalize(v)
    .replace(/á/g, "a")
    .replace(/é/g, "e")
    .replace(/í/g, "i")
    .replace(/ó/g, "o")
    .replace(/ú/g, "u")
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
  if (c.includes("sue")) return "sueno";

  return "wellness";
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
      if (x === "mañana") return "manana";
      if (x === "manana") return "manana";
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
    const [
      nombre,
      categoria,
      frecuencia,
      horario,
      dias,
      inicio,
      duracion,
      nota,
      activo
    ] = row;

    if (!nombre) continue;
    if (["no", "false", "0", "inactivo"].includes(normalize(activo))) continue;

    const cat = mapCategoria(categoria);
    const tiempos = horarioToTiempos(horario, frecuencia);
    const diasFinal = dias && normalize(dias) !== "todos"
      ? cleanList(dias)
      : "todos";

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

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const sheets = await getSheets();
    const { action, data } = JSON.parse(event.body || "{}");

    if (action === "getPlan") {
      const rows = await readSheet(sheets, "plan!A2:I");
      const plan = buildPlan(rows);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ plan }),
      };
    }

    if (action === "getChecks") {
      const { fecha } = data || {};
      const rows = await readSheet(sheets, "checks!A2:E");
      const checks = {};

      for (const row of rows) {
        const [f, categoria, tiempo, nombre, completado] = row;
        if (fecha && f !== fecha) continue;

        if (!checks[categoria]) checks[categoria] = {};
        if (!checks[categoria][tiempo]) checks[categoria][tiempo] = {};

        checks[categoria][tiempo][nombre] = completado === "true";
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ checks }),
      };
    }

    if (action === "getUsageCounts") {
      const rows = await readSheet(sheets, "checks!A2:E");
      const usageCounts = {};

      for (const row of rows) {
        const [fecha, categoria, tiempo, nombre, completado] = row;
        if (!fecha || !categoria || !tiempo || !nombre) continue;
        if (completado !== "true") continue;

        const key = `${normalizeKey(categoria)}||${normalizeKey(tiempo)}||${normalizeKey(nombre)}`;
        usageCounts[key] = (usageCounts[key] || 0) + 1;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ usageCounts }),
      };
    }

    if (action === "getHistorial") {
      const { categoria, tiempo, nombre } = data || {};
      const rows = await readSheet(sheets, "checks!A2:E");

      const historial = [];

      for (const row of rows) {
        const [fecha, c, t, n, completado] = row;

        if (sameKey(c, categoria) && sameKey(t, tiempo) && sameKey(n, nombre)) {
          historial.push({
            fecha,
            completado: completado === "true"
          });
        }
      }

      historial.sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ historial }),
      };
    }

    if (action === "saveCheck") {
      const { fecha, categoria, tiempo, nombre, completado } = data;

      if (!fecha || !categoria || !tiempo || !nombre) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Faltan datos para guardar el check" }),
        };
      }

      const rows = await readSheet(sheets, "checks!A2:E");
      let rowNumberToUpdate = null;

      for (let i = 0; i < rows.length; i++) {
        const [f, c, t, n] = rows[i];

        if (f === fecha && sameKey(c, categoria) && sameKey(t, tiempo) && sameKey(n, nombre)) {
          rowNumberToUpdate = i + 2; // A2:E empieza en la fila 2
          break;
        }
      }

      const values = [[fecha, categoria, tiempo, nombre, String(completado)]];

      if (rowNumberToUpdate) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `checks!A${rowNumberToUpdate}:E${rowNumberToUpdate}`,
          valueInputOption: "RAW",
          requestBody: { values },
        });
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId: SHEET_ID,
          range: "checks!A:E",
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values },
        });
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true }),
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Acción no válida" }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
