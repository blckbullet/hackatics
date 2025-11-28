import React, { useState } from 'react';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (keyFile: File, password: string) => void;
  isLoading: boolean;
}

const Icons = {
  Lock: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  Key: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>
};

const SignatureModal: React.FC<SignatureModalProps> = ({ isOpen, onClose, onConfirm, isLoading }) => {
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!keyFile || !password) return alert("Por favor sube tu llave privada y escribe la contraseña.");
    onConfirm(keyFile, password);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative overflow-hidden">
        {/* Decorative Top Bar */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-600"></div>

        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
          ✕
        </button>
        
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="bg-indigo-50 p-4 rounded-full text-indigo-600 mb-4 shadow-inner">
            <Icons.Lock />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Verificación de Identidad</h2>
          <p className="text-sm text-gray-500 mt-2 px-4">
            Para firmar digitalmente, necesitamos verificar que eres tú usando tu <strong>Llave Privada (.pem)</strong>.
          </p>
        </div>

        <div className="space-y-5">
          {/* Input Archivo */}
          <div className={`border-2 border-dashed rounded-xl p-6 transition-all cursor-pointer relative group bg-gray-50 hover:bg-white
            ${keyFile ? 'border-green-500 bg-green-50/30' : 'border-gray-300 hover:border-indigo-500'}`}
          >
            <input 
              type="file" 
              accept=".pem,.key"
              onChange={(e) => setKeyFile(e.target.files?.[0] || null)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="flex flex-col items-center justify-center pointer-events-none">
               <div className={`mb-2 transition-colors ${keyFile ? 'text-green-500' : 'text-gray-400 group-hover:text-indigo-500'}`}>
                 <Icons.Key />
               </div>
               <span className={`text-sm font-medium ${keyFile ? 'text-green-700' : 'text-gray-600'}`}>
                 {keyFile ? keyFile.name : "Subir archivo .pem"}
               </span>
            </div>
          </div>

          {/* Input Contraseña */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Contraseña de la Llave</label>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 bg-gray-50 rounded-lg p-3 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white py-3.5 rounded-lg font-bold hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center transform active:scale-95"
          >
            {isLoading ? (
               <span className="flex items-center">
                 <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                 Verificando y Firmando...
               </span>
            ) : (
               "Firmar Documento"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignatureModal;