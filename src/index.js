const JSON_HEADERS = {
  "Content-Type": "application/json; charset=UTF-8",
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "X-Content-Type-Options": "nosniff",
};


function jsonResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: JSON_HEADERS,
    }
  );
}


export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ========================================================
    // API PARA OBTENER EL JSON DESDE DROPBOX
    // ========================================================

    if (url.pathname === "/api/datos") {
      if (
        request.method !== "GET" &&
        request.method !== "HEAD"
      ) {
        return jsonResponse(
          {
            error: "Método no permitido",
          },
          405
        );
      }

      // El enlace de Dropbox se guarda como Secret
      // con el nombre DROPBOX_JSON_URL.
      if (!env.DROPBOX_JSON_URL) {
        return jsonResponse(
          {
            error:
              "Falta configurar el Secret DROPBOX_JSON_URL",
          },
          500
        );
      }

      try {
        const respuestaDropbox = await fetch(
          env.DROPBOX_JSON_URL,
          {
            method: "GET",

            headers: {
              "Accept": "application/json",
              "User-Agent":
                "Control-Documental-Worker/1.0",
            },

            redirect: "follow",

            cf: {
              cacheTtl: 0,
              cacheEverything: false,
            },
          }
        );

        if (!respuestaDropbox.ok) {
          return jsonResponse(
            {
              error:
                "No se pudo obtener el JSON desde Dropbox",

              estado_origen:
                respuestaDropbox.status,
            },
            502
          );
        }

        const texto =
          await respuestaDropbox.text();

        let datos;

        try {
          datos = JSON.parse(texto);
        } catch {
          return jsonResponse(
            {
              error:
                "El archivo recibido no contiene un JSON válido",
            },
            502
          );
        }

        // Validar que el JSON contenga
        // las tres secciones necesarias.
        if (
          !datos ||
          !Array.isArray(datos.empresas) ||
          !Array.isArray(datos.vehiculos) ||
          !Array.isArray(datos.conductores)
        ) {
          return jsonResponse(
            {
              error:
                "El JSON no contiene las secciones requeridas",
            },
            502
          );
        }

        if (request.method === "HEAD") {
          return new Response(
            null,
            {
              status: 200,
              headers: JSON_HEADERS,
            }
          );
        }

        return jsonResponse(
          datos,
          200
        );

      } catch (error) {
        return jsonResponse(
          {
            error:
              "Error al consultar la fuente de datos",

            detalle:
              error instanceof Error
                ? error.message
                : String(error),
          },
          500
        );
      }
    }

    // ========================================================
    // ARCHIVOS ESTÁTICOS
    // ========================================================

    return env.ASSETS.fetch(request);
  },
};
