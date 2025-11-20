import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    // Hacemos una petición directa a la API REST de Google, saltándonos la librería
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();

    // Filtramos solo los nombres para que sea fácil de leer
    const nombres = data.models
      ? data.models.map(m => m.name.replace('models/', ''))
      : data;

    return NextResponse.json({ modelos_disponibles: nombres });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}