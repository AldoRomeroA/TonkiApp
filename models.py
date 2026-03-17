from extensions import db
from datetime import datetime
import uuid

def generate_uuid():
    return uuid.uuid4().hex

class Usuario(db.Model):
    __tablename__ = 'usuarios'
    id_usuario = db.Column(db.String(32), primary_key=True, default=generate_uuid)
    correo = db.Column(db.String(100), unique=True, nullable=False)
    nombre = db.Column(db.String(100), nullable=False)
    wallet_address = db.Column(db.String(256), nullable=True)
    edad = db.Column(db.Integer)
    fecha_nacimiento = db.Column(db.Date)
    tipo = db.Column(db.String(100), nullable=False)
    creado_en = db.Column(db.DateTime, default=datetime.utcnow)

    recompensas = db.relationship("Recompensa", back_populates="usuario")
    credenciales = db.relationship("Credencial", back_populates="usuario")
    airdrops_config = db.relationship("AirdropConfig", back_populates="usuario")
    establecimientos = db.relationship("Establecimiento", back_populates="admin")


class Credencial(db.Model): 
    __tablename__ = 'credenciales'
    id_credencial = db.Column(db.String(32), primary_key=True, default=generate_uuid)
    id_usuario = db.Column(db.String(32), db.ForeignKey('usuarios.id_usuario'), nullable=False)
    username = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    creado_en = db.Column(db.DateTime, default=datetime.utcnow)

    usuario = db.relationship("Usuario", back_populates="credenciales")


class Recompensa(db.Model):
    __tablename__ = 'recompensas'
    id_recompensa = db.Column(db.String(32), primary_key=True, default=generate_uuid)
    id_usuario = db.Column(db.String(32), db.ForeignKey('usuarios.id_usuario'), nullable=False)
    id_establecimiento = db.Column(db.String(32), db.ForeignKey('establecimientos.id_establecimiento'), nullable=False)
    titulo = db.Column(db.String(150), nullable=False)
    descripcion = db.Column(db.Text)
    puntos = db.Column(db.Integer, default=0)
    creado_en = db.Column(db.DateTime, default=datetime.utcnow)

    usuario = db.relationship("Usuario", back_populates="recompensas")
    establecimiento = db.relationship("Establecimiento", back_populates="recompensas")



class AirdropConfig(db.Model):
    __tablename__ = 'airdrop_config'
    id = db.Column(db.String(32), primary_key=True, default=generate_uuid)
    id_usuario = db.Column(db.String(32), db.ForeignKey('usuarios.id_usuario'), nullable=False)
    monto = db.Column(db.Float, nullable=False)
    fecha_programada = db.Column(db.Date, nullable=False)
    periodicidad_meses = db.Column(db.Integer, nullable=False)
    max_usuarios = db.Column(db.Integer, nullable=False)
    creado_en = db.Column(db.DateTime, server_default=db.func.now())

    usuario = db.relationship("Usuario", back_populates="airdrops_config")
    logs = db.relationship("AirdropLog", back_populates="config")  # aquí defines la relación inversa


class AirdropLog(db.Model):
    __tablename__ = 'airdrop_log'
    id = db.Column(db.String(32), primary_key=True, default=generate_uuid)
    config_id = db.Column(db.String(32), db.ForeignKey('airdrop_config.id'), nullable=False)
    hash_transaccion = db.Column(db.String(100), nullable=True)
    monto_total = db.Column(db.Float, nullable=False)
    usuarios_involucrados = db.Column(db.Integer, nullable=False)
    fecha_ejecucion = db.Column(db.DateTime, server_default=db.func.now())
    exitoso = db.Column(db.Boolean, default=True)
    response_json = db.Column(db.Text, nullable=True)

    config = db.relationship("AirdropConfig", back_populates="logs")

class Establecimiento(db.Model):
    __tablename__ = 'establecimientos'
    id_establecimiento = db.Column(db.String(32), primary_key=True, default=generate_uuid)
    id_admin = db.Column(db.String(32), db.ForeignKey('usuarios.id_usuario'), nullable=False)
    nombre = db.Column(db.String(150), nullable=False)
    direccion = db.Column(db.String(255))
    creado_en = db.Column(db.DateTime, default=datetime.utcnow)

    admin = db.relationship("Usuario", back_populates="establecimientos")
    recompensas = db.relationship("Recompensa", back_populates="establecimiento")

