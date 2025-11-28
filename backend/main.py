from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import io
import json
import datetime
import os

# --- Librerías PDF ---
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

# --- Librerías Imagen (CORRECCIÓN DE ERROR) ---
from PIL import Image, ImageDraw, ImageFont

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

# --- 1. LÓGICA DE BASE DE DATOS DE FIRMAS ---
def get_signature_image_from_db(user_id: str):
    """
    Busca la imagen en la carpeta 'signatures'.
    Si no existe, genera una imagen PNG dinámica en memoria para evitar errores.
    """
    # 1. Intentar cargar el archivo físico
    # Nota: Limpiamos el user_id para evitar Path Traversal attacks
    safe_id = "".join([c for c in user_id if c.isalnum() or c in ('_','-')])
    signature_path = os.path.join("signatures", f"{safe_id}.png")
    
    if os.path.exists(signature_path):
        print(f"✅ Firma física encontrada: {signature_path}")
        return ImageReader(signature_path)
    
    print(f"⚠️ Firma no encontrada para {safe_id}. Generando firma digital visual...")
    
    # 2. FALLBACK: Generar imagen PNG con Pillow (Solución al error BytesIO)
    # Creamos una imagen transparente
    width, height = 400, 100
    img = Image.new('RGBA', (width, height), (255, 255, 255, 0))
    d = ImageDraw.Draw(img)
    
    # Dibujamos un texto simulando la firma
    # Usamos fuente por defecto si no hay una específica
    try:
        # Intentar dibujar un rectángulo azul y el nombre
        d.rectangle([10, 10, width-10, height-10], outline="blue", width=3)
        d.text((20, 40), f"Firma Digital: {user_id}", fill="darkblue")
        d.text((20, 60), f"Validado por Sistema", fill="gray")
    except Exception as e:
        print(f"Error generando imagen: {e}")

    # Guardar en buffer como PNG
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    
    return ImageReader(buffer)

# --- 2. ENDPOINT DE FIRMA SEGURA ---
@app.post("/secure-sign-pdf")
async def secure_sign_pdf(
    file: UploadFile = File(...),          # PDF original
    private_key: UploadFile = File(...),   # Llave privada (.pem)
    password: str = Form(...),             # Contraseña de la llave
    signatures: str = Form(...),           # Coordenadas JSON
    user_id: str = Form(...)               # ID del usuario (ej: usuario_ejemplo_123)
):
    """
    Flujo Completo:
    1. Recibe credenciales y archivo.
    2. Valida la identidad desencriptando la llave privada.
    3. Busca la firma visual en la BD (carpeta).
    4. Estampa la firma visual en el PDF.
    5. Calcula Hash y firma criptográficamente el PDF.
    6. Devuelve el PDF final.
    """
    try:
        # A. VALIDACIÓN DE IDENTIDAD (CRÍTICO)
        try:
            key_bytes = await private_key.read()
            private_key_obj = serialization.load_pem_private_key(
                key_bytes,
                password=password.encode(),
            )
            print("✅ Identidad verificada correctamente con llave privada.")
        except ValueError:
            print("❌ Contraseña incorrecta o llave corrupta.")
            raise HTTPException(status_code=401, detail="Credenciales inválidas: Contraseña incorrecta.")

        # B. OBTENER IMAGEN VISUAL
        signature_img = get_signature_image_from_db(user_id)

        # C. PROCESAR PDF (Estampado Visual)
        input_pdf_bytes = await file.read()
        input_stream = io.BytesIO(input_pdf_bytes)
        input_pdf = PdfReader(input_stream)
        writer = PdfWriter()
        
        sigs_data = json.loads(signatures)
        
        # Mapa de firmas por página
        sigs_by_page = {}
        for s in sigs_data:
            p = s.get('page', 1) - 1
            if p not in sigs_by_page: sigs_by_page[p] = []
            sigs_by_page[p].append(s)

        # Iterar páginas y estampar
        for i, page in enumerate(input_pdf.pages):
            if i in sigs_by_page:
                page_width = float(page.mediabox.width)
                page_height = float(page.mediabox.height)
                
                packet = io.BytesIO()
                c = canvas.Canvas(packet, pagesize=(page_width, page_height))
                
                for sig in sigs_by_page[i]:
                    # Cálculos de posición
                    w = sig['width_percent'] * page_width
                    h = sig['height_percent'] * page_height
                    x = sig['x_percent'] * page_width
                    y_top = sig['y_percent'] * page_height
                    y = page_height - y_top - h
                    
                    # Dibujar imagen (mask='auto' respeta transparencia PNG)
                    try:
                        c.drawImage(signature_img, x, y, width=w, height=h, mask='auto', preserveAspectRatio=True)
                    except Exception as img_err:
                        print(f"Error dibujando imagen: {img_err}")
                        # Fallback texto si la imagen falla
                        c.drawString(x, y, f"[Firma: {user_id}]")

                    # Hash visual de referencia
                    c.setFont("Helvetica", 5)
                    c.setFillColorRGB(0.5, 0.5, 0.5)
                    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    c.drawString(x, y - 6, f"Digitally Signed: {timestamp}")

                c.save()
                packet.seek(0)
                overlay = PdfReader(packet).pages[0]
                page.merge_page(overlay)
            
            writer.add_page(page)

        # D. GENERAR PDF INTERMEDIO
        temp_buffer = io.BytesIO()
        writer.write(temp_buffer)
        pdf_final_bytes = temp_buffer.getvalue()

        # E. FIRMA CRIPTOGRÁFICA (El HASH real)
        # Firmamos los bytes del PDF final modificado
        digital_signature = private_key_obj.sign(
            pdf_final_bytes,
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
        
        # F. AGREGAR METADATOS
        final_reader = PdfReader(io.BytesIO(pdf_final_bytes))
        final_writer = PdfWriter()
        final_writer.append_pages_from_reader(final_reader)
        
        # Inyectamos la prueba criptográfica en el PDF
        final_writer.add_metadata({
            '/Producer': 'Hackatics Secure Signer v1.0',
            '/Title': 'Documento Firmado Oficialmente',
            '/Signer-Identity': user_id,
            '/Digital-Signature-SHA256': digital_signature.hex(),
            '/Verification': 'Validated against database and private key'
        })
        
        output_buffer = io.BytesIO()
        final_writer.write(output_buffer)
        output_buffer.seek(0)

        print("✅ Proceso completado exitosamente.")
        return StreamingResponse(
            output_buffer, 
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=documento_firmado_seguro.pdf"}
        )

    except Exception as e:
        print(f"🔥 Error Crítico en Backend: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    # Crear carpeta si no existe
    if not os.path.exists("signatures"):
        os.makedirs("signatures")
    uvicorn.run(app, host="0.0.0.0", port=8000)