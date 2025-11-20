"use client";

import { useState } from "react";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(null);

  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setResult(null);
    setLoading(true);

    try {
      const base64 = await convertToBase64(file);
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64 }),
      });

      const data = await response.json();
      if (data.success) {
        setResult(data.data);
      } else {
        alert("Error: " + data.error);
      }
    } catch (error) {
      console.error(error);
      alert("Error al procesar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center p-6 bg-slate-950 text-white font-sans">
      <div className="w-full max-w-4xl flex flex-col md:flex-row justify-between items-center mb-10">
        <div>
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
            DataMind AI
            </h1>
            <p className="text-slate-400 text-sm mt-1">Extractor de Documentos & Facturas</p>
        </div>
        <div className="mt-4 md:mt-0">
            <span className="px-3 py-1 bg-blue-900/30 text-blue-300 text-xs rounded-full border border-blue-800">
                Versión MVP 1.0
            </span>
        </div>
      </div>

      {/* AREA DE CARGA */}
      {!result && !loading && (
          <div className="w-full max-w-xl h-64 border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center text-center hover:border-emerald-500 hover:bg-slate-900/50 transition-all cursor-pointer relative group">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="p-4 rounded-full bg-slate-800 group-hover:scale-110 transition-transform mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-blue-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
            </div>
            <p className="text-slate-300 font-medium">Sube una Factura o Cédula</p>
            <p className="text-slate-500 text-xs mt-2">Soporta imágenes rotadas, arrugadas o con flash</p>
          </div>
      )}

      {loading && (
          <div className="flex flex-col items-center justify-center h-64 animate-pulse">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-blue-400 font-mono">Analizando documento...</p>
              <p className="text-slate-500 text-xs">Extrayendo datos con IA</p>
          </div>
      )}

      {/* RESULTADOS */}
      {result && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Columna Izquierda: Imagen */}
          <div className="bg-black p-2 rounded-xl border border-slate-800 shadow-2xl">
            <img src={preview} alt="Upload" className="w-full rounded-lg object-contain max-h-[500px]" />
            <button 
                onClick={() => {setResult(null); setPreview(null);}}
                className="mt-4 w-full py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded transition-colors"
            >
                Subir otro documento
            </button>
          </div>

          {/* Columna Derecha: Datos Procesados */}
          <div className="flex flex-col gap-4">
            
            {/* TARJETA PRINCIPAL */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-bl-xl uppercase">
                    {result.tipo_documento}
                </div>

                <div className="mb-6">
                    <span className="text-slate-500 text-xs uppercase tracking-wider">Entidad / Nombre</span>
                    <h2 className="text-2xl font-bold text-white mt-1">{result.entidad_nombre}</h2>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <span className="text-slate-500 text-xs uppercase tracking-wider">Nº Documento</span>
                        <p className="text-lg font-mono text-blue-300">{result.numero_documento}</p>
                    </div>
                    <div>
                        <span className="text-slate-500 text-xs uppercase tracking-wider">Fecha</span>
                        <p className="text-lg text-white">{result.fecha || "N/A"}</p>
                    </div>
                </div>

                {/* SECCIÓN CONDICIONAL: SOLO PARA FACTURAS */}
                {result.tipo_documento === 'factura' && (
                    <div className="mt-6 pt-6 border-t border-slate-800">
                        <div className="mb-4">
                             <span className="text-slate-500 text-xs uppercase tracking-wider">Cliente / Comprador</span>
                             <p className="text-white font-medium">{result.cliente_nombre || "Consumidor Final"}</p>
                        </div>
                        <div className="flex justify-between items-end bg-emerald-900/10 p-3 rounded border border-emerald-900/30">
                            <div>
                                <span className="text-emerald-600 text-xs uppercase font-bold">Monto Total</span>
                                <p className="text-emerald-400 text-3xl font-bold">{result.monto_total}</p>
                            </div>
                            <div className="text-right">
                                <span className="text-slate-500 text-xs">Detalle</span>
                                <p className="text-slate-300 text-sm">{result.detalles_extra}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* JSON VISOR (Para desarrolladores/Demo) */}
            <div className="bg-slate-950 rounded-lg p-4 border border-slate-900">
                <p className="text-xs text-slate-600 mb-2">JSON API Output</p>
                <pre className="text-[10px] text-slate-400 font-mono overflow-x-auto">
                    {JSON.stringify(result, null, 2)}
                </pre>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}