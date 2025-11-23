"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { auth, googleProvider, db } from "../lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
// IMPORTAMOS deleteDoc y doc PARA PODER BORRAR
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc } from "firebase/firestore";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(null);
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState([]);

  // --- 1. ESCUCHAR USUARIO Y SU HISTORIAL ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        const q = query(
          collection(db, "historial"), 
          where("uid", "==", currentUser.uid),
          orderBy("created_at", "desc")
        );

        const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setHistory(docs);
        });
        return () => unsubscribeSnapshot();
      } else {
        setHistory([]);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const handleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); } catch (error) { console.error(error); }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setResult(null);
    setPreview(null);
  };

  // --- 2. GUARDAR EN FIRESTORE ---
  const saveToHistory = async (data) => {
    if (!user) return;
    try {
      await addDoc(collection(db, "historial"), {
        uid: user.uid,
        tipo: data.tipo_documento,
        entidad: data.entidad_nombre,
        entidad_id: data.entidad_id || "N/A",
        numero_documento: data.numero_documento || "N/A",
        numero_control: data.numero_control || "N/A",
        cliente: data.cliente_nombre || "N/A",
        cliente_id: data.cliente_id || "N/A",
        fecha_doc: data.fecha || "N/A",
        moneda: data.moneda || "Bs",
        monto: data.monto_total || "0",
        base: data.monto_base || "0",
        iva: data.monto_iva || "0",
        igtf: data.monto_igtf || "0",
        detalle: data.detalles_extra || "N/A",
        created_at: serverTimestamp()
      });
    } catch (e) { console.error("Error al guardar:", e); }
  };

  // --- NUEVO: BORRAR DOCUMENTO ---
  const handleDelete = async (id, e) => {
    e.stopPropagation(); // Evita que al dar click en borrar, se abra la tarjeta
    if (!confirm("¿Estás seguro de que quieres eliminar este documento?")) return;
    
    try {
        await deleteDoc(doc(db, "historial", id));
        // Si el documento borrado es el que se está viendo arriba, lo limpiamos
        if (result && result.id === id) {
            setResult(null);
        }
    } catch (error) {
        console.error("Error al eliminar:", error);
        alert("No se pudo eliminar");
    }
  };

  // --- NUEVO: SELECCIONAR DEL HISTORIAL ---
  const handleSelectHistory = (item) => {
    // Convertimos los datos del historial al formato que espera "result"
    setResult({
        ...item, // Copiamos todos los datos
        entidad_nombre: item.entidad, // Mapeamos nombres viejos a nuevos por si acaso
        monto_total: item.monto,
        detalles_extra: item.detalle
    });
    // Scroll suave hacia arriba para ver el detalle
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
          const MAX_SIZE = 1024;
          if (width > height) {
            if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
          } else {
            if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          resolve(dataUrl);
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleExport = (data = result) => {
    if (!data) return;
    const dataArray = Array.isArray(data) ? data : [data];

    const dataToExport = dataArray.map(item => ({
        TIPO: (item.tipo || item.tipo_documento)?.toUpperCase(),
        FECHA: item.fecha_doc || item.fecha,
        ENTIDAD: item.entidad || item.entidad_nombre,
        RIF_ENTIDAD: item.entidad_id || item.rif_entidad || "N/A",
        DOCUMENTO: item.numero_documento || "N/A", 
        CONTROL: item.numero_control || "N/A",
        CLIENTE: item.cliente || item.cliente_nombre || "N/A",
        MONEDA: item.moneda || "Bs",
        BASE: item.base || item.monto_base || "0",
        IVA: item.iva || item.monto_iva || "0",
        IGTF: item.igtf || item.monto_igtf || "0",
        TOTAL: item.monto || item.monto_total,
        DETALLE: item.detalle || item.detalles_extra || "N/A"
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte DataMind");
    ws['!cols'] = [{wch:10}, {wch:12}, {wch:30}, {wch:15}, {wch:15}, {wch:15}, {wch:20}];
    
    XLSX.writeFile(wb, `DataMind_Reporte.xlsx`);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setLoading(true);

    try {
      const compressedBase64 = await compressImage(file);
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: compressedBase64 }),
      });
      const data = await response.json();
      if (data.success) {
        setResult(data.data);
        if (user) {
            await saveToHistory(data.data);
        }
      } else { alert("Error: " + data.error); }
    } catch (error) { console.error(error); alert("Error de conexión"); } 
    finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen flex-col items-center p-6 bg-slate-950 text-white font-sans">
      
      {/* HEADER */}
      <div className="w-full max-w-4xl flex flex-col md:flex-row justify-between items-center mb-10">
        <div className="text-center md:text-left mb-4 md:mb-0">
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">DataMind AI</h1>
            <p className="text-slate-400 text-sm mt-1">Tu Asistente Contable Inteligente</p>
        </div>
        <div>
            {user ? (
                <div className="flex items-center gap-4 bg-slate-900 p-2 rounded-full border border-slate-800">
                    <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full" />
                    <span className="text-xs font-bold text-slate-300 hidden md:block">{user.displayName}</span>
                    <button onClick={handleLogout} className="text-xs text-red-400 px-3 hover:text-red-300">Salir</button>
                </div>
            ) : (
                <button onClick={handleLogin} className="flex items-center gap-2 px-4 py-2 bg-white text-black font-bold text-sm rounded-full hover:bg-gray-200 transition-colors">
                    Entrar con Google
                </button>
            )}
        </div>
      </div>

      {/* ZONA DE ESCANEO */}
      {!result && !loading && (
          <div className="w-full max-w-xl h-48 border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center text-center hover:border-emerald-500 hover:bg-slate-900/50 transition-all cursor-pointer relative group bg-slate-900/20 mb-10">
            <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            <div className="p-3 rounded-full bg-slate-800 group-hover:scale-110 transition-transform mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-blue-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
            </div>
            <p className="text-slate-300 font-medium">Subir Documento</p>
          </div>
      )}

      {loading && (
          <div className="flex flex-col items-center justify-center h-48 mb-10">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-blue-400 animate-pulse">Analizando...</p>
          </div>
      )}

      {/* RESULTADO ACTUAL DETALLADO */}
      {result && (
        <div className="w-full max-w-lg mb-12 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl relative mb-4">
                
                {/* CABECERA */}
                <div className="flex justify-between items-start p-4 bg-slate-950/50 border-b border-slate-800">
                    <div className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded uppercase tracking-widest">
                        {result.tipo || result.tipo_documento}
                    </div>
                    {result.numero_control && result.numero_control !== "N/A" && (
                         <div className="text-right">
                            <span className="text-[9px] text-slate-500 uppercase font-bold block">Nº Control</span>
                            <span className="text-red-400 font-mono text-sm tracking-widest">{result.numero_control}</span>
                         </div>
                    )}
                </div>

                <div className="p-6">
                    {/* EMISOR */}
                    <div className="mb-6">
                        <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">De / Emisor</span>
                        <h2 className="text-xl font-bold text-white mt-1 leading-tight">{result.entidad || result.entidad_nombre}</h2>
                        {(result.entidad_id || result.rif_entidad) && (
                            <p className="text-slate-400 text-xs font-mono mt-1">RIF: {result.entidad_id || result.rif_entidad}</p>
                        )}
                    </div>

                    {/* RECEPTOR */}
                    {(result.cliente || result.cliente_nombre) && (result.cliente !== "N/A") && (
                        <div className="mb-6 pb-6 border-b border-slate-800 border-dashed">
                            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Para / Receptor</span>
                            <p className="text-slate-300 font-medium">{result.cliente || result.cliente_nombre}</p>
                        </div>
                    )}

                    {/* GRID DATOS */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-slate-950/30 p-2 rounded border border-slate-800/50">
                            <span className="text-slate-500 text-[9px] uppercase font-bold block mb-1">Documento</span>
                            <p className="text-blue-400 font-mono text-base truncate">
                                {result.numero_documento || "N/A"}
                            </p>
                        </div>
                        <div className="bg-slate-950/30 p-2 rounded border border-slate-800/50">
                            <span className="text-slate-500 text-[9px] uppercase font-bold block mb-1">Fecha</span>
                            <p className="text-white font-mono text-base">
                                {result.fecha || result.fecha_doc || "N/A"}
                            </p>
                        </div>
                    </div>

                    {/* MONTOS (Solo si hay total) */}
                    {(result.monto_total || result.monto) && (result.monto !== "0") && (
                        <div className="flex justify-between items-end border-t border-slate-800 pt-4">
                            <div>
                                <span className="text-slate-500 text-[10px] uppercase font-bold">Total a Pagar</span>
                                <p className="text-emerald-500 text-xs mt-1">{result.moneda || "Bs"}</p>
                            </div>
                            <span className="text-emerald-400 font-mono font-bold text-3xl tracking-tight">
                                {result.monto_total || result.monto}
                            </span>
                        </div>
                    )}

                    {/* DETALLES */}
                    {(result.detalles_extra || result.detalle) && (result.detalle !== "N/A") && (
                        <p className="text-slate-600 text-[10px] mt-4 text-center italic border-t border-slate-800/50 pt-2">
                            "{result.detalles_extra || result.detalle}"
                        </p>
                    )}
                </div>
          </div>
          
          <div className="flex gap-2">
            <button onClick={() => handleExport(result)} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm shadow-lg">Descargar Excel</button>
            <button onClick={() => {setResult(null); setPreview(null);}} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm">Nuevo Escaneo</button>
          </div>
        </div>
      )}

      {/* --- HISTORIAL INTERACTIVO --- */}
      {user && history.length > 0 && (
        <div className="w-full max-w-4xl mt-8 border-t border-slate-800 pt-8">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">Historial</h3>
                <button onClick={() => handleExport(history)} className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded text-emerald-400 border border-slate-700">Exportar Todo</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {history.map((item) => (
                    <div 
                        key={item.id} 
                        onClick={() => handleSelectHistory(item)} // CLIC PARA VER
                        className="bg-slate-900/50 border border-slate-800 p-4 rounded-lg hover:border-blue-500/50 hover:bg-slate-900 transition-all cursor-pointer relative group"
                    >
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-950 px-2 py-1 rounded">{item.tipo}</span>
                            
                            {/* BOTÓN DE ELIMINAR (ROJO) */}
                            <button 
                                onClick={(e) => handleDelete(item.id, e)}
                                className="text-slate-600 hover:text-red-500 transition-colors p-1"
                                title="Eliminar"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                </svg>
                            </button>
                        </div>
                        
                        <p className="font-bold text-slate-200 truncate">{item.entidad}</p>
                        <p className="text-blue-400/70 font-mono text-xs mt-1">
                             {item.numero_documento !== "N/A" ? item.numero_documento : "Sin Nro"}
                        </p>
                        <div className="flex justify-between items-end mt-2">
                             <p className="text-xs text-slate-500">{item.fecha_doc}</p>
                             <p className="text-emerald-400 font-mono text-sm">{item.monto !== "0" ? item.monto : ""}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
}