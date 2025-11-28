import { X } from 'lucide-react';

interface PdfViewerModalProps {
  fileUrl: string;
  fileName: string;
  onClose: () => void;
}

export function PdfViewerModal({ fileUrl, fileName, onClose }: PdfViewerModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold text-gray-900">{fileName}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 p-2">
          <iframe
            src={fileUrl}
            title={fileName}
            className="w-full h-full"
            frameBorder="0"
          />
        </div>
      </div>
    </div>
  );
}
