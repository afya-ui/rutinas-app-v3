const { google } = require("googleapis");

const PLAN = {
  dermato: {
    manana: {
      "Gel Kelual DS": { days: "todos", note: "Elegir según tolerancia" },
      "Nutradeica crema facial ISDIN": { days: "todos", note: "Aplicar después de lavar la cara" },
      "Mometasona .1% ungüento": { days: "lunes,jueves", note: "Solo lunes y jueves mañana", inicio: "2026-04-20", diasCiclo: 21 },
      "Omeprazol": { days: "todos", note: "En ayunas", inicio: "2026-04-11", diasCiclo: 20 },
      "Trameel S comprimidos": { days: "todos", note: "Sublingual", inicio: "2026-04-11", diasCiclo: 90 },
      "Doxiciclina 100 mg": { days: "todos", note: "Después del desayuno", inicio: "2026-04-11", diasCiclo: 20 },
    },
    tarde: {
      "Trameel S comprimidos": { days: "todos", note: "Sublingual cada 8 hrs", inicio: "2026-04-11", diasCiclo: 90 },
    },
    noche: {
      "Gel Kelual DS": { days: "todos", note: "Elegir según tolerancia" },
      "Nutradeica crema facial ISDIN": { days: "todos", note: "Aplicar después de lavar la cara" },
      "Avene Tolerance Control": { days: "todos", note: "Aplicar en toda la cara" },
      "Mometasona .1% ungüento": { days: "lunes,jueves", note: "Solo lunes y jueves noche", inicio: "2026-04-20", diasCiclo: 21 },
      "Trameel S comprimidos": { days: "todos", note: "Sublingual cada 8 hrs", inicio: "2026-04-11", diasCiclo: 90 },
      "Microbio Fit tabletas masticables": { days: "todos", note: "Masticable · inicia al terminar Doxiciclina", inicio: "2026-05-01", diasCiclo: 90 },
    },
  },
  suplementos: {
    manana: {
      "Metilfolato 400 mcg": { days: "todos", note: "2 tabletas · pendiente de llegada", inicio: "2026-04-17", diasCiclo: 30 },
      "Coenzima Q10 400mg": { days: "todos", note: "cada 12 hrs", inicio: "2026-04-17", diasCiclo: 30 },
      "Vitamina C 1 g": { days: "todos", note: "cada 24 hrs", inicio: "2026-04-17", diasCiclo: 30 },
      "Vitamina E 400 UI": { days: "todos", note: "cada 24 hrs", inicio: "2026-04-17", diasCiclo: 30 },
      "Zinc tableta 50 mg": { days: "todos", note: "cada 12 hrs · pendiente de llegada", inicio: "2026-04-17", diasCiclo: 30 },
    },
    tarde: {},
    noche: {
      "Coenzima Q10 400mg": { days: "todos", note: "cada 12 hrs", inicio: "2026-04-17", diasCiclo: 30 },
      "Zinc tableta 50 mg": { days: "todos", note: "cada 12 hrs · pendiente de llegada", inicio: "2026-04-17", diasCiclo: 30 },
    },
  },
  ejercicio: {
    manana: {
      "Upper body": { days: "lunes,jueves", note: "Fuerza tren superior" },
      "Lower body": { days: "martes,viernes", note: "Fuerza tren inferior" },
      "Full body": { days: "miercoles,sabado", note: "Sesión completa" },
      "Descanso": { days: "domingo", note: "Recuperación activa" },
    },
    tarde: {}, noche: {},
  },
  sueno: { manana: {}, tarde: {}, noche: {} },
};

const CHECKS = [
["2026-04-11","dermato","manana","Gel Kelual DS","true"],
["2026-04-11","dermato","manana","Nutradeica crema facial ISDIN","true"],
["2026-04-11","dermato","noche","Avene Tolerance Control","false"],
["2026-04-11","dermato","manana","Doxiciclina 100 mg","true"],
["2026-04-11","dermato","tarde","Ketoconozol 200 mg","true"],
["2026-04-11","dermato","manana","Mometasona .1% ungüento","true"],
["2026-04-11","dermato","manana","Trameel S comprimidos","true"],
["2026-04-11","dermato","tarde","Trameel S comprimidos","false"],
["2026-04-11","dermato","noche","Trameel S comprimidos","true"],
["2026-04-11","dermato","noche","Gel Kelual DS","true"],
["2026-04-11","dermato","noche","Nutradeica crema facial ISDIN","true"],
["2026-04-11","dermato","noche","Mometasona .1% ungüento","true"],
["2026-04-11","dermato","manana","Omeprazol","true"],
["2026-04-12","dermato","manana","Gel Kelual DS","true"],
["2026-04-12","dermato","manana","Nutradeica crema facial ISDIN","true"],
["2026-04-12","dermato","noche","Avene Tolerance Control","true"],
["2026-04-12","dermato","manana","Doxiciclina 100 mg","true"],
["2026-04-12","dermato","tarde","Ketoconozol 200 mg","true"],
["2026-04-12","dermato","manana","Mometasona .1% ungüento","true"],
["2026-04-12","dermato","manana","Trameel S comprimidos","true"],
["2026-04-12","dermato","tarde","Trameel S comprimidos","false"],
["2026-04-12","dermato","noche","Trameel S comprimidos","true"],
["2026-04-12","dermato","noche","Gel Kelual DS","true"],
["2026-04-12","dermato","noche","Nutradeica crema facial ISDIN","true"],
["2026-04-12","dermato","noche","Mometasona .1% ungüento","true"],
["2026-04-12","dermato","manana","Omeprazol","true"],
["2026-04-13","dermato","manana","Gel Kelual DS","true"],
["2026-04-13","dermato","manana","Nutradeica crema facial ISDIN","true"],
["2026-04-13","dermato","noche","Avene Tolerance Control","true"],
["2026-04-13","dermato","manana","Doxiciclina 100 mg","true"],
["2026-04-13","dermato","tarde","Ketoconozol 200 mg","true"],
["2026-04-13","dermato","manana","Mometasona .1% ungüento","true"],
["2026-04-13","dermato","manana","Trameel S comprimidos","true"],
["2026-04-13","dermato","tarde","Trameel S comprimidos","true"],
["2026-04-13","dermato","noche","Trameel S comprimidos","true"],
["2026-04-13","dermato","noche","Gel Kelual DS","true"],
["2026-04-13","dermato","noche","Nutradeica crema facial ISDIN","true"],
["2026-04-13","dermato","noche","Mometasona .1% ungüento","true"],
["2026-04-13","dermato","manana","Omeprazol","true"],
["2026-04-14","dermato","manana","Gel Kelual DS","true"],
["2026-04-14","dermato","manana","Nutradeica crema facial ISDIN","true"],
["2026-04-14","dermato","noche","Avene Tolerance Control","true"],
["2026-04-14","dermato","manana","Doxiciclina 100 mg","true"],
["2026-04-14","dermato","tarde","Ketoconozol 200 mg","false"],
["2026-04-14","dermato","manana","Mometasona .1% ungüento","true"],
["2026-04-14","dermato","manana","Trameel S comprimidos","true"],
["2026-04-14","dermato","tarde","Trameel S comprimidos","false"],
["2026-04-14","dermato","noche","Trameel S comprimidos","true"],
["2026-04-14","dermato","noche","Gel Kelual DS","true"],
["2026-04-14","dermato","noche","Nutradeica crema facial ISDIN","true"],
["2026-04-14","dermato","noche","Mometasona .1% ungüento","true"],
["2026-04-14","dermato","manana","Omeprazol","true"],
["2026-04-15","dermato","manana","Gel Kelual DS","true"],
["2026-04-15","dermato","manana","Nutradeica crema facial ISDIN","true"],
["2026-04-15","dermato","noche","Avene Tolerance Control","true"],
["2026-04-15","dermato","manana","Doxiciclina 100 mg","true"],
["2026-04-15","dermato","manana","Mometasona .1% ungüento","true"],
["2026-04-15","dermato","manana","Trameel S comprimidos","true"],
["2026-04-15","dermato","tarde","Trameel S comprimidos","true"],
["2026-04-15","dermato","noche","Trameel S comprimidos","true"],
["2026-04-15","dermato","noche","Gel Kelual DS","true"],
["2026-04-15","dermato","noche","Nutradeica crema facial ISDIN","true"],
["2026-04-15","dermato","noche","Mometasona .1% ungüento","true"],
["2026-04-15","dermato","manana","Omeprazol","true"],
["2026-04-16","dermato","manana","Gel Kelual DS","true"],
["2026-04-16","dermato","manana","Nutradeica crema facial ISDIN","true"],
["2026-04-16","dermato","noche","Avene Tolerance Control","true"],
["2026-04-16","dermato","manana","Doxiciclina 100 mg","true"],
["2026-04-16","dermato","manana","Mometasona .1% ungüento","true"],
["2026-04-16","dermato","manana","Trameel S comprimidos","true"],
["2026-04-16","dermato","tarde","Trameel S comprimidos","true"],
["2026-04-16","dermato","noche","Trameel S comprimidos","true"],
["2026-04-16","dermato","noche","Gel Kelual DS","true"],
["2026-04-16","dermato","noche","Nutradeica crema facial ISDIN","true"],
["2026-04-16","dermato","noche","Mometasona .1% ungüento","true"],
["2026-04-16","dermato","manana","Omeprazol","true"],
["2026-04-17","dermato","manana","Gel Kelual DS","true"],
["2026-04-17","dermato","manana","Nutradeica crema facial ISDIN","true"],
["2026-04-17","dermato","noche","Avene Tolerance Control","true"],
["2026-04-17","dermato","manana","Doxiciclina 100 mg","true"],
["2026-04-17","dermato","manana","Trameel S comprimidos","true"],
["2026-04-17","dermato","tarde","Trameel S comprimidos","true"],
["2026-04-17","dermato","noche","Trameel S comprimidos","true"],
["2026-04-17","dermato","noche","Gel Kelual DS","true"],
["2026-04-17","dermato","noche","Nutradeica crema facial ISDIN","true"],
["2026-04-17","dermato","manana","Omeprazol","true"],
["2026-04-18","dermato","manana","Gel Kelual DS","true"],
["2026-04-18","dermato","manana","Nutradeica crema facial ISDIN","true"],
["2026-04-18","dermato","noche","Avene Tolerance Control","true"],
["2026-04-18","dermato","manana","Doxiciclina 100 mg","true"],
["2026-04-18","dermato","manana","Trameel S comprimidos","true"],
["2026-04-18","dermato","tarde","Trameel S comprimidos","true"],
["2026-04-18","dermato","noche","Trameel S comprimidos","true"],
["2026-04-18","dermato","noche","Gel Kelual DS","true"],
["2026-04-18","dermato","noche","Nutradeica crema facial ISDIN","true"],
["2026-04-18","dermato","manana","Omeprazol","true"],
["2026-04-19","dermato","manana","Gel Kelual DS","true"],
["2026-04-19","dermato","manana","Nutradeica crema facial ISDIN","true"],
["2026-04-19","dermato","noche","Avene Tolerance Control","true"],
["2026-04-19","dermato","manana","Doxiciclina 100 mg","true"],
["2026-04-19","dermato","manana","Trameel S comprimidos","true"],
["2026-04-19","dermato","tarde","Trameel S comprimidos","true"],
["2026-04-19","dermato","noche","Trameel S comprimidos","true"],
["2026-04-19","dermato","noche","Gel Kelual DS","true"],
["2026-04-19","dermato","noche","Nutradeica crema facial ISDIN","true"],
["2026-04-19","dermato","manana","Omeprazol","true"],
["2026-04-20","dermato","manana","Gel Kelual DS","true"],
["2026-04-20","dermato","manana","Nutradeica crema facial ISDIN","true"],
["2026-04-20","dermato","noche","Avene Tolerance Control","true"],
["2026-04-20","dermato","manana","Doxiciclina 100 mg","true"],
["2026-04-20","dermato","manana","Mometasona .1% ungüento","true"],
["2026-04-20","dermato","manana","Trameel S comprimidos","true"],
["2026-04-20","dermato","tarde","Trameel S comprimidos","true"],
["2026-04-20","dermato","noche","Trameel S comprimidos","true"],
["2026-04-20","dermato","noche","Gel Kelual DS","true"],
["2026-04-20","dermato","noche","Nutradeica crema facial ISDIN","true"],
["2026-04-20","dermato","noche","Mometasona .1% ungüento","true"],
["2026-04-20","dermato","manana","Omeprazol","true"],
["2026-04-21","dermato","manana","Gel Kelual DS","false"],
["2026-04-21","dermato","manana","Nutradeica crema facial ISDIN","false"],
["2026-04-21","dermato","noche","Avene Tolerance Control","false"],
["2026-04-21","dermato","manana","Doxiciclina 100 mg","false"],
["2026-04-21","dermato","manana","Trameel S comprimidos","false"],
["2026-04-21","dermato","tarde","Trameel S comprimidos","false"],
["2026-04-21","dermato","noche","Trameel S comprimidos","false"],
["2026-04-21","dermato","noche","Gel Kelual DS","false"],
["2026-04-21","dermato","noche","Nutradeica crema facial ISDIN","false"],
["2026-04-21","dermato","manana","Omeprazol","false"],
["2026-04-17","suplementos","manana","Metilfolato 400 mcg","false"],
["2026-04-17","suplementos","manana","Coenzima Q10 400mg","true"],
["2026-04-17","suplementos","manana","Vitamina C 1 g","true"],
["2026-04-17","suplementos","manana","Vitamina E 400 UI","true"],
["2026-04-17","suplementos","manana","Zinc tableta 50 mg","false"],
["2026-04-17","suplementos","noche","Coenzima Q10 400mg","true"],
["2026-04-17","suplementos","noche","Zinc tableta 50 mg","false"],
["2026-04-18","suplementos","manana","Metilfolato 400 mcg","false"],
["2026-04-18","suplementos","manana","Coenzima Q10 400mg","true"],
["2026-04-18","suplementos","manana","Vitamina C 1 g","true"],
["2026-04-18","suplementos","manana","Vitamina E 400 UI","true"],
["2026-04-18","suplementos","manana","Zinc tableta 50 mg","false"],
["2026-04-18","suplementos","noche","Coenzima Q10 400mg","true"],
["2026-04-18","suplementos","noche","Zinc tableta 50 mg","false"],
["2026-04-19","suplementos","manana","Metilfolato 400 mcg","false"],
["2026-04-19","suplementos","manana","Coenzima Q10 400mg","true"],
["2026-04-19","suplementos","manana","Vitamina C 1 g","true"],
["2026-04-19","suplementos","manana","Vitamina E 400 UI","true"],
["2026-04-19","suplementos","manana","Zinc tableta 50 mg","false"],
["2026-04-19","suplementos","noche","Coenzima Q10 400mg","true"],
["2026-04-19","suplementos","noche","Zinc tableta 50 mg","false"],
["2026-04-20","suplementos","manana","Metilfolato 400 mcg","false"],
["2026-04-20","suplementos","manana","Coenzima Q10 400mg","false"],
["2026-04-20","suplementos","manana","Vitamina C 1 g","false"],
["2026-04-20","suplementos","manana","Vitamina E 400 UI","false"],
["2026-04-20","suplementos","manana","Zinc tableta 50 mg","false"],
["2026-04-20","suplementos","noche","Coenzima Q10 400mg","false"],
["2026-04-20","suplementos","noche","Zinc tableta 50 mg","false"],
["2026-04-21","suplementos","manana","Metilfolato 400 mcg","false"],
["2026-04-21","suplementos","manana","Coenzima Q10 400mg","false"],
["2026-04-21","suplementos","manana","Vitamina C 1 g","false"],
["2026-04-21","suplementos","manana","Vitamina E 400 UI","false"],
["2026-04-21","suplementos","manana","Zinc tableta 50 mg","false"],
["2026-04-21","suplementos","noche","Coenzima Q10 400mg","false"],
["2026-04-21","suplementos","noche","Zinc tableta 50 mg","false"],
];

exports.handler = async () => {
  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
    const sheets = google.sheets({ version: "v4", auth });
    const SHEET_ID = process.env.GOOGLE_SHEET_ID;

    // Build plan rows
    const planRows = [["categoria","nombre","tiempo","dias","nota","inicio","diasCiclo"]];
    for (const [cat, times] of Object.entries(PLAN)) {
      for (const [time, items] of Object.entries(times)) {
        for (const [nombre, cfg] of Object.entries(items)) {
          planRows.push([cat, nombre, time, cfg.days, cfg.note||"", cfg.inicio||"", cfg.diasCiclo||""]);
        }
      }
    }

    // Upload plan
    await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: "plan!A1:G" });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID, range: "plan!A1",
      valueInputOption: "RAW",
      requestBody: { values: planRows },
    });

    // Upload checks
    const checksRows = [["fecha","categoria","tiempo","nombre","completado"], ...CHECKS];
    await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: "checks!A1:E" });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID, range: "checks!A1",
      valueInputOption: "RAW",
      requestBody: { values: checksRows },
    });

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        ok: true,
        mensaje: "Migración completa",
        plan_productos: planRows.length - 1,
        checks_registros: CHECKS.length,
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
