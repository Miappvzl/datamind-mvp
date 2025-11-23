"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { auth, googleProvider, db } from "../lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
// Importamos herramientas para LEER la base de datos (query, where, onSnapshot)
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(null);
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState([]); // Estado para guardar la lista de facturas

  // 1. ESCUCHAR USUARIO Y SU HISTORIAL
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Si hay usuario, pedimos sus datos a Firebase
        // QUERY: "Dame la colección 'historial' DONDE el uid sea igual al mío, ordenado por fecha"
        const q = query(
          collection(db, "historial"), 
          where("uid", "==", currentUser.uid),
          orderBy("created_at", "desc")
        );

        // onSnapshot escucha cambios en tiempo real. Si subes algo, aparece solo.
        const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setHistory(docs);
        });
        return () => unsubscribeSnapshot();
      } else {
        setHistory([]); // Si no hay usuario, limpiamos historial
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

  const saveToHistory = async (data) => {
    if (!user) return;
    try {
      await addDoc(collection(db, "historial"), {
        uid: user.uid,
        tipo: data.tipo_documento,
        entidad: data.entidad_nombre,
        monto: data.monto_total || "0",
        fecha_doc: data.fecha || "N/A",
        created_at: serverTimestamp()
      });
    } catch (e) { console.error(e); }
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
    // Si pasamos un array (historial completo) o un objeto simple (resultado actual)
    const dataToExport = Array.isArray(data) ? data.map(item => ({
        Tipo: item.tipo,
        Entidad: item.entidad,
        Monto: item.monto,
        Fecha: item.fecha_doc
    })) : [{
      Tipo: data.tipo_documento,
      Entidad: data.entidad_nombre,
      Documento: data.numero_documento,
      Fecha: data.fecha,
      Cliente: data.cliente_nombre || "N/A",
      Monto: data.monto_total || "0",
      Detalle: data.detalles_extra || "N/A"
    }];

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Datos");
    XLSX.writeFile(wb, `DataMind_Export.xlsx`);
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
        if (user) saveToHistory(data.data);
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

      {/* RESULTADO ACTUAL */}
      {result && (
        <div className="w-full max-w-md mb-12 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl relative mb-4">
                <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-bl-xl uppercase">{result.tipo_documento}</div>
                <h2 className="text-xl font-bold text-white mt-2">{result.entidad_nombre}</h2>
                <div className="flex justify-between mt-4 text-sm">
                    <span className="text-slate-400">{result.fecha || "N/A"}</span>
                    <span className="text-emerald-400 font-mono font-bold text-lg">{result.monto_total}</span>
                </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleExport(result)} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm">Descargar Excel</button>
            <button onClick={() => {setResult(null); setPreview(null);}} className="flex-1 py-2 bg-slate-800 text-white font-bold rounded-lg text-sm">Nuevo</button>
          </div>
        </div>
      )}

      {/* --- SECCIÓN NUEVA: HISTORIAL --- */}
      {user && history.length > 0 && (
        <div className="w-full max-w-4xl mt-8 border-t border-slate-800 pt-8">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">Historial Reciente</h3>
                <button 
                    onClick={() => handleExport(history)} // Exportamos TODO el historial
                    className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded text-emerald-400 border border-slate-700"
                >
                    Exportar Todo a Excel
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {history.map((item) => (
                    <div key={item.id} className="bg-slate-900/50 border border-slate-800 p-4 rounded-lg hover:border-blue-500/50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-950 px-2 py-1 rounded">{item.tipo}</span>
                            <span className="text-xs text-slate-400">{item.fecha_doc}</span>
                        </div>
                        <p className="font-bold text-slate-200 truncate">{item.entidad}</p>
                        <p className="text-emerald-400 font-mono mt-1">{item.monto}</p>
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
}