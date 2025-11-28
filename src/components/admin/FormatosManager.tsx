import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { FileObject } from "@supabase/storage-js";

export function FormatosManager() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [formatos, setFormatos] = useState<FileObject[]>([]);
  const [editingFile, setEditingFile] = useState<FileObject | null>(null);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    fetchFormatos();
  }, []);

  const fetchFormatos = async () => {
    const { data, error } = await supabase.storage.from("formatos").list();
    if (data) {
      setFormatos(data);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
      setFeedback(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) return;

    setUploading(true);
    setFeedback(null);

    const fileName = file.name.replace(/\s/g, '_');

    try {
      const { data, error } = await supabase.storage
        .from("formatos")
        .upload(fileName, file, {
          upsert: true, // Permite sobrescribir si existe
          contentType: file.type || "application/octet-stream",
        });

      if (error) {
        throw error;
      }

      setFeedback({
        type: "success",
        message: "¡Formato subido exitosamente!",
      });
      setFile(null);
      (document.getElementById("file-upload") as HTMLInputElement).value = "";
      await fetchFormatos();
    } catch (error: any) {
      console.error("Error uploading file:", error);
      setFeedback({
        type: "error",
        message: `Error al subir el formato: ${
          error.message || "Intenta con otro nombre de archivo"
        }`,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileName: string) => {
    const { error } = await supabase.storage
      .from("formatos")
      .remove([fileName]);
    if (error) {
      setFeedback({
        type: "error",
        message: `Error al eliminar el formato: ${error.message}`,
      });
    } else {
      setFeedback({
        type: "success",
        message: "¡Formato eliminado exitosamente!",
      });
      fetchFormatos(); // Refresh the list
    }
  };

  const handleDownload = async (fileName: string) => {
    const { data, error } = await supabase.storage
      .from("formatos")
      .createSignedUrl(fileName, 60); // 60 seconds validity

    if (error) {
      setFeedback({
        type: "error",
        message: `Error al crear URL de descarga: ${error.message}`,
      });
      return;
    }

    if (data) {
      window.open(data.signedUrl, "_blank");
    }
  };

  const handleEditClick = (formato: FileObject) => {
    setEditingFile(formato);
    setNewName(formato.name);
  };

  const handleCancelEdit = () => {
    setEditingFile(null);
    setNewName("");
  };

  const handleRename = async () => {
    if (!editingFile || !newName || newName === editingFile.name) {
      handleCancelEdit();
      return;
    }

    const { error } = await supabase.storage
      .from("formatos")
      .move(editingFile.name, newName);

    if (error) {
      setFeedback({
        type: "error",
        message: `Error al renombrar el archivo: ${error.message}`,
      });
    } else {
      setFeedback({
        type: "success",
        message: "¡Archivo renombrado exitosamente!",
      });
      fetchFormatos();
    }
    handleCancelEdit();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold mb-4">Subir Nuevo Formato</h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="file-upload"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Seleccionar archivo (formatos .doc, .docx)
            </label>
            <input
              id="file-upload"
              name="file-upload"
              type="file"
              accept=".doc,.docx,application/pdf"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
            />
          </div>

          {feedback && (
            <div
              className={`p-4 rounded-md mb-4 ${
                feedback.type === "success"
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {feedback.message}
            </div>
          )}

          <button
            type="submit"
            disabled={!file || uploading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center"
          >
            {uploading ? "Subiendo..." : "Subir Formato"}
          </button>
        </form>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold mb-4">Formatos Existentes</h3>
        <ul className="space-y-2">
          {formatos.map((formato) => (
            <li
              key={formato.id}
              className="flex items-center justify-between p-2 border rounded-lg"
            >
              {editingFile?.id === formato.id ? (
                <div className="flex-grow flex items-center gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded-lg"
                    autoFocus
                  />
                  <button onClick={handleRename} className="text-green-600">Guardar</button>
                  <button onClick={handleCancelEdit} className="text-gray-600">Cancelar</button>
                </div>
              ) : (
                <>
                  <span className="truncate">{formato.name}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditClick(formato)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDownload(formato.name)}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      Descargar
                    </button>
                    <button
                      onClick={() => handleDelete(formato.name)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Eliminar
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
