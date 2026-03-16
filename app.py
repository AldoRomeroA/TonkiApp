from flask import Flask, render_template, redirect, url_for, request, flash, session, send_file
from stellar_sdk import Server, Keypair, TransactionBuilder, Network, Asset
from extensions import db
from config import get_db_uri
import os
from sqlalchemy import func
from functools import wraps
import qrcode
import io
import base64
import bcrypt
import uuid
import json
from datetime import datetime, timezone

from admin_dashboard.models import User, Reward, AirdropConfig, AirdropLog, Credential, Establishment
import admin_dashboard.stellar_config

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = get_db_uri()
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.secret_key = os.urandom(24)

# Opciones para evitar "MySQL server has gone away"
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    "pool_pre_ping": True,       # verifica que la conexión esté viva
    "pool_recycle": 1800,        # recicla conexiones cada 30 min
    "pool_size": 5,              # tamaño del pool
    "max_overflow": 10,          # conexiones extra permitidas
    "pool_timeout": 30           # tiempo máximo de espera
}

db.init_app(app)

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

@app.route('/', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password'].encode('utf-8')

        cred = Credential.query.filter_by(username=username).first()
        if cred and bcrypt.checkpw(password, cred.password_hash.encode('utf-8')):
            session['user_id'] = cred.user_id
            session['username'] = cred.username

            usuario = User.query.filter_by(user_id=cred.user_id).first()
            if usuario.type == "admin":
                flash("Bienvenido administrador", "success")
                return redirect(url_for('dashboard_admin'))
            else:
                flash("Bienvenido cliente", "success")
                return redirect(url_for('dashboard_cliente'))
        else:
            flash("Usuario o contraseña incorrectos", "danger")
            return redirect(url_for('login'))

    return render_template('login/login.html')

@app.route('/dashboard_admin')
@login_required(role="admin")
def dashboard_admin():
    return render_template('admin_dashboard/admin_dashboard.html')

@app.route('/dashboard_cliente')
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
                func.sum(Reward.points).label("total_puntos")
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
                config = AirdropConfig.query.filter_by(user_id=est.admin_id)\
                                            .order_by(AirdropConfig.created_at.desc()).first()
                if config:
                    fecha_airdrop = config.scheduled_date

        historial = (
            db.session.query(
                Reward.title,
                Reward.description,
                Reward.points,
                Reward.created_at,
                Establishment.name.label("establecimiento")
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
            historial=historial
        )
    except Exception as e:
        flash(f"Error al cargar dashboard: {str(e)}", "danger")
        return render_template("user_dashboard/user_dashboard.html",
                               max_puntos=0, establecimiento=None, fecha_airdrop=None, historial=[])

@app.route('/logout')
def logout():
    session.clear()
    flash("Has cerrado sesión correctamente", "success")
    return redirect(url_for('login'))

@app.route('/user_qr_data')
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

@app.route('/assign_points', methods=['GET', 'POST'])
@login_required(role="admin")
def assign_points():
    if request.method == 'POST':
        try:
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
                points=puntos
            )
            db.session.add(recompensa)
            db.session.commit()

            flash("Puntos asignados correctamente", "success")
            return redirect(url_for('dashboard_admin'))
        except Exception as e:
            flash(f"Error al asignar puntos: {str(e)}", "danger")
            return redirect(url_for('dashboard_admin'))

    establecimientos = Establishment.query.all()
    return render_template("admin_dashboard/assign_points.html", establecimientos=establecimientos)

"""@app.route('/send_airdrop')
@login_required(role="admin")
def send_airdrop():
    try:
        # Total de puntos acumulados en la plataforma
        total_puntos = db.session.query(func.coalesce(func.sum(Reward.points), 0)).scalar()

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
            .order_by(func.sum(Reward.points).desc())
            .all()
        )

        # Configuración de Stellar
        server = Server(admin_dashboard.stellar_config.STELLAR_HORIZON)
        source_keypair = Keypair.from_secret(admin_dashboard.stellar_config.STELLAR_SECRET)
        source_public_key = source_keypair.public_key
        source_account = server.load_account(source_public_key)
        account_data = server.accounts().account_id(source_public_key).call()
        balance = account_data['balances'][0]['balance']

        # Fondo total a repartir (ejemplo: 1000 XLM)
        fondo_total = 1000.0

        # Construcción de la transacción con múltiples operaciones
        transaction_builder = TransactionBuilder(
            source_account=source_account,
            network_passphrase=Network.TESTNET_NETWORK_PASSPHRASE,
            base_fee=100
        )

        for u in usuarios:
            if u.Wallet:  # Solo si el usuario tiene wallet registrada
                monto = (u.porcentaje_fondo / 100.0) * fondo_total
                monto_str = f"{monto:.7f}"  # Stellar requiere 7 decimales
                transaction_builder.append_payment_op(
                    destination=u.Wallet,
                    asset=Asset.native(),
                    amount=monto_str
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
            'admin_dashboard/admin_airdrop.html',
            usuarios=usuarios,
            balance=balance,
            source_public_key=source_public_key
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
        source_keypair = Keypair.from_secret(admin_dashboard.stellar_config.STELLAR_SECRET)
        source_public_key = source_keypair.public_key
        source_account = server.load_account(source_public_key)
        account_data = server.accounts().account_id(source_public_key).call()
        balance = account_data['balances'][0]['balance']

        # Fondo total a repartir
        fondo_total = float(config.amount) if config and config.amount else 100.0

        # Construcción de la transacción
        transaction_builder = TransactionBuilder(
            source_account=source_account,
            network_passphrase=Network.TESTNET_NETWORK_PASSPHRASE,
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


@app.route('/admin_airdrop')
@login_required(role="admin")
def show_airdrop_page():
    try:
        # Total de puntos acumulados
        total_puntos = db.session.query(func.coalesce(func.sum(Reward.points), 0)).scalar()

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
                (func.coalesce(func.sum(Reward.points), 0) * 100.0 / total_puntos).label("porcentaje_fondo")
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

        # Datos de la wallet del admin
        server = Server(admin_dashboard.stellar_config.STELLAR_HORIZON)
        source_keypair = Keypair.from_secret(admin_dashboard.stellar_config.STELLAR_SECRET)
        source_public_key = source_keypair.public_key
        account_data = server.accounts().account_id(source_public_key).call()
        balance = account_data['balances'][0]['balance']

        return render_template(
            'admin_dashboard/admin_airdrop.html',
            usuarios=usuarios,
            balance=balance,
            source_public_key=source_public_key
        )
    except Exception as e:
        print(f"Error al conectar con la base de datos: {str(e)}")
        flash(f'Error al conectar con la base de datos: {str(e)}', 'danger')
        return render_template('admin_dashboard/admin_airdrop.html', usuarios=[])


@app.route('/configure_airdrop', methods=['GET', 'POST'])
@login_required(role="admin")
def configure_airdrop():
    if request.method == 'POST':
        try:
            amount = float(request.form['monto'])
            scheduled_date = request.form['fecha']
            periodicity = int(request.form['periodicidad'])
            max_users = int(request.form['usuarios'])

            # Recuperar el usuario actual desde la sesión
            user_id = session.get("user_id")
            if not user_id:
                flash("Debes iniciar sesión como administrador", "danger")
                return redirect(url_for("login"))

            # Si ya existe configuración, actualiza la última
            config = AirdropConfig.query.filter_by(user_id=user_id)\
                                        .order_by(AirdropConfig.created_at.desc()).first()
            if config:
                config.amount = amount
                config.scheduled_date = scheduled_date
                config.periodicity_months = periodicity
                config.max_users = max_users
            else:
                config = AirdropConfig(
                    user_id=user_id,   # aquí asignamos el admin dueño
                    amount=amount,
                    scheduled_date=scheduled_date,
                    periodicity_months=periodicity,
                    max_users=max_users
                )
                db.session.add(config)

            db.session.commit()
            flash("Configuración guardada correctamente", "success")
            return redirect(url_for('show_airdrop_page'))
        except Exception as e:
            flash(f"Error al guardar configuración: {str(e)}", "danger")
            return redirect(url_for('show_airdrop_page'))

    # GET → mostrar formulario con datos si existen
    user_id = session.get("user_id")
    config = None
    if user_id:
        config = AirdropConfig.query.filter_by(user_id=user_id)\
                                    .order_by(AirdropConfig.created_at.desc()).first()
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



if __name__ == '__main__':
    app.run(debug=True)
