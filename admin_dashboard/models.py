import uuid
from datetime import datetime

from extensions import db


def generate_uuid():
    return uuid.uuid4().hex[:32]


class User(db.Model):
    __tablename__ = "User"
    user_id = db.Column(db.String(32), primary_key=True, default=generate_uuid)
    email = db.Column(db.String(100), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    wallet_address = db.Column(db.String(256), unique=True, nullable=True)
    age = db.Column(db.Integer, nullable=True)
    birth_date = db.Column(db.Date, nullable=True)
    type = db.Column(db.String(100), nullable=False, default="cliente")
    status = db.Column(db.String(50), default="active")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    credentials = db.relationship("Credential", back_populates="user")
    establishments = db.relationship("Establishment", back_populates="admin")
    rewards = db.relationship("Reward", back_populates="user")
    airdrop_configs = db.relationship("AirdropConfig", back_populates="user")
    etherfuse_profile = db.relationship("EtherfuseProfile", back_populates="user", uselist=False)


class Credential(db.Model):
    __tablename__ = "Credential"
    credential_id = db.Column(db.String(32), primary_key=True, default=generate_uuid)
    user_id = db.Column(db.String(32), db.ForeignKey("User.user_id"), nullable=False)
    username = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user = db.relationship("User", back_populates="credentials")


class Establishment(db.Model):
    __tablename__ = "Establishment"
    establishment_id = db.Column(db.String(32), primary_key=True, default=generate_uuid)
    admin_id = db.Column(db.String(32), db.ForeignKey("User.user_id"), nullable=False)
    name = db.Column(db.String(150), nullable=False)
    address = db.Column(db.String(255), nullable=True)
    category = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    admin = db.relationship("User", back_populates="establishments")
    rewards = db.relationship("Reward", back_populates="establishment")


class Reward(db.Model):
    __tablename__ = "Reward"
    reward_id = db.Column(db.String(32), primary_key=True, default=generate_uuid)
    user_id = db.Column(db.String(32), db.ForeignKey("User.user_id"), nullable=False)
    establishment_id = db.Column(
        db.String(32), db.ForeignKey("Establishment.establishment_id"), nullable=False
    )
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    points = db.Column(db.Integer, default=0)
    status = db.Column(db.String(50), default="active")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user = db.relationship("User", back_populates="rewards")
    establishment = db.relationship("Establishment", back_populates="rewards")


class AirdropConfig(db.Model):
    __tablename__ = "AirdropConfig"
    config_id = db.Column(db.String(32), primary_key=True, default=generate_uuid)
    user_id = db.Column(db.String(32), db.ForeignKey("User.user_id"), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    scheduled_date = db.Column(db.Date, nullable=False)
    periodicity_months = db.Column(db.Integer, nullable=False)
    max_users = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user = db.relationship("User", back_populates="airdrop_configs")
    logs = db.relationship("AirdropLog", back_populates="config")


class AirdropLog(db.Model):
    __tablename__ = "AirdropLog"
    log_id = db.Column(db.String(32), primary_key=True, default=generate_uuid)
    config_id = db.Column(
        db.String(32), db.ForeignKey("AirdropConfig.config_id"), nullable=False
    )
    transaction_hash = db.Column(db.String(100), nullable=True)
    total_amount = db.Column(db.Float, nullable=False)
    users_involved = db.Column(db.Integer, nullable=False)
    executed_at = db.Column(db.DateTime, default=datetime.utcnow)
    success = db.Column(db.Boolean, default=True)
    error_message = db.Column(db.String(255), nullable=True)
    response_json = db.Column(db.Text, nullable=True)
    user_id = db.Column(db.String(32), db.ForeignKey('User.user_id'), nullable=False)
    establishment_id = db.Column(db.String(32), db.ForeignKey('Establishment.establishment_id'), nullable=False)

    config = db.relationship("AirdropConfig", back_populates="logs")
    user = db.relationship("User", backref="airdrop_logs")
    establishment = db.relationship("Establishment", backref="airdrop_logs")


class EtherfuseProfile(db.Model):
    """Links Tonki User to Etherfuse customer for on/off-ramp. Create once per user, reuse forever."""
    __tablename__ = "EtherfuseProfile"
    profile_id = db.Column(db.String(32), primary_key=True, default=generate_uuid)
    user_id = db.Column(db.String(32), db.ForeignKey("User.user_id"), nullable=False, unique=True)
    customer_id = db.Column(db.String(64), nullable=False)
    bank_account_id = db.Column(db.String(64), nullable=True)
    crypto_wallet_id = db.Column(db.String(64), nullable=True)
    kyc_status = db.Column(db.String(32), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship("User", back_populates="etherfuse_profile")

