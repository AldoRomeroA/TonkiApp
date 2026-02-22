from flask import Flask, render_template, redirect, url_for, request, flash, session, send_file
from stellar_sdk import Server, Keypair, TransactionBuilder, Network, Asset
from extensions import db
from config import get_db_uri
import os
from sqlalchemy import func
from werkzeug.security import check_password_hash
from functools import wraps
import qrcode
import io
import base64


app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = get_db_uri()
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.secret_key = os.urandom(24) 

db.init_app(app)
#with app.app_context():
#    db.create_all()


from admin_dashboard.models import Usuario, Recompensa, AirdropConfig, AirdropLog, Credencial, Establecimiento
import admin_dashboard.stellar_config


def login_required(role="any"):
    def wrapper(fn):
        @wraps(fn)
        def decorated_view(*args, **kwargs):
            if "user_id" not in session:
                flash("Debes iniciar sesión primero", "warning")
                return redirect(url_for("login"))

            usuario = Usuario.query.filter_by(id_usuario=session["user_id"]).first()
            if not usuario:
                flash("Usuario no encontrado", "danger")
                return redirect(url_for("login"))

            if role != "any" and usuario.tipo != role:
                flash("No tienes permisos para acceder a esta página", "danger")
                return redirect(url_for("dashboard_cliente"))

            return fn(*args, **kwargs)
        return decorated_view
    return wrapper

@app.route('/configure_airdrop', methods=['GET', 'POST'])
@login_required(role="admin")
def configure_airdrop():
    if request.method == 'POST':
        try:
            monto = float(request.form['monto'])
            fecha = request.form['fecha']
            periodicidad = int(request.form['periodicidad'])
            usuarios_max = int(request.form['usuarios'])

            # Recuperar el usuario actual desde la sesión
            id_usuario = session.get("user_id")
            if not id_usuario:
                flash("Debes iniciar sesión como administrador", "danger")
                return redirect(url_for("login"))

            # Si ya existe configuración, actualiza la última
            config = AirdropConfig.query.filter_by(id_usuario=id_usuario)\
                                        .order_by(AirdropConfig.creado_en.desc()).first()
            if config:
                config.monto = monto
                config.fecha_programada = fecha
                config.periodicidad_meses = periodicidad
                config.max_usuarios = usuarios_max
            else:
                config = AirdropConfig(
                    id_usuario=id_usuario,   # aquí asignamos el admin dueño
                    monto=monto,
                    fecha_programada=fecha,
                    periodicidad_meses=periodicidad,
                    max_usuarios=usuarios_max
                )
                db.session.add(config)

            db.session.commit()
            flash("Configuración guardada correctamente", "success")
            return redirect(url_for('show_airdrop_page'))
        except Exception as e:
            flash(f"Error al guardar configuración: {str(e)}", "danger")
            return redirect(url_for('show_airdrop_page'))

    # GET → mostrar formulario con datos si existen
    id_usuario = session.get("user_id")
    config = None
    if id_usuario:
        config = AirdropConfig.query.filter_by(id_usuario=id_usuario)\
                                    .order_by(AirdropConfig.creado_en.desc()).first()
    return render_template("admin_dashboard/admin_airdrop_config.html", config=config)

@app.route('/send_airdrop')
@login_required(role="admin")
def send_airdrop():
    try:
        total_puntos = db.session.query(func.coalesce(func.sum(Recompensa.puntos), 0)).scalar()

        usuarios = (
            db.session.query(
                Usuario.id_usuario.label("ID"),
                Usuario.nombre.label("Nombre"),
                Usuario.wallet_address.label("Wallet"),
                func.coalesce(func.sum(Recompensa.puntos), 0).label("Tonkis"),
                (func.coalesce(func.sum(Recompensa.puntos), 0) * 100.0 / total_puntos).label("porcentaje_fondo")
            )
            .outerjoin(Recompensa, Usuario.id_usuario == Recompensa.id_usuario)
            .group_by(Usuario.id_usuario, Usuario.nombre, Usuario.wallet_address)
            .order_by(func.sum(Recompensa.puntos).desc())
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
                # Redondear a 7 decimales como requiere Stellar
                monto_str = f"{monto:.7f}"
                transaction_builder.append_payment_op(
                    destination=u.Wallet,
                    asset=Asset.native(),
                    amount=monto_str
                )

        transaction = transaction_builder.set_timeout(30).build()
        transaction.sign(source_keypair)

        print(transaction.to_xdr())
        response = server.submit_transaction(transaction)

       # --- Mostrar el hash ---
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
        # Mostrar el error pero seguir mostrando el dashboard
        print(f"Error en la transacción: {str(e)}")
        flash(f'Error en la transacción: {str(e)}', 'danger')
        # Retornar dashboard vacío en caso de error
        return render_template('admin_dashboard/admin_airdrop.html', usuarios=[])


@app.route('/admin_airdrop')
@login_required(role="admin")
def show_airdrop_page():
    try:
        total_puntos = db.session.query(func.coalesce(func.sum(Recompensa.puntos), 0)).scalar()

        # Recuperar configuración del admin actual
        id_usuario = session.get("user_id")
        config = None
        if id_usuario:
            config = AirdropConfig.query.filter_by(id_usuario=id_usuario)\
                                        .order_by(AirdropConfig.creado_en.desc()).first()

        # Query base de usuarios con puntos
        query = (
            db.session.query(
                Usuario.id_usuario.label("ID"),
                Usuario.nombre.label("Nombre"),
                Usuario.wallet_address.label("Wallet"),
                func.coalesce(func.sum(Recompensa.puntos), 0).label("Tonkis"),
                (func.coalesce(func.sum(Recompensa.puntos), 0) * 100.0 / total_puntos).label("porcentaje_fondo")
            )
            .outerjoin(Recompensa, Usuario.id_usuario == Recompensa.id_usuario)
            .group_by(Usuario.id_usuario, Usuario.nombre, Usuario.wallet_address)
            .order_by(func.sum(Recompensa.puntos).desc())
        )

        # Aplicar límite si existe configuración
        if config and config.max_usuarios:
            usuarios = query.limit(config.max_usuarios).all()
        else:
            usuarios = query.all()

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



@app.route('/', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        cred = Credencial.query.filter_by(username=username).first()
        if cred and check_password_hash(cred.password_hash, password):
            session['user_id'] = cred.id_usuario
            session['username'] = cred.username

            usuario = Usuario.query.filter_by(id_usuario=cred.id_usuario).first()
            if usuario.tipo == "admin":
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

'''@app.route('/dashboard_cliente')
@login_required(role="cliente")
def dashboard_cliente():
    return render_template('cliente_dashboard/cliente_dashboard.html')'''

@app.route('/dashboard_cliente')
@login_required(role="cliente")
def dashboard_cliente():
    try:
        id_usuario = session.get("user_id")
        print(f"[DEBUG] id_usuario en sesión: {id_usuario}")

        if not id_usuario:
            flash("Debes iniciar sesión como cliente", "danger")
            return redirect(url_for("login"))

        # Consulta: puntos por establecimiento del cliente
        resultados = (
            db.session.query(
                Establecimiento.nombre.label("establecimiento"),
                func.sum(Recompensa.puntos).label("total_puntos")
            )
            .join(Recompensa, Establecimiento.id_establecimiento == Recompensa.id_establecimiento)
            .filter(Recompensa.id_usuario == id_usuario)
            .group_by(Establecimiento.nombre)
            .order_by(func.sum(Recompensa.puntos).desc())
            .all()
        )

        print(f"[DEBUG] resultados query puntos: {resultados}")

        max_puntos = 0
        establecimiento = None
        fecha_airdrop = None

        if resultados:
            max_puntos = resultados[0].total_puntos
            establecimiento = resultados[0].establecimiento
            print(f"[DEBUG] max_puntos: {max_puntos}, establecimiento: {establecimiento}")

            # Buscar configuración del admin de ese establecimiento
            est = Establecimiento.query.filter_by(nombre=establecimiento).first()
            print(f"[DEBUG] establecimiento encontrado: {est}")
            if est:
                config = AirdropConfig.query.filter_by(id_usuario=est.id_admin)\
                                            .order_by(AirdropConfig.creado_en.desc()).first()
                print(f"[DEBUG] config encontrada: {config}")
                if config:
                    fecha_airdrop = config.fecha_programada
                    print(f"[DEBUG] fecha_airdrop: {fecha_airdrop}")

        # Historial de visitas
        historial = (
            db.session.query(
                Recompensa.titulo,
                Recompensa.descripcion,
                Recompensa.puntos,
                Recompensa.creado_en,
                Establecimiento.nombre.label("establecimiento")
            )
            .join(Establecimiento, Recompensa.id_establecimiento == Establecimiento.id_establecimiento)
            .filter(Recompensa.id_usuario == id_usuario)
            .order_by(Recompensa.creado_en.asc())
            .all()
        )

        print(f"[DEBUG] historial de visitas: {historial}")

        return render_template(
            "user_dashboard/user_dashboard.html",
            max_puntos=max_puntos,
            establecimiento=establecimiento,
            fecha_airdrop=fecha_airdrop,
            historial=historial
        )
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        flash(f"Error al cargar dashboard: {str(e)}", "danger")
        return render_template("user_dashboard/user_dashboard.html",
                               max_puntos=0, establecimiento=None, fecha_airdrop=None, historial=[])

@app.route('/wallet-login', methods=['POST'])
def wallet_login():
    # Redirige al dashboard cuando se conecta con wallet
    return redirect('/dashboard')


@app.route('/dashboard')
@login_required(role="admin")
def dashboard():
    try:
        return render_template('admin_dashboard/admin_dashboard.html')
    except Exception as e:
        # Mostrar el error pero seguir mostrando el dashboard
        print(f"Error al conectar con la base de datos: {str(e)}")
        flash(f'Error al conectar con la base de datos: {str(e)}', 'danger')
        # Retornar dashboard vacío en caso de error
        return render_template('admin_dashboard/admin_dashboard.html')

@app.route('/logout')
def logout():
    # Eliminar todas las variables de sesión
    session.clear()
    flash("Has cerrado sesión correctamente", "success")
    return redirect(url_for('login'))

@app.route('/user_qr_data')
@login_required(role="cliente")
def user_qr_data():
    id_usuario = session.get("user_id")
    print(f"[DEBUG] Generando QR para usuario: {id_usuario}")

    # URL que el admin vería al escanear
    qr_url = url_for("assign_points", id_usuario=id_usuario, _external=True)
    print(f"[DEBUG] URL embebida en QR: {qr_url}")

    # Generar QR con esa URL
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
            id_usuario = request.form['id_usuario']   # viene del QR escaneado
            puntos = int(request.form['puntos'])
            titulo = request.form['titulo']
            descripcion = request.form['descripcion']
            id_establecimiento = request.form['id_establecimiento']

            recompensa = Recompensa(
                id_usuario=id_usuario,
                id_establecimiento=id_establecimiento,
                titulo=titulo,
                descripcion=descripcion,
                puntos=puntos
            )
            db.session.add(recompensa)
            db.session.commit()

            flash("Puntos asignados correctamente", "success")
            return redirect(url_for('dashboard_admin'))
        except Exception as e:
            flash(f"Error al asignar puntos: {str(e)}", "danger")
            return redirect(url_for('dashboard_admin'))

    # GET → mostrar formulario
    establecimientos = Establecimiento.query.all()
    return render_template("admin_dashboard/assign_points.html", establecimientos=establecimientos)

if __name__ == '__main__':
    app.run(debug=True)
    #app.run(ssl_context=("localhost+2.pem", "localhost+2-key.pem"))