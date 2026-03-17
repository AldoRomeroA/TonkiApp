import uuid
from typing import Dict

import bcrypt
from flask_mail import Mail, Message
from mnemonic import Mnemonic
from stellar_sdk import Keypair

# Asegúrate de tener 'mail' disponible aquí (ver punto 1)


def send_security_email(
    mail_obj, user_email, user_name, public_key, private_key, mnemonic
):
    msg = Message(
        "Registro Exitoso - Información de Seguridad Importante",
        sender="mariconaxel847@gmail.com",
        recipients=[user_email],
    )
    msg.body = f"""
    Hola {user_name},
    Tu cuenta ha sido creada con éxito. Aquí tienes tus credenciales de acceso seguro:
    - Dirección Pública (Wallet): {public_key}
    - Clave Privada: {private_key}
    - Frase de Recuperación (12 palabras): {mnemonic}
    IMPORTANTE: Nunca compartas estos datos con nadie...
    """

    try:
        mail_obj.send(msg)
        print(f"[ÉXITO] Correo enviado correctamente a {user_email}")
        return True
    except Exception as e:
        error_msg = f"[FALLO EMAIL] {type(e).__name__}: {str(e)} → a {user_email}"
        print(error_msg)
        # Opcional: loggear a archivo o servicio
        # import logging; logging.error(error_msg)
        return False


def generate_uuid() -> str:
    uuidc32 = uuid.uuid4().hex
    return uuidc32


def mnemonic_phrase() -> str:
    mnemo = Mnemonic("english")
    words = mnemo.generate(128)
    return words


def generate_keypair(mnemonic) -> Dict:
    keypair = Keypair.from_mnemonic_phrase(mnemonic)
    public = keypair.public_key
    private = keypair.secret
    user_keys = {"Public_key": public, "Private_key": private}
    return user_keys


# hash_password(b"example")
def hash_password(password: bytes) -> bytes:
    hashed_password = bcrypt.hashpw(password, bcrypt.gensalt())
    return hashed_password
