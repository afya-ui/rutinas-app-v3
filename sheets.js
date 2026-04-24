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

async function appendRow(sheets, range, values) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
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
      const rows = await readSheet(sheets, "plan!A2:G");
      const plan = {};
      for (const row of rows) {
        const [categoria, nombre, tiempo, dias, nota, inicio, diasCiclo] = row;
        if (!categoria || !nombre) continue;
        if (!plan[categoria]) plan[categoria] = {};
        if (!plan[categoria][tiempo]) plan[categoria][tiempo] = {};
        plan[categoria][tiempo][nombre] = {
          days: dias === "todos" ? "todos" : dias.split(",").map((d) => d.trim()),
          note: nota || "",
          inicio: inicio || null,
          diasCiclo: diasCiclo ? Number(diasCiclo) : null,
        };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ plan }) };
    }

    if (action === "savePlan") {
      const { plan } = data;
      const rows = [["categoria", "nombre", "tiempo", "dias", "nota", "inicio", "diasCiclo"]];
      for (const [cat, times] of Object.entries(plan)) {
        for (const [time, items] of Object.entries(times)) {
          for (const [nombre, cfg] of Object.entries(items)) {
            const dias = Array.isArray(cfg.days) ? cfg.days.join(",") : cfg.days;
            rows.push([cat, nombre, time, dias, cfg.note || "", cfg.inicio || "", cfg.diasCiclo || ""]);
          }
        }
      }
      await clearAndWrite(sheets, "plan!A1:G", rows);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    if (action === "getChecks") {
      const { fecha } = data;
      const rows = await readSheet(sheets, "checks!A2:E");
      const checks = {};
      for (const row of rows) {
        const [f, categoria, tiempo, nombre, completado] = row;
        if (f !== fecha) continue;
        if (!checks[categoria]) checks[categoria] = {};
        if (!checks[categoria][tiempo]) checks[categoria][tiempo] = {};
        // Special keys (sleep, exercise, bienestar logs) store JSON strings
        if (nombre.startsWith("__") && completado !== "true" && completado !== "false") {
          checks[categoria][tiempo][nombre] = completado;
        } else {
          checks[categoria][tiempo][nombre] = completado === "true";
        }
      }
      return { statusCode: 200, headers, body: JSON.stringify({ checks }) };
    }

    if (action === "saveCheck") {
      const { fecha, categoria, tiempo, nombre, completado } = data;
      const rows = await readSheet(sheets, "checks!A2:E");
      const allRows = [["fecha", "categoria", "tiempo", "nombre", "completado"]];
      let found = false;
      for (const row of rows) {
        const [f, cat, t, nom] = row;
        if (f === fecha && cat === categoria && t === tiempo && nom === nombre) {
          allRows.push([fecha, categoria, tiempo, nombre, String(completado)]);
          found = true;
        } else {
          allRows.push(row);
        }
      }
      if (!found) {
        allRows.push([fecha, categoria, tiempo, nombre, String(completado)]);
      }
      await clearAndWrite(sheets, "checks!A1:E", allRows);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: "Acción no válida" }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
