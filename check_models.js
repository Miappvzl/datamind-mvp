// check_models.js

// 1. PEGA TU CLAVE AQUÍ (La que empieza por AIza...)
const API_KEY = "AIzaSyC4yGHkQdt2dbckpNdnvaeSSiewoFJl5w4"; 

async function listarModelos() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error("❌ ERROR DE CUENTA:", data.error.message);
    } else {
      console.log("✅ MODELOS DISPONIBLES PARA TI:");
      console.log("--------------------------------");
      // Filtramos solo los que generan contenido (no los de embedding)
      const models = data.models.filter(m => m.supportedGenerationMethods.includes("generateContent"));
      
      models.forEach(m => {
        // Limpiamos el nombre para que sea copiar y pegar
        console.log(`"${m.name.replace('models/', '')}"`);
      });
      console.log("--------------------------------");
      console.log("Copia uno de esos nombres exactos y ponlo en tu route.js");
    }
  } catch (error) {
    console.error("Error de conexión:", error);
  }
}

listarModelos();