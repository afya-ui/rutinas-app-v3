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

async function clearAndWrite(sheets, range, values) {
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range,
  });

  if (values.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range,
      valueInputOption: "RAW",
      requestBody: { values },
    });
  }
}

function normalize(v) {
  return String(v || "").toLowerCase().trim();
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

function frecuenciaToTiempos(f) {
  f = normalize(f)
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

function buildPlan(rows) {
  const plan = {};

  for (const row of rows) {
    const [nombre, categoria, frecuencia, inicio, duracion, nota, activo] = row;

    if (!nombre) continue;
    if (normalize(activo) === "no") continue;

    const cat = mapCategoria(categoria);
    const tiempos = frecuenciaToTiempos(frecuencia);

    if (!plan[cat]) plan[cat] = { manana: {}, tarde: {}, noche: {} };

    for (const t of tiempos) {
      plan[cat][t][nombre] = {
        days: "todos",
        note: nota || "",
        inicio: inicio || null,
        diasCiclo: duracion ? Number(duracion) : null
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

  try {
    const sheets = await getSheets();
    const { action, data } = JSON.parse(event.body || "{}");

    if (action === "getPlan") {
      const rows = await readSheet(sheets, "plan!A2:G");
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

    if (action === "saveCheck") {
      const { fecha, categoria, tiempo, nombre, completado } = data;

      const rows = await readSheet(sheets, "checks!A2:E");
      const newRows = [["fecha","categoria","tiempo","nombre","completado"]];
      let found = false;

      for (const r of rows) {
        const [f, c, t, n] = r;

        if (f === fecha && c === categoria && t === tiempo && n === nombre) {
          newRows.push([fecha, categoria, tiempo, nombre, String(completado)]);
          found = true;
        } else {
          newRows.push(r);
        }
      }

      if (!found) {
        newRows.push([fecha, categoria, tiempo, nombre, String(completado)]);
      }

      await clearAndWrite(sheets, "checks!A1:E", newRows);

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
