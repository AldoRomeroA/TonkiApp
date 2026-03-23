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
from sqlalchemy import func, desc
from stellar_sdk import Asset, Keypair, Network, Server, TransactionBuilder
import uuid
import json
from datetime import datetime, timezone

import admin_dashboard.stellar_config

from admin_dashboard.models import (
    AirdropConfig,
    AirdropLog,
    Credential,
    Establishment,
    EtherfuseProfile,
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

from config import ETHERFUSE_API_KEY, ETHERFUSE_IS_SANDBOX, get_db_uri
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


@app.route("/register_user", methods=["GET"])
def render_create_user():
    return render_template("login/new_user_registration.html")


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
    admin_id = session.get("user_id")

    # Establecimiento del admin actual
    establishment = Establishment.query.filter_by(admin_id=admin_id).first()

    # Usuarios con recompensas en el establecimiento
    usuarios = (
        db.session.query(User)
        .join(Reward, User.user_id == Reward.user_id)
        .filter(Reward.establishment_id == establishment.establishment_id)
        .all()
    )

    # Usuario con más puntos en el establecimiento
    usuario_top = (
        db.session.query(User.name, func.sum(Reward.points).label("total_puntos"))
        .join(Reward, User.user_id == Reward.user_id)
        .filter(Reward.establishment_id == establishment.establishment_id)
        .group_by(User.user_id)
        .order_by(desc("total_puntos"))
        .first()
    )

    # Total de usuarios con puntos (>0)
    usuarios_con_puntos = (
        db.session.query(func.count(func.distinct(Reward.user_id)))
        .filter(Reward.establishment_id == establishment.establishment_id,
                Reward.points > 0)
        .scalar()
    )

    # Usuarios con wallet
    usuarios_con_wallet = (
        db.session.query(func.count(User.user_id))
        .filter(User.wallet_address.isnot(None))
        .scalar()
    )

    # Suma de todas las visitas (cada Reward cuenta como una visita)
    total_visitas = (
        db.session.query(func.count(Reward.reward_id))
        .filter(Reward.establishment_id == establishment.establishment_id)
        .scalar()
    )

    # Configuración de Airdrop del admin
    airdrop_config = (
        AirdropConfig.query.filter_by(user_id=admin_id).first()
    )

    # Lista de usuarios con sus puntos y fecha de último movimiento
    usuarios_lista = (
        db.session.query(User.name, User.updated_at, func.sum(Reward.points).label("tonkis"))
        .join(Reward, User.user_id == Reward.user_id)
        .filter(Reward.establishment_id == establishment.establishment_id)
        .group_by(User.user_id, User.name, User.updated_at)
        .order_by(desc("tonkis"))
        .all()
    )

    return render_template(
        "admin_dashboard/admin_dashboard.html",
        establichment_name=establishment.name,
        usuarios=usuarios,
        usuario_top=usuario_top,
        usuarios_con_puntos=usuarios_con_puntos,
        usuarios_con_wallet=usuarios_con_wallet,
        total_visitas=total_visitas,
        airdrop_config=airdrop_config,
        usuarios_lista=usuarios_lista,
    )


@app.route("/dashboard_cliente")
@login_required(role="cliente")
def dashboard_cliente():
    try:
        user_id = session.get("user_id")
        if not user_id:
            flash("Debes iniciar sesión como cliente", "danger")
            return redirect(url_for("login"))

        resultados = (
            db.session.query(
                Establishment.name.label("establecimiento"),
                func.sum(Reward.points).label("total_puntos"),
            )
            .join(Reward, Establishment.establishment_id == Reward.establishment_id)
            .filter(Reward.user_id == user_id)
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
            .join(Establishment, Reward.establishment_id == Establishment.establishment_id)
            .filter(Reward.user_id == user_id)
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


# ========== Etherfuse Ramp (MXN <-> crypto) ==========
def _get_ramp_user():
    uid = session.get("user_id")
    if not uid:
        return None
    return User.query.filter_by(user_id=uid).first()


def _get_or_create_etherfuse_profile(user):
    profile = EtherfuseProfile.query.filter_by(user_id=user.user_id).first()
    if profile:
        return profile
    return None


@app.route("/ramp")
@login_required(role="cliente")
def ramp_page():
    """Main ramp page: onboard if needed, else onramp/offramp options."""
    user = _get_ramp_user()
    if not user or not user.wallet_address:
        flash("Necesitas una wallet registrada para usar Ramp", "warning")
        return redirect(url_for("dashboard_cliente"))

    profile = _get_or_create_etherfuse_profile(user)
    stellar_assets = []
    assets_source = "none"
    try:
        if ETHERFUSE_API_KEY and user.wallet_address:
            import etherfuse_client as ef
            # Prefer GET /ramp/assets (wallet + mxn) — identifiers must match quote API
            try:
                stellar_assets = ef.get_rampable_stellar_assets_list(user.wallet_address)
                assets_source = "ramp_assets"
            except Exception as e1:
                print(f"[Etherfuse] get_rampable_assets fallback: {e1}")
                stellar_assets = ef.get_stellar_assets()
                assets_source = "stablebonds_fallback"
    except Exception as e:
        print(f"[Etherfuse] load assets: {e}")

    return render_template(
        "ramp/ramp.html",
        user=user,
        profile=profile,
        stellar_assets=stellar_assets,
        etherfuse_configured=bool(ETHERFUSE_API_KEY),
        is_sandbox=ETHERFUSE_IS_SANDBOX,
        assets_source=assets_source,
    )


@app.route("/ramp/onboard/start", methods=["POST"])
@login_required(role="cliente")
def ramp_onboard_start():
    """Generate Etherfuse onboarding URL, save profile, redirect to hosted KYC."""
    user = _get_ramp_user()
    if not user or not user.wallet_address:
        return jsonify({"error": "Wallet requerida"}), 400
    if not ETHERFUSE_API_KEY:
        return jsonify({"error": "Etherfuse no configurado"}), 503

    import etherfuse_client as ef

    customer_id = str(uuid.uuid4())
    bank_account_id = str(uuid.uuid4())

    try:
        data = ef.generate_onboarding_url(
            customer_id=customer_id,
            bank_account_id=bank_account_id,
            public_key=user.wallet_address,
            blockchain="stellar",
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    presigned_url = data.get("presigned_url")
    if not presigned_url:
        return jsonify({"error": "No presigned_url en respuesta"}), 500

    profile = EtherfuseProfile.query.filter_by(user_id=user.user_id).first()
    if not profile:
        profile = EtherfuseProfile(
            user_id=user.user_id,
            customer_id=customer_id,
            bank_account_id=bank_account_id,
        )
        db.session.add(profile)
    else:
        profile.customer_id = customer_id
        profile.bank_account_id = bank_account_id
    db.session.commit()

    return jsonify({"presigned_url": presigned_url})


@app.route("/ramp/order/<order_id>")
@login_required(role="cliente")
def ramp_order_status(order_id):
    """View order status and status page link."""
    if not ETHERFUSE_API_KEY:
        flash("Etherfuse no configurado", "warning")
        return redirect(url_for("ramp_page"))

    import etherfuse_client as ef

    try:
        order = ef.get_order(order_id)
    except Exception as e:
        flash(f"Error al obtener orden: {str(e)}", "danger")
        return redirect(url_for("ramp_page"))

    return render_template(
        "ramp/order_status.html",
        order=order,
        status_page=order.get("statusPage"),
        is_sandbox=ETHERFUSE_IS_SANDBOX,
    )


@app.route("/ramp/api/quote", methods=["POST"])
@login_required(role="cliente")
def ramp_api_quote():
    """Create quote for onramp or offramp."""
    user = _get_ramp_user()
    profile = _get_or_create_etherfuse_profile(user)
    if not profile or not profile.customer_id:
        return jsonify({"error": "Completa el onboarding primero"}), 400
    if not ETHERFUSE_API_KEY:
        return jsonify({"error": "Etherfuse no configurado"}), 503

    data = request.get_json() or {}
    quote_type = data.get("type")  # "onramp" | "offramp"
    source_asset = data.get("sourceAsset", "").strip()
    target_asset = data.get("targetAsset", "").strip()
    source_amount = data.get("sourceAmount", "").strip()

    if not all([quote_type, source_asset, target_asset, source_amount]):
        return jsonify({"error": "Faltan campos: type, sourceAsset, targetAsset, sourceAmount"}), 400
    if quote_type not in ("onramp", "offramp"):
        return jsonify({"error": "type debe ser onramp u offramp"}), 400

    # Etherfuse expects customerId as UUID (with hyphens)
    try:
        uuid.UUID(str(profile.customer_id))
    except (ValueError, TypeError):
        return jsonify(
            {"error": "customer_id inválido en perfil; vuelve a hacer onboarding."}
        ), 400

    import etherfuse_client as ef

    try:
        quote = ef.create_quote(
            customer_id=profile.customer_id,
            blockchain="stellar",
            quote_type=quote_type,
            source_asset=source_asset,
            target_asset=target_asset,
            source_amount=source_amount,
        )
    except Exception as e:
        msg = str(e)
        err = getattr(e, "response", None)
        if err and hasattr(err, "json"):
            try:
                body = err.json()
                msg = body.get("error", body.get("message", msg))
            except Exception:
                pass
        return jsonify({"error": msg}), 400

    return jsonify(quote)


@app.route("/ramp/api/order", methods=["POST"])
@login_required(role="cliente")
def ramp_api_order():
    """Create onramp or offramp order from quote."""
    user = _get_ramp_user()
    profile = _get_or_create_etherfuse_profile(user)
    if not profile or not profile.customer_id or not profile.bank_account_id:
        return jsonify({"error": "Completa el onboarding primero"}), 400

    # Fetch crypto_wallet_id from Etherfuse if missing
    import etherfuse_client as ef

    if not profile.crypto_wallet_id:
        wallets = ef.get_customer_wallets(profile.customer_id)
        for w in wallets:
            wid = w.get("walletId") or w.get("wallet_id") or w.get("id")
            pub = w.get("publicKey") or w.get("public_key")
            if pub == user.wallet_address or (w.get("blockchain") == "stellar" and wid):
                profile.crypto_wallet_id = wid
                db.session.commit()
                break
        if not profile.crypto_wallet_id and wallets:
            w = wallets[0]
            profile.crypto_wallet_id = w.get("walletId") or w.get("wallet_id") or w.get("id")
            db.session.commit()

    if not profile.crypto_wallet_id:
        return jsonify({"error": "Wallet no encontrada en Etherfuse. Completa el onboarding."}), 400
    if not ETHERFUSE_API_KEY:
        return jsonify({"error": "Etherfuse no configurado"}), 503

    data = request.get_json() or {}
    quote_id = data.get("quoteId", "").strip()
    use_anchor = data.get("useAnchor", False)

    if not quote_id:
        return jsonify({"error": "quoteId requerido"}), 400

    order_id = str(uuid.uuid4())

    try:
        order = ef.create_order(
            order_id=order_id,
            bank_account_id=profile.bank_account_id,
            crypto_wallet_id=profile.crypto_wallet_id,
            quote_id=quote_id,
            use_anchor=use_anchor,
        )
    except Exception as e:
        err = getattr(e, "response", None)
        msg = str(e)
        if err and hasattr(err, "json"):
            try:
                body = err.json()
                msg = body.get("error", body.get("message", msg))
            except Exception:
                pass
        return jsonify({"error": msg}), 400

    return jsonify(order)


@app.route("/ramp/api/simulate_fiat", methods=["POST"])
@login_required(role="cliente")
def ramp_api_simulate_fiat():
    """Sandbox only: simulate fiat deposit for onramp order."""
    if not ETHERFUSE_IS_SANDBOX:
        return jsonify({"error": "Solo disponible en sandbox"}), 400

    data = request.get_json() or {}
    order_id = data.get("orderId", "").strip()
    if not order_id:
        return jsonify({"error": "orderId requerido"}), 400

    import etherfuse_client as ef

    try:
        ef.simulate_fiat_received(order_id)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"ok": True})


@app.route("/user_qr_data")
@login_required(role="cliente")
def user_qr_data():
    user_id = session.get("user_id")
    qr_url = url_for("assign_points", user_id=user_id, _external=True)

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
            #id_usuario = request.form["id_usuario"]
            #puntos = int(request.form["puntos"])
            #titulo = request.form["titulo"]
            #descripcion = request.form["descripcion"]
            #id_establecimiento = request.form["id_establecimiento"]
            user_id = request.form['user_id']
            puntos = int(request.form['puntos'])
            titulo = request.form['titulo']
            descripcion = request.form['descripcion']
            id_establecimiento = request.form['id_establecimiento']

            recompensa = Reward(
                user_id=user_id,
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


"""@app.route('/send_airdrop')
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
        flash(f'Error en la transacción: {str(e)}', 'danger')
        return render_template('admin_dashboard/admin_airdrop.html', usuarios=[])"""

@app.route('/send_airdrop')
@login_required(role="admin")
def send_airdrop():
    try:
        # Total de puntos acumulados en la plataforma
        total_puntos = db.session.query(func.coalesce(func.sum(Reward.points), 0)).scalar()

        # Recuperar configuración del admin actual
        user_id = session.get("user_id")
        config = None
        if user_id:
            config = AirdropConfig.query.filter_by(user_id=user_id)\
                                        .order_by(AirdropConfig.created_at.desc()).first()

        # Recuperar establecimiento asociado al admin
        establecimiento = None
        if user_id:
            establecimiento = Establishment.query.filter_by(admin_id=user_id).first()

        # Consulta de usuarios con sus puntos y porcentaje del fondo
        usuarios = (
            db.session.query(
                User.user_id.label("ID"),
                User.name.label("Nombre"),
                User.wallet_address.label("Wallet"),
                func.coalesce(func.sum(Reward.points), 0).label("Tonkis"),
                (func.coalesce(func.sum(Reward.points), 0) * 100.0 / total_puntos).label("porcentaje_fondo")
            )
            .outerjoin(Reward, User.user_id == Reward.user_id)
            .group_by(User.user_id, User.name, User.wallet_address)
            .having(func.coalesce(func.sum(Reward.points), 0) >= 1)
            .filter(User.type != "admin")
            .order_by(func.sum(Reward.points).desc())
            .all()
        )

        # Configuración de Stellar
        server = Server(admin_dashboard.stellar_config.STELLAR_HORIZON)
        source_keypair = Keypair.from_secret(admin_dashboard.stellar_config.STELLAR_SECRET) # esto necesita ser solicitado por un formulario
        #antes del airdrip mostrar el formlario para poder enviar los datos
        # no guardar el secret
        source_public_key = source_keypair.public_key
        source_account = server.load_account(source_public_key)
        account_data = server.accounts().account_id(source_public_key).call()
        balance = account_data['balances'][0]['balance']

        # Fondo total a repartir
        fondo_total = float(config.amount) if config and config.amount else 100.0

        # Construcción de la transacción
        transaction_builder = TransactionBuilder(
            source_account=source_account,
            #network_passphrase = Network.TESTNET_NETWORK_PASSPHRASE,
            network_passphrase = Network.PUBLIC_NETWORK_PASSPHRASE,
            base_fee=100
        )

        total_enviado = 0.0
        for u in usuarios:
            destino = u.Wallet if u.Wallet else "GB6GI6BSNQ6MXYT6YNM6GWZKQNPMILPE7GIQ2FWDCVM2RPU6Z3XO4DPT"
            monto = (u.porcentaje_fondo / 100.0) * fondo_total
            total_enviado += monto
            monto_str = f"{monto:.7f}"
            transaction_builder.append_payment_op(
                destination=destino,
                asset=Asset.native(),
                amount=monto_str
            )

        transaction = transaction_builder.set_timeout(30).build()
        transaction.sign(source_keypair)

        response = server.submit_transaction(transaction)

        # Extraer datos de la respuesta
        tx_hash = response.get("hash")
        success = True if tx_hash else False
        error_message = None if success else str(response)
        response_json = json.dumps(response)

        # Guardar log en BD con user_id y establishment_id
        log = AirdropLog(
            log_id=str(uuid.uuid4().hex),
            config_id=config.config_id if config else None,
            transaction_hash=tx_hash,
            total_amount=round(total_enviado, 7),
            users_involved=len(usuarios),
            executed_at=datetime.now(timezone.utc),
            success=success,
            error_message=error_message,
            response_json=response_json,
            user_id=user_id,
            establishment_id=establecimiento.establishment_id if establecimiento else None
        )
        db.session.add(log)
        db.session.commit()

        if tx_hash:
            horizon_url = f"{admin_dashboard.stellar_config.STELLAR_HORIZON}/transactions/{tx_hash}"
            flash("Transacción enviada con éxito", "success")
            return render_template(
                'admin_dashboard/admin_airdrop.html',
                usuarios=usuarios,
                balance=balance,
                source_public_key=source_public_key,
                tx_hash=tx_hash,
                horizon_url=horizon_url,
                show_horizon_button=True
            )

        else:
            flash("Transacción ejecutada pero sin hash válido", "warning")
            return render_template(
                'admin_dashboard/admin_airdrop.html',
                usuarios=usuarios,
                balance=balance,
                source_public_key=source_public_key
            )

    except Exception as e:
        # Guardar log de error con user_id y establecimiento
        log = AirdropLog(
            log_id=str(uuid.uuid4().hex),
            config_id=config.config_id if config else None,
            transaction_hash=None,
            total_amount=fondo_total if config else 0,
            users_involved=len(usuarios) if 'usuarios' in locals() else 0,
            executed_at=datetime.now(timezone.utc),
            success=False,
            error_message=str(e),
            response_json=None,
            user_id=user_id if 'user_id' in locals() else None,
            establishment_id=establecimiento.establishment_id if 'establecimiento' in locals() and establecimiento else None
        )
        db.session.add(log)
        db.session.commit()

        flash(f"Error al enviar airdrop: {str(e)}", "danger")
        return redirect(url_for("show_airdrop_page"))


@app.route("/admin_airdrop")
@login_required(role="admin")
def show_airdrop_page():
    try:
        # Total de puntos acumulados
        total_puntos = db.session.query(
            func.coalesce(func.sum(Reward.points), 0)
        ).scalar()

        # Recuperar configuración del admin actual
        user_id = session.get("user_id")
        config = None
        if user_id:
            config = AirdropConfig.query.filter_by(user_id=user_id)\
                .order_by(AirdropConfig.created_at.desc()).first()

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
            .having(func.coalesce(func.sum(Reward.points), 0) >= 1)   # excluir usuarios con menos de 1 punto
            .filter(User.type != "admin")                             # excluir admins
            .order_by(func.sum(Reward.points).desc())
        )

        # Aplicar límite
        if config and config.max_users:
            usuarios = query.limit(config.max_users).all()
        else:
            usuarios = query.limit(10).all()   # si no hay config, máximo 10

        # Mensaje si no hay usuarios
        if not usuarios:
            flash("No hay usuarios registrados aún", "info")

        # Configuración de Airdrop del admin
        config = AirdropConfig.query.filter_by(user_id = user_id).first()

        if config:
            amount = config.amount
            scheduled_date = config.scheduled_date
            max_users = config.max_users
            periodicity_months = config.periodicity_months
        else:
            amount = 0
            scheduled_date = None
            max_users = 0
            periodicity_months = 0

        find_admin_wallet = User.query.filter_by(user_id = user_id).first()
        
        # Datos de la wallet del admin
        # como no vamos a requerir el secret del admin o establecimiento
        #Ya no se vera el balance ni nada relacionado a la cuenta

        """server = Server(admin_dashboard.stellar_config.STELLAR_HORIZON)
        source_keypair = Keypair.from_secret(
            admin_dashboard.stellar_config.STELLAR_SECRET
        )
        source_public_key = source_keypair.public_key
        account_data = server.accounts().account_id(source_public_key).call()
        balance = account_data["balances"][0]["balance"]"""



        return render_template(
            "admin_dashboard/admin_airdrop.html",
            usuarios=usuarios,
            amount=amount,
            source_public_key=find_admin_wallet.wallet_address,
            scheduled_date=scheduled_date,
            max_users=max_users,
            periodicity_months=periodicity_months
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

@app.route("/airdrop_history_ajax")
@login_required(role="admin")
def airdrop_history_ajax():
    logs = (
        db.session.query(AirdropLog)
        .order_by(AirdropLog.executed_at.desc())
        .all()
    )
    return render_template("admin_dashboard/airdrop_history.html", logs=logs)


@app.route("/validate_airdrop_secret", methods=["POST"])
@login_required(role="admin")
def validate_airdrop_secret():
    data = request.get_json()
    secret = data.get("secret")
    
    #try:
        # Build keypair from provided secret
        #source_keypair = Keypair.from_secret(secret)
        #source_public_key = source_keypair.public_key

        # Connect to Horizon (mainnet or testnet depending on config)
        #server = Server("https://horizon.stellar.org")  # mainnet
        #server = Server("https://horizon-testnet.stellar.org")
        #account_data = server.accounts().account_id(source_public_key).call()

        # Check if account has any balance
        #balances = account_data.get("balances", [])
        #if balances and float(balances[0]["balance"]) > 0:
        #    return jsonify({"valid": True})
        #else:
        #    return jsonify({"valid": False})
    #except Exception:
    #    return jsonify({"valid": False})




if __name__ == "__main__":
    app.run(debug=True)
