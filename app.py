from flask import Flask, render_template, redirect, url_for, request, flash
from stellar_sdk import Server, Keypair, TransactionBuilder, Network, Asset
from extensions import db
from config import get_db_uri
import os
from sqlalchemy import func

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = get_db_uri()
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.secret_key = os.urandom(24) 

db.init_app(app)

# Importa modelos después de init_app
from admin_dashboard.models import Usuario, Recompensa
import admin_dashboard.stellar_config

selected_users = {}


@app.route('/send_airdrop')
def send_airdrop():
    try:
        # Wallet destino
        wallet_destination = "GB6GI6BSNQ6MXYT6YNM6GWZKQNPMILPE7GIQ2FWDCVM2RPU6Z3XO4DPT"

        '''server = Server(admin_dashboard.stellar_config.STELLAR_HORIZON)
        source_keypair = Keypair.from_secret(admin_dashboard.stellar_config.STELLAR_SECRET)
        source_public_key = source_keypair.public_key

        # Verifica que coincida con tu STELLAR_PUBLIC
        source_account = server.load_account(source_public_key)

        account_data = server.accounts().account_id(source_public_key).call()

        transaction = (
            TransactionBuilder(
                source_account=source_account,
                network_passphrase=Network.TESTNET_NETWORK_PASSPHRASE,
                base_fee=100
            )
            .append_payment_op(
                destination=wallet_destination,
                asset=Asset.native(),
                amount="1.0000000"
            )
            .set_timeout(30)
            .build()
        )
        
        transaction.sign(source_keypair)
        print(transaction.to_xdr())
        response = server.submit_transaction(transaction)'''
        response = 1001

        flash(f'Error al conectar con la base de datos: {response}', 'success')
        return render_template('admin_dashboard/admin_airdrop.html', usuarios=selected_users)

    except Exception as e:
        # Mostrar el error pero seguir mostrando el dashboard
        print(f"Error en la transacción: {str(e)}")
        flash(f'Error en la transacción: {str(e)}', 'danger')
        # Retornar dashboard vacío en caso de error
        return render_template('admin_dashboard/admin_airdrop.html', usuarios=[])


@app.route('/admin_airdrop')
def show_airdrop_page():
    try:
        # Obtener todos los usuarios de la base de datos
        #usuarios = Usuario.query.all()
        #usuarios = Usuario.query.filter(Usuario.wallet_address.isnot(None)).all()
        total_puntos = db.session.query(func.coalesce(func.sum(Recompensa.puntos), 0)).scalar()

        usuarios = ( 
            db.session.query( 
                Usuario.id_usuario.label("ID"), 
                Usuario.nombre.label("Nombre"), 
                Usuario.wallet_address.label("Wallet"), 
                func.coalesce(func.sum(Recompensa.puntos), 0).label("Tonkis"), 
                (func.coalesce(func.sum(Recompensa.puntos), 0) * 100.0 / total_puntos)
                    .label("porcentaje_fondo") ) 
                    .outerjoin(Recompensa, Usuario.id_usuario == Recompensa.id_usuario) 
                    .group_by(Usuario.id_usuario, Usuario.nombre, Usuario.wallet_address) 
                    .order_by(func.sum(Recompensa.puntos).desc()) 
                .all() 
            )

        selected_users = usuarios

        server = Server(admin_dashboard.stellar_config.STELLAR_HORIZON)
        source_keypair = Keypair.from_secret(admin_dashboard.stellar_config.STELLAR_SECRET)
        source_public_key = source_keypair.public_key

        # Verifica que coincida con tu STELLAR_PUBLIC
        source_account = server.load_account(source_public_key)

        account_data = server.accounts().account_id(source_public_key).call()
        balance = account_data['balances'][0]['balance']

        return render_template('admin_dashboard/admin_airdrop.html', usuarios=usuarios, balance=balance, source_public_key=source_public_key)
    except Exception as e:
        # Mostrar el error pero seguir mostrando el dashboard
        print(f"Error al conectar con la base de datos: {str(e)}")
        flash(f'Error al conectar con la base de datos: {str(e)}', 'danger')
        # Retornar dashboard vacío en caso de error
        return render_template('admin_dashboard/admin_airdrop.html', usuarios=[])


@app.route('/', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        # Por ahora, cualquier intento de login redirige al dashboard
        return redirect('/dashboard')
    
    return render_template('login/login.html')

@app.route('/wallet-login', methods=['POST'])
def wallet_login():
    # Redirige al dashboard cuando se conecta con wallet
    return redirect('/dashboard')

@app.route('/dashboard')
def dashboard():
    try:
        return render_template('admin_dashboard/admin_dashboard.html')
    except Exception as e:
        # Mostrar el error pero seguir mostrando el dashboard
        print(f"Error al conectar con la base de datos: {str(e)}")
        flash(f'Error al conectar con la base de datos: {str(e)}', 'danger')
        # Retornar dashboard vacío en caso de error
        return render_template('admin_dashboard/admin_dashboard.html')

if __name__ == '__main__':
    app.run(debug=True)
    #app.run(ssl_context=("localhost+2.pem", "localhost+2-key.pem"))