from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import SQLAlchemyError

from admin_dashboard.models import Credential, User
from app_utils import generate_uuid
from extensions import db


def create_user_db(
    user_uuid: str,
    user_email: str,
    user_name: str,
    wallet_address: str,
):
    try:
        new_user = User()
        new_user.user_id = user_uuid
        new_user.email = user_email
        new_user.name = user_name
        new_user.wallet_address = wallet_address

        db.session.add(new_user)
        db.session.commit()

        return {
            "success": True,
            "user": new_user,
            "message": "usuario creado con exito",
        }

    except SQLAlchemyError as e:
        db.session.rollback()
        return {"success": False, "message": e}


def create_credentials_db(user_uuid: str, username: str, password_hash: bytes):
    try:
        new_credential = Credential()
        new_credential.credential_id = generate_uuid()
        new_credential.user_id = user_uuid
        new_credential.username = username
        new_credential.password_hash = password_hash
        db.session.add(new_credential)
        db.session.commit()

        return {
            "success": True,
            "credential": new_credential,
            "message": "credenciales creadas con exito",
        }

    except SQLAlchemyError as e:
        db.session.rollback()
        return {"success": False, "message": str(e)}


def check_email_exists_db(user_email: str):
    try:
        existing_email = User.query.filter_by(email=user_email).first()

        if existing_email:
            return {
                "success": True,
                "exists": True,
                "message": "El correo electrónico ya está registrado",
            }
        else:
            return {
                "success": True,
                "exists": False,
                "message": "El correo electrónico está disponible",
            }

    except SQLAlchemyError as e:
        return {"success": False, "message": str(e)}
