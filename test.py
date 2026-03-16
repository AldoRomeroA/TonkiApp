from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from config import get_db_uri

def test_connection():
    db_uri = get_db_uri()
    print(f"Usando URI: {db_uri}")

    engine = create_engine(db_uri)

    try:
        with engine.connect() as connection:
            # Usa text() para consultas SQL
            result = connection.execute(text("SELECT 1"))
            print("✅ Conexión exitosa:", result.scalar())

            # Ejemplo: probar tu tabla User
            result = connection.execute(text("SELECT * FROM User LIMIT 5"))
            for row in result:
                print(row)
    except OperationalError as e:
        print("❌ Error de conexión:", e)

if __name__ == "__main__":
    test_connection()
