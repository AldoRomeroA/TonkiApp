from extensions import db
from datetime import datetime

class Usuario(db.Model):
    __tablename__ = 'usuarios'
    id_usuario = db.Column(db.Integer, primary_key=True)
    correo = db.Column(db.String(100), unique=True, nullable=False)
    nombre = db.Column(db.String(100), nullable=False)
    wallet_address = db.Column(db.String(256), nullable=True)
    edad = db.Column(db.Integer)
    fecha_nacimiento = db.Column(db.Date)
    tipo = db.Column(db.String(100), nullable=False)
    creado_en = db.Column(db.DateTime, default=datetime.utcnow)


class Recompensa(db.Model):
    __tablename__ = 'recompensas'
    id_recompensa = db.Column(db.Integer, primary_key=True)
    id_usuario = db.Column(db.Integer, db.ForeignKey('usuarios.id_usuario'), nullable=False)
    titulo = db.Column(db.String(150), nullable=False)
    descripcion = db.Column(db.Text)
    puntos = db.Column(db.Integer, default=0)
    creado_en = db.Column(db.DateTime, default=datetime.utcnow)

    usuario = db.relationship("Usuario", backref="recompensas")
