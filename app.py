import base64
import io
import os
import uuid
from functools import wraps

import bcrypt
import qrcode
from flask import (
    Flask,
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    send_file,
    session,
    url_for,
)
from flask_mail import Mail, Message
from sqlalchemy import func
from stellar_sdk import Asset, Keypair, Network, Server, TransactionBuilder

import admin_dashboard.stellar_config
from admin_dashboard.models import (
    AirdropConfig,
    AirdropLog,
    Credential,
    Establishment,
    Reward,
    User,
)
from app_utils import (
    generate_keypair,
    generate_uuid,
    hash_password,
    mnemonic_phrase,
    send_security_email,
)
from config import get_db_uri
from DB_logic import check_email_exists_db, create_credentials_db, create_user_db
from extensions import db

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = get_db_uri()
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.secret_key = os.urandom(24)

app.config["MAIL_SERVER"] = "smtp.hostinger.com"
app.config["MAIL_PORT"] = 465
app.config["MAIL_USE_TLS"] = False
app.config["MAIL_USE_SSL"] = True
app.config["MAIL_USERNAME"] = "support@tonki.io"
app.config["MAIL_PASSWORD"] = "2026@A.Arroyo"
app.config["MAIL_DEFAULT_SENDER"] = "support@tonki.io"
app.config["MAIL_DEBUG"] = True

# Opciones para evitar "MySQL server has gone away"
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_pre_ping": True,  # verifica que la conexión esté viva
    "pool_recycle": 1800,  # recicla conexiones cada 30 min
    "pool_size": 5,  # tamaño del pool
    "max_overflow": 10,  # conexiones extra permitidas
    "pool_timeout": 30,  # tiempo máximo de espera
}

db.init_app(app)
mail = Mail(app)


def login_required(role="any"):
    def wrapper(fn):
        @wraps(fn)
        def decorated_view(*args, **kwargs):
            if "user_id" not in session:
                flash("Debes iniciar sesión primero", "warning")
                return redirect(url_for("login"))

            usuario = User.query.filter_by(user_id=session["user_id"]).first()
            if not usuario:
                flash("Usuario no encontrado", "danger")
                return redirect(url_for("login"))

            if role != "any" and usuario.type != role:
                flash("No tienes permisos para acceder a esta página", "danger")
                return redirect(url_for("dashboard_cliente"))

            return fn(*args, **kwargs)

        return decorated_view

    return wrapper


@app.route("/render_create_user", methods=["GET"])
def render_create_user():
    return render_template("new_user_registration/new_user_registration.html")


@app.route("/create_user", methods=["POST"])
def create_user():
    data = request.get_json()
    email_check = check_email_exists_db(data.get("email"))

    if (
        not data
        or not data.get("name")
        or not data.get("email")
        or not data.get("password")
    ):
        return jsonify({"error": "Faltan campos requeridos"}), 400

    if len(data.get("password")) < 7:
        return jsonify(
            {"error": "Contraseña demasiado corta", "details": "Mínimo 8 caracteres"}
        ), 400

    if email_check["exists"]:
        return jsonify(
            {"error": "Correo en uso", "details": email_check["message"]}
        ), 400

    user_uuid = generate_uuid()
    user_name = data.get("name")
    user_email = data.get("email")
    user_mnemonic = mnemonic_phrase()
    user_keys = generate_keypair(user_mnemonic)
    password_bytes = data.get("password").encode("utf-8")

    password_str = data.get("password")
    password_bytes = password_str.encode("utf-8")
    user_passwd = hash_password(password_bytes)

    user_result = create_user_db(
        user_uuid=user_uuid,
        user_email=user_email,
        user_name=user_name,
        wallet_address=user_keys["Public_key"],
    )

    if not user_result["success"]:
        return jsonify(
            {
                "error": "Error al crear usuario en la base de datos",
                "details": user_result["message"],
            }
        ), 400

    cred_result = create_credentials_db(
        user_uuid=user_uuid, username=user_email, password_hash=user_passwd
    )

    if not cred_result["success"]:
        # Rollback manual
        db.session.delete(user_result["user"])
        db.session.commit()
        return jsonify(
            {"error": cred_result["message"], "details": cred_result["message"]}
        ), 400

    try:
        send_security_email(
            mail_obj=mail,
            user_email=user_email,
            user_name=user_name,
            public_key=user_keys["Public_key"],
            private_key=user_keys["Private_key"],
            mnemonic=user_mnemonic,
        )
    except Exception as e:
        print(f"Error enviando correo: {e}")

    return jsonify(
        {
            "success": True,
            "message": "Usuario creado con exito y correo enviado",
            "user_uuid": user_uuid,
            "username": user_name,
            "user_email": user_email,
            "mnemonic": user_mnemonic,
            "user_keys": user_keys,
        }
    ), 201


@app.route("/", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"].encode("utf-8")

        cred = Credential.query.filter_by(username=username).first()
        if cred and bcrypt.checkpw(password, cred.password_hash.encode("utf-8")):
            session["user_id"] = cred.user_id
            session["username"] = cred.username

            usuario = User.query.filter_by(user_id=cred.user_id).first()
            if usuario.type == "admin":
                flash("Bienvenido administrador", "success")
                return redirect(url_for("dashboard_admin"))
            else:
                flash("Bienvenido cliente", "success")
                return redirect(url_for("dashboard_cliente"))
        else:
            flash("Usuario o contraseña incorrectos", "danger")
            return redirect(url_for("login"))

    return render_template("login/login.html")


@app.route("/dashboard_admin")
@login_required(role="admin")
def dashboard_admin():
    return render_template("admin_dashboard/admin_dashboard.html")


@app.route("/dashboard_cliente")
@login_required(role="cliente")
def dashboard_cliente():
    try:
        id_usuario = session.get("user_id")
        if not id_usuario:
            flash("Debes iniciar sesión como cliente", "danger")
            return redirect(url_for("login"))

        resultados = (
            db.session.query(
                Establishment.name.label("establecimiento"),
                func.sum(Reward.points).label("total_puntos"),
            )
            .join(Reward, Establishment.establishment_id == Reward.establishment_id)
            .filter(Reward.user_id == id_usuario)
            .group_by(Establishment.name)
            .order_by(func.sum(Reward.points).desc())
            .all()
        )

        max_puntos = 0
        establecimiento = None
        fecha_airdrop = None

        if resultados:
            max_puntos = resultados[0].total_puntos
            establecimiento = resultados[0].establecimiento

            est = Establishment.query.filter_by(name=establecimiento).first()
            if est:
                config = (
                    AirdropConfig.query.filter_by(user_id=est.admin_id)
                    .order_by(AirdropConfig.created_at.desc())
                    .first()
                )
                if config:
                    fecha_airdrop = config.scheduled_date

        historial = (
            db.session.query(
                Reward.title,
                Reward.description,
                Reward.points,
                Reward.created_at,
                Establishment.name.label("establecimiento"),
            )
            .join(
                Establishment, Reward.establishment_id == Establishment.establishment_id
            )
            .filter(Reward.user_id == id_usuario)
            .order_by(Reward.created_at.asc())
            .all()
        )

        return render_template(
            "user_dashboard/user_dashboard.html",
            max_puntos=max_puntos,
            establecimiento=establecimiento,
            fecha_airdrop=fecha_airdrop,
            historial=historial,
        )
    except Exception as e:
        flash(f"Error al cargar dashboard: {str(e)}", "danger")
        return render_template(
            "user_dashboard/user_dashboard.html",
            max_puntos=0,
            establecimiento=None,
            fecha_airdrop=None,
            historial=[],
        )


@app.route("/logout")
def logout():
    session.clear()
    flash("Has cerrado sesión correctamente", "success")
    return redirect(url_for("login"))


@app.route("/user_qr_data")
@login_required(role="cliente")
def user_qr_data():
    id_usuario = session.get("user_id")
    qr_url = url_for("assign_points", id_usuario=id_usuario, _external=True)

    img = qrcode.make(qr_url)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    img_base64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    return {"qr_code": img_base64, "qr_url": qr_url}


@app.route("/assign_points", methods=["GET", "POST"])
@login_required(role="admin")
def assign_points():
    if request.method == "POST":
        try:
            id_usuario = request.form["id_usuario"]
            puntos = int(request.form["puntos"])
            titulo = request.form["titulo"]
            descripcion = request.form["descripcion"]
            id_establecimiento = request.form["id_establecimiento"]

            recompensa = Reward(
                user_id=id_usuario,
                establishment_id=id_establecimiento,
                title=titulo,
                description=descripcion,
                points=puntos,
            )
            db.session.add(recompensa)
            db.session.commit()

            flash("Puntos asignados correctamente", "success")
            return redirect(url_for("dashboard_admin"))
        except Exception as e:
            flash(f"Error al asignar puntos: {str(e)}", "danger")
            return redirect(url_for("dashboard_admin"))

    establecimientos = Establishment.query.all()
    return render_template(
        "admin_dashboard/assign_points.html", establecimientos=establecimientos
    )


@app.route("/send_airdrop")
@login_required(role="admin")
def send_airdrop():
    try:
        # Total de puntos acumulados en la plataforma
        total_puntos = db.session.query(
            func.coalesce(func.sum(Reward.points), 0)
        ).scalar()

        # Consulta de usuarios con sus puntos y porcentaje del fondo
        usuarios = (
            db.session.query(
                User.user_id.label("ID"),
                User.name.label("Nombre"),
                User.wallet_address.label("Wallet"),
                func.coalesce(func.sum(Reward.points), 0).label("Tonkis"),
                (
                    func.coalesce(func.sum(Reward.points), 0) * 100.0 / total_puntos
                ).label("porcentaje_fondo"),
            )
            .outerjoin(Reward, User.user_id == Reward.user_id)
            .group_by(User.user_id, User.name, User.wallet_address)
            .order_by(func.sum(Reward.points).desc())
            .all()
        )

        # Configuración de Stellar
        server = Server(admin_dashboard.stellar_config.STELLAR_HORIZON)
        source_keypair = Keypair.from_secret(
            admin_dashboard.stellar_config.STELLAR_SECRET
        )
        source_public_key = source_keypair.public_key
        source_account = server.load_account(source_public_key)
        account_data = server.accounts().account_id(source_public_key).call()
        balance = account_data["balances"][0]["balance"]

        # Fondo total a repartir (ejemplo: 1000 XLM)
        fondo_total = 1000.0

        # Construcción de la transacción con múltiples operaciones
        transaction_builder = TransactionBuilder(
            source_account=source_account,
            network_passphrase=Network.TESTNET_NETWORK_PASSPHRASE,
            base_fee=100,
        )

        for u in usuarios:
            if u.Wallet:  # Solo si el usuario tiene wallet registrada
                monto = (u.porcentaje_fondo / 100.0) * fondo_total
                monto_str = f"{monto:.7f}"  # Stellar requiere 7 decimales
                transaction_builder.append_payment_op(
                    destination=u.Wallet, asset=Asset.native(), amount=monto_str
                )

        # Construir y firmar la transacción
        transaction = transaction_builder.set_timeout(30).build()
        transaction.sign(source_keypair)

        print(transaction.to_xdr())
        response = server.submit_transaction(transaction)

        # Mostrar el hash de la transacción
        tx_hash = response.get("hash")
        if tx_hash:
            flash(f"Transacción enviada con hash: {tx_hash}", "success")
        else:
            flash("Transacción exitosa", "success")

        return render_template(
            "admin_dashboard/admin_airdrop.html",
            usuarios=usuarios,
            balance=balance,
            source_public_key=source_public_key,
        )

    except Exception as e:
        print(f"Error en la transacción: {str(e)}")
        flash(f"Error en la transacción: {str(e)}", "danger")
        return render_template("admin_dashboard/admin_airdrop.html", usuarios=[])


@app.route("/admin_airdrop")
@login_required(role="admin")
def show_airdrop_page():
    try:
        # Total de puntos acumulados
        total_puntos = db.session.query(
            func.coalesce(func.sum(Reward.points), 0)
        ).scalar()

        # Recuperar configuración del admin actual
        id_usuario = session.get("user_id")
        config = None
        if id_usuario:
            config = (
                AirdropConfig.query.filter_by(user_id=id_usuario)
                .order_by(AirdropConfig.created_at.desc())
                .first()
            )

        # Query base de usuarios con puntos y porcentaje del fondo
        query = (
            db.session.query(
                User.user_id.label("ID"),
                User.name.label("Nombre"),
                User.wallet_address.label("Wallet"),
                func.coalesce(func.sum(Reward.points), 0).label("Tonkis"),
                (
                    func.coalesce(func.sum(Reward.points), 0) * 100.0 / total_puntos
                ).label("porcentaje_fondo"),
            )
            .outerjoin(Reward, User.user_id == Reward.user_id)
            .group_by(User.user_id, User.name, User.wallet_address)
            .order_by(func.sum(Reward.points).desc())
        )

        # Aplicar límite si existe configuración
        if config and config.max_users:
            usuarios = query.limit(config.max_users).all()
        else:
            usuarios = query.all()

        # Mensaje si no hay usuarios
        if not usuarios:
            flash("No hay usuarios registrados aún", "info")

        # Datos de la wallet del admin
        server = Server(admin_dashboard.stellar_config.STELLAR_HORIZON)
        source_keypair = Keypair.from_secret(
            admin_dashboard.stellar_config.STELLAR_SECRET
        )
        source_public_key = source_keypair.public_key
        account_data = server.accounts().account_id(source_public_key).call()
        balance = account_data["balances"][0]["balance"]

        return render_template(
            "admin_dashboard/admin_airdrop.html",
            usuarios=usuarios,
            balance=balance,
            source_public_key=source_public_key,
        )
    except Exception as e:
        print(f"Error al conectar con la base de datos: {str(e)}")
        flash(f"Error al conectar con la base de datos: {str(e)}", "danger")
        return render_template("admin_dashboard/admin_airdrop.html", usuarios=[])


@app.route("/configure_airdrop", methods=["GET", "POST"])
@login_required(role="admin")
def configure_airdrop():
    if request.method == "POST":
        try:
            amount = float(request.form["monto"])
            scheduled_date = request.form["fecha"]
            periodicity = int(request.form["periodicidad"])
            max_users = int(request.form["usuarios"])

            # Recuperar el usuario actual desde la sesión
            user_id = session.get("user_id")
            if not user_id:
                flash("Debes iniciar sesión como administrador", "danger")
                return redirect(url_for("login"))

            # Si ya existe configuración, actualiza la última
            config = (
                AirdropConfig.query.filter_by(user_id=user_id)
                .order_by(AirdropConfig.created_at.desc())
                .first()
            )
            if config:
                config.amount = amount
                config.scheduled_date = scheduled_date
                config.periodicity_months = periodicity
                config.max_users = max_users
            else:
                config = AirdropConfig(
                    user_id=user_id,  # aquí asignamos el admin dueño
                    amount=amount,
                    scheduled_date=scheduled_date,
                    periodicity_months=periodicity,
                    max_users=max_users,
                )
                db.session.add(config)

            db.session.commit()
            flash("Configuración guardada correctamente", "success")
            return redirect(url_for("show_airdrop_page"))
        except Exception as e:
            flash(f"Error al guardar configuración: {str(e)}", "danger")
            return redirect(url_for("show_airdrop_page"))

    # GET → mostrar formulario con datos si existen
    user_id = session.get("user_id")
    config = None
    if user_id:
        config = (
            AirdropConfig.query.filter_by(user_id=user_id)
            .order_by(AirdropConfig.created_at.desc())
            .first()
        )
    return render_template("admin_dashboard/admin_airdrop_config.html", config=config)


if __name__ == "__main__":
    app.run(debug=True)
