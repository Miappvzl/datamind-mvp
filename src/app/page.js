"use client";

import { useState } from "react";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(null);

  // --- FUNCIÓN MAGICA DE COMPRESIÓN ---
  // Esta función toma la foto gigante y la reduce a max 1024px
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          // Reducimos si es muy grande (Max ancho/alto: 1024px)
          const MAX_SIZE = 1024;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          // Convertimos a JPEG con calidad 0.7 (reduce peso 80% sin perder legibilidad)
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          resolve(dataUrl);
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Mostramos preview inmediatamente (aunque sea la grande)
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setLoading(true);

    try {
      // 1. COMPRIMIMOS LA IMAGEN ANTES DE ENVIAR
      // Pasamos de 8MB a 200KB en milisegundos
      const compressedBase64 = await compressImage(file);

      // 2. Enviamos la versión ligera al Backend
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: compressedBase64 }),
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.data);
      } else {
        alert("Error del servidor: " + (data.error || "Desconocido"));
      }
    } catch (error) {
      console.error(error);
      alert("Error de conexión o imagen muy pesada.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center p-6 bg-slate-950 text-white font-sans">
      <div className="w-full max-w-4xl flex flex-col md:flex-row justify-between items-center mb-10">
        <div className="text-center md:text-left">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
            DataMind AI
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Extractor de Documentos & Facturas
          </p>
        </div>
        <div className="mt-4 md:mt-0">
          <span className="px-3 py-1 bg-blue-900/30 text-blue-300 text-xs rounded-full border border-blue-800">
            MVP 1.0.0 By Angel Ojeda
          </span>
        </div>
      </div>

      {/* AREA DE CARGA */}
      {!result && !loading && (
        <div className="w-full max-w-xl h-64 border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center text-center hover:border-emerald-500 hover:bg-slate-900/50 transition-all cursor-pointer relative group bg-slate-900/20">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="p-4 rounded-full bg-slate-800 group-hover:scale-110 transition-transform mb-4 shadow-lg shadow-blue-900/20">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-8 h-8 text-blue-400"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"
              />
            </svg>
          </div>
          <p className="text-slate-300 font-medium text-lg">
            Tocar para subir foto
          </p>
          <p className="text-slate-500 text-xs mt-2 px-4">
            La IA optimizará y leerá tu imagen automáticamente
          </p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center h-64 animate-pulse">
          <div className="relative w-20 h-20 mb-4">
            <div className="absolute inset-0 border-4 border-blue-500/30 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-blue-400 font-mono text-lg">
            Procesando imagen...
          </p>
          <p className="text-slate-500 text-xs mt-2">
            Comprimiendo y enviando a Gemini AI
          </p>
        </div>
      )}

      {/* RESULTADOS */}
      {result && (
        <div className="grid grid-cols-1 gap-6 w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
          {/* TARJETA DE DATOS */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 px-4 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-bl-xl uppercase border-b border-l border-emerald-500/20">
              {result.tipo_documento}
            </div>

            <div className="mb-6 pr-8">
              <span className="text-slate-500 text-[10px] uppercase tracking-wider font-bold">
                Entidad / Nombre
              </span>
              <h2 className="text-xl md:text-2xl font-bold text-white mt-1 leading-tight">
                {result.entidad_nombre}
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-500 text-[10px] uppercase tracking-wider block mb-1">
                  Documento
                </span>
                <p className="text-base font-mono text-blue-300 truncate">
                  {result.numero_documento}
                </p>
              </div>
              <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-500 text-[10px] uppercase tracking-wider block mb-1">
                  Fecha
                </span>
                <p className="text-base text-white">{result.fecha || "N/A"}</p>
              </div>
            </div>

            {/* SOLO FACTURAS */}
            {result.tipo_documento === "factura" && (
              <div className="mt-4 pt-4 border-t border-dashed border-slate-800">
                <div className="mb-4">
                  <span className="text-slate-500 text-[10px] uppercase tracking-wider">
                    Cliente
                  </span>
                  <p className="text-slate-300 text-sm font-medium">
                    {result.cliente_nombre || "Consumidor Final"}
                  </p>
                </div>
                <div className="flex flex-col bg-emerald-900/10 p-4 rounded-xl border border-emerald-500/20 text-center">
                  <span className="text-emerald-500 text-xs uppercase font-bold mb-1">
                    Total a Pagar
                  </span>
                  <p className="text-emerald-400 text-3xl font-bold tracking-tight">
                    {result.monto_total}
                  </p>
                  <p className="text-slate-500 text-xs mt-2 border-t border-emerald-500/10 pt-2">
                    {result.detalles_extra}
                  </p>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setResult(null);
              setPreview(null);
            }}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/50 transition-transform active:scale-95"
          >
            Escanear Nuevo Documento
          </button>
        </div>
      )}
      
    </div>
  );
}
