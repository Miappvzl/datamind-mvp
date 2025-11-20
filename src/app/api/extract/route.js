import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Inicializamos el cliente de Google
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(request) {
  try {
    const { imageBase64 } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "Falta la imagen" }, { status: 400 });
    }

    // Limpiamos el base64 (a veces viene con el prefijo "data:image/png;base64,")
    // Google necesita solo la parte de los datos.
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

// Configuramos el modelo PRO
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-pro", // <--- CAMBIO AQUÍ
      generationConfig: { responseMimeType: "application/json" }
    });

   // Prompt corregido para coincidir con el Frontend
   const prompt = `
      Analiza el documento. Si es una IMAGEN ROTADA, enderézala mentalmente para leerla.
      
      Devuelve este JSON estricto:
      
      {
        "tipo_documento": "cedula" | "factura" | "rif" | "otro",
        "numero_documento":string (número de cédula o número de control de factura),
        "entidad_nombre": string (Nombre de la persona en Cédula, o nombre del NEGOCIO VENDEDOR en factura),
        "cliente_nombre": string (Solo para facturas: nombre del cliente/razón social. Si es cédula, null),
        "fecha": string (DD/MM/AAAA),
        "monto_total": string (Solo facturas. Null en cédulas),
        "detalles_extra": string (Resumen corto de qué se compró, ej: "Medicinas", "Repuestos". Null en cédulas)
      }
    `;

    // Preparamos la imagen para Gemini
    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: "image/jpeg", // Asumimos jpeg/png, Gemini es flexible
      },
    };

    // ¡Disparamos!
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    // Parseamos el texto a JSON real
    const datos = JSON.parse(text);

    return NextResponse.json({ success: true, data: datos });

  } catch (error) {
    console.error("Error con Gemini:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}