import hashlib
import json
import os

def calculate_file_hash(filepath):
    """Calcula el SHA256 de un archivo."""
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        # Leer en bloques para eficiencia
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def register_user(user_id, image_filename):
    signatures_dir = "signatures"
    image_path = os.path.join(signatures_dir, image_filename)
    
    if not os.path.exists(image_path):
        print(f"❌ Error: No existe la imagen {image_path}")
        return

    # 1. Calcular Hash
    print(f"📸 Calculando huella digital de {image_filename}...")
    img_hash = calculate_file_hash(image_path)
    print(f"🔑 Hash calculado: {img_hash}")

    # 2. Cargar DB actual
    db_file = "users_db.json"
    if os.path.exists(db_file):
        with open(db_file, 'r') as f:
            db = json.load(f)
    else:
        db = {}

    # 3. Guardar registro
    db[user_id] = {
        "image_filename": image_filename,
        "image_hash": img_hash,
        "registered_at": "2024-11-28"
    }

    with open(db_file, 'w') as f:
        json.dump(db, f, indent=4)

    print(f"✅ Usuario {user_id} registrado exitosamente en {db_file}")

if __name__ == "__main__":
    # Asegúrate de que exista la carpeta signatures y la imagen
    if not os.path.exists("signatures"):
        os.makedirs("signatures")
        print("⚠️ Carpeta 'signatures' creada. Pon tu imagen ahí antes de correr esto.")
    else:
        # CAMBIA ESTO POR TU USUARIO REAL SI ES NECESARIO
        register_user("usuario_ejemplo_123", "usuario_ejemplo_123.png")