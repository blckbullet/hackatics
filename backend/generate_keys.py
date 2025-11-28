from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

# Generar llave privada
private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

# Guardar llave privada con contraseña "1234"
pem = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.BestAvailableEncryption(b"1234")
)

with open("mi_llave_prueba.pem", "wb") as f:
    f.write(pem)

print("Llave 'mi_llave_prueba.pem' generada. Contraseña: 1234")