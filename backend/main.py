from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import io
import json
import os
import hashlib  # <--- Necesario para calcular la huella digital de la imagen
import datetime

# --- Librerías PDF ---
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageDraw # Fallback

# --- Librerías Criptografía ---
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import serialization

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Archivo de base de datos de confianza (Generado por registeruser.py)
USERS_DB_FILE = "users_db.json"

# --- FUNCIONES DE SEGURIDAD ---

def get_user_metadata(user_id: str):
    """Carga los datos del usuario (hash esperado) desde el JSON."""
    if not os.path.exists(USERS_DB_FILE):
        return None
    with open(USERS_DB_FILE, 'r') as f:
        db = json.load(f)
    return db.get(user_id)

def verify_image_integrity(image_path: str, expected_hash: str) -> bool:
    """
    Calcula el hash SHA256 del archivo en disco y lo compara con el esperado.
    Retorna True si la imagen es auténtica.
    """
    if not os.path.exists(image_path):
        return False
        
    sha256_hash = hashlib.sha256()
    with open(image_path, "rb") as f:
        # Leer el archivo en bloques para no saturar memoria
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    
    calculated_hash = sha256_hash.hexdigest()
    
    print(f"🔍 Auditoría de Integridad:")
    print(f"   - Hash Esperado (BD): {expected_hash}")
    print(f"   - Hash Actual (Disco): {calculated_hash}")
    
    return calculated_hash == expected_hash

# --- ENDPOINT SEGURO ---
@app.post("/secure-sign-pdf")
async def secure_sign_pdf(
    file: UploadFile = File(...), 
    private_key: UploadFile = File(...), 
    password: str = Form(...), 
    signatures: str = Form(...), 
    user_id: str = Form(...) 
):
    try:
        print(f"🔒 Iniciando proceso de firma segura para: {user_id}")

        # ---------------------------------------------------------
        # PASO 1: VERIFICACIÓN DE IDENTIDAD (Llave Privada)
        # ---------------------------------------------------------
        try:
            key_bytes = await private_key.read()
            private_key_obj = serialization.load_pem_private_key(
                key_bytes,
                password=password.encode(),
            )
            print("✅ Paso 1: Llave Privada desbloqueada correctamente. Identidad verificada.")
        except ValueError:
            print("❌ Error: La contraseña de la llave es incorrecta.")
            raise HTTPException(status_code=401, detail="FALLO DE AUTENTICACIÓN: Contraseña de llave incorrecta o llave inválida.")

        # ---------------------------------------------------------
        # PASO 2: VERIFICACIÓN DE INTEGRIDAD DE IMAGEN (Anti-Tampering)
        # ---------------------------------------------------------
        # A. Buscar datos del usuario
        user_data = get_user_metadata(user_id)
        if not user_data:
            # Si el usuario no está en el JSON, no podemos confiar en la firma
            raise HTTPException(status_code=404, detail=f"Usuario {user_id} no registrado en la base de confianza.")

        image_filename = user_data['image_filename']
        expected_hash = user_data['image_hash']
        
        # B. Localizar el archivo físico
        signature_path = os.path.join("signatures", image_filename)
        
        if not os.path.exists(signature_path):
            raise HTTPException(status_code=500, detail="ERROR CRÍTICO: El archivo de firma original ha sido eliminado del servidor.")

        # C. COMPARAR HASHES (Aquí detectamos si cambiaron la imagen)
        if not verify_image_integrity(signature_path, expected_hash):
            print("🚨 ALERTA DE SEGURIDAD: Los hashes no coinciden. Posible hackeo.")
            raise HTTPException(status_code=403, detail="ALERTA DE FRAUDE: La imagen de su firma ha sido alterada en el servidor. El hash no coincide con el registro original.")
        
        print("✅ Paso 2: Integridad de la imagen verificada. La firma es auténtica.")
        
        # D. Cargar la imagen ya validada
        signature_img = ImageReader(signature_path)

        # ---------------------------------------------------------
        # PASO 3: ESTAMPADO VISUAL EN EL PDF
        # ---------------------------------------------------------
        input_pdf_bytes = await file.read()
        input_pdf = PdfReader(io.BytesIO(input_pdf_bytes))
        writer = PdfWriter()
        
        sigs_data = json.loads(signatures)
        sigs_by_page = {}
        for s in sigs_data:
            p = s.get('page', 1) - 1
            if p not in sigs_by_page: sigs_by_page[p] = []
            sigs_by_page[p].append(s)

        for i, page in enumerate(input_pdf.pages):
            if i in sigs_by_page:
                page_width = float(page.mediabox.width)
                page_height = float(page.mediabox.height)
                packet = io.BytesIO()
                c = canvas.Canvas(packet, pagesize=(page_width, page_height))
                
                for sig in sigs_by_page[i]:
                    w = sig['width_percent'] * page_width
                    h = sig['height_percent'] * page_height
                    x = sig['x_percent'] * page_width
                    y = page_height - (sig['y_percent'] * page_height) - h
                    
                    # Estampar imagen
                    c.drawImage(signature_img, x, y, width=w, height=h, mask='auto', preserveAspectRatio=True)
                    
                    # Texto de validación visual con parte del Hash
                    c.setFont("Helvetica", 4)
                    c.setFillColorRGB(0.5, 0.5, 0.5)
                    c.drawString(x, y - 5, f"Integrity Check: {expected_hash[:12]}...")

                c.save()
                packet.seek(0)
                page.merge_page(PdfReader(packet).pages[0])
            writer.add_page(page)

        temp_buffer = io.BytesIO()
        writer.write(temp_buffer)
        pdf_final_bytes = temp_buffer.getvalue()

        # ---------------------------------------------------------
        # PASO 4: FIRMA CRIPTOGRÁFICA DEL DOCUMENTO
        # ---------------------------------------------------------
        # Usamos la llave privada para firmar el contenido binario del PDF modificado
        digital_signature = private_key_obj.sign(
            pdf_final_bytes,
            padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.MAX_LENGTH),
            hashes.SHA256()
        )
        
        # ---------------------------------------------------------
        # PASO 5: METADATOS Y RESPUESTA
        # ---------------------------------------------------------
        final_reader = PdfReader(io.BytesIO(pdf_final_bytes))
        final_writer = PdfWriter()
        final_writer.append_pages_from_reader(final_reader)
        
        # Inyectamos evidencia forense en los metadatos
        final_writer.add_metadata({
            '/Producer': 'Hackatics Secure Signer',
            '/Signer-Identity': user_id,
            '/Image-Integrity-Hash': expected_hash, 
            '/Digital-Signature': digital_signature.hex()
        })
        
        output = io.BytesIO()
        final_writer.write(output)
        output.seek(0)

        print("✅ Documento firmado y sellado exitosamente.")
        return StreamingResponse(
            output, 
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=documento_validado.pdf"}
        )

    except Exception as e:
        print(f"🔥 Error en servidor: {str(e)}")
        # Si ya es un HTTPException (como el 403 o 401), lo relanzamos tal cual
        if isinstance(e, HTTPException): raise e
        # Si es un error inesperado, lanzamos 500
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Inicializar DB vacía si no existe para evitar crash
    if not os.path.exists(USERS_DB_FILE):
        with open(USERS_DB_FILE, 'w') as f: json.dump({}, f)
        print(f"⚠️ {USERS_DB_FILE} no existía y fue creado vacío. Ejecuta 'registeruser.py' para registrar usuarios.")
        
    if not os.path.exists("signatures"):
        os.makedirs("signatures")
        
    uvicorn.run(app, host="0.0.0.0", port=8000)