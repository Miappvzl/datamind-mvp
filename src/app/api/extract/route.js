import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Usamos el modelo más potente disponible en tu cuenta
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: "gemini-flash-latest", 
  generationConfig: { responseMimeType: "application/json" }
});

export async function POST(request) {
  try {
    const { imageBase64 } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "Falta la imagen" }, { status: 400 });
    }

    // Limpiamos el base64
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    // --- EL PROMPT "TODOTERRENO" VENEZOLANO ---
    const prompt = `
      Actúa como un experto contable y administrativo en Venezuela. Analiza la imagen del documento.
      Si la imagen está rotada, borrosa o arrugada, corrígela mentalmente para leer los datos.

      1. CLASIFICA el documento en uno de estos tipos: 
         - "factura" (Fiscales, Tickets, Formatos Libres)
         - "cedula" (Documentos de identidad)
         - "rif" (Comprobantes de Registro de Información Fiscal)
         - "pago" (Capturas de Pago Móvil, Zelle, Vouchers de puntos)

      2. EXTRAE los datos según el tipo. Devuelve un JSON ESTRICTO con estas claves. 
         Si un dato no aplica para el tipo de documento o no es visible, usa null.

      {
        "tipo_documento": "factura" | "cedula" | "rif" | "pago",
        
        // IDENTIFICADORES PRINCIPALES
        "numero_documento": string (Cédula, Nro Factura, Nro RIF o Referencia Bancaria),
        "numero_control": string (SOLO FACTURAS: El formato suele ser 00-000000. Muy importante),
        
        // ENTIDADES
        "entidad_nombre": string (Nombre Vendedor, Dueño de Cédula/RIF, o Banco Emisor),
        "entidad_id": string (RIF del Vendedor o Banco de Destino),
        "cliente_nombre": string (Nombre del Comprador o Beneficiario del pago),
        "cliente_id": string (RIF/Cédula del Comprador),
        
        // FECHAS Y MONTOS
        "fecha": string (Formato DD/MM/AAAA. Emisión, Nacimiento o Pago),
        "moneda": string ("Bs" o "USD"),
        "monto_total": string (Monto final con impuestos),
        
        // DETALLES FISCALES (Solo Facturas)
        "monto_base": string (Base imponible antes de IVA),
        "monto_iva": string (Solo el impuesto 16%),
        "monto_igtf": string (Impuesto 3% grandes transacciones, si existe),
        
        // EXTRAS
        "detalles_extra": string (Resumen de ítems, Dirección Fiscal en RIF, o Concepto de pago)
      }
    `;

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: "image/jpeg",
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();
    const datos = JSON.parse(text);

    return NextResponse.json({ success: true, data: datos });

  } catch (error) {
    console.error("Error Gemini:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}