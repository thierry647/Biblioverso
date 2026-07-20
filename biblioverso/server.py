from pathlib import Path
import json
import os
import sqlite3
import time
import uuid

from flask import Flask, jsonify, request, send_from_directory
from werkzeug.security import check_password_hash, generate_password_hash


BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data.json"
DATABASE_FILE = BASE_DIR / "biblioverso.db"
ADMIN_PASSWORD = os.environ.get("BIBLIOVERSO_ADMIN_PASSWORD", "thierry123@")


SEED_REVIEWS = [
    {
        "id": "seed-1",
        "title": "O Pequeno Príncipe",
        "author": "Antoine de Saint-Exupéry",
        "category": "Clássico",
        "rating": 5,
        "text": "Parece simples, mas fala de amizade, cuidado e amadurecimento de um jeito que fica ecoando depois da leitura.",
        "reviewer": "Lia",
        "likes": 12,
        "createdAt": 1718400000000,
    },
    {
        "id": "seed-2",
        "title": "Capitães da Areia",
        "author": "Jorge Amado",
        "category": "Ficção",
        "rating": 5,
        "text": "Um livro forte, cheio de vida, que mostra personagens esquecidos com humanidade e muita energia.",
        "reviewer": "Rafael",
        "likes": 8,
        "createdAt": 1718313600000,
    },
    {
        "id": "seed-3",
        "title": "A Biblioteca da Meia-Noite",
        "author": "Matt Haig",
        "category": "Romance",
        "rating": 4,
        "text": "Gostei porque transforma arrependimento em pergunta: e se a gente pudesse olhar para a própria vida com mais gentileza?",
        "reviewer": "Marina",
        "likes": 5,
        "createdAt": 1718227200000,
    },
]

SEED_CLUBS = [
    {
        "id": "classicos",
        "title": "Clube dos Clássicos",
        "description": "Leituras coletivas de obras brasileiras e internacionais que atravessaram gerações.",
        "theme": "Clássicos",
        "members": 42,
    },
    {
        "id": "fantasia",
        "title": "Fantasia e Mundos",
        "description": "Para quem gosta de magia, aventuras, mapas, sagas e universos inventados.",
        "theme": "Fantasia",
        "members": 35,
    },
    {
        "id": "vida-real",
        "title": "Leituras da Vida Real",
        "description": "Biografias, memórias, comportamento e livros que ajudam a entender pessoas.",
        "theme": "Não ficção",
        "members": 28,
    },
]


app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")


def get_connection():
    connection = sqlite3.connect(DATABASE_FILE)
    connection.row_factory = sqlite3.Row
    return connection


def init_database():
    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS reviews (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                category TEXT NOT NULL,
                rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
                text TEXT NOT NULL,
                reviewer TEXT NOT NULL,
                likes INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                username TEXT UNIQUE,
                email TEXT UNIQUE,
                phone TEXT UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'reader',
                bio TEXT NOT NULL DEFAULT '',
                social_links TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL
            )
            """
        )
        ensure_column(connection, "users", "username", "TEXT")
        ensure_column(connection, "users", "bio", "TEXT NOT NULL DEFAULT ''")
        ensure_column(connection, "users", "social_links", "TEXT NOT NULL DEFAULT ''")

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS clubs (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                theme TEXT NOT NULL,
                members INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS user_books (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                genre TEXT NOT NULL,
                description TEXT NOT NULL,
                link TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
            """
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews (created_at DESC)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_reviews_title ON reviews (title COLLATE NOCASE)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_books_user_id ON user_books (user_id)"
        )

        if connection.execute("SELECT COUNT(*) FROM reviews").fetchone()[0] == 0:
            seed_reviews(connection)
        if connection.execute("SELECT COUNT(*) FROM clubs").fetchone()[0] == 0:
            seed_clubs(connection)


def ensure_column(connection, table, column, definition):
    columns = [row["name"] for row in connection.execute(f"PRAGMA table_info({table})")]
    if column not in columns:
        connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def seed_reviews(connection):
    reviews = load_reviews_from_json() or SEED_REVIEWS
    connection.executemany(
        """
        INSERT OR IGNORE INTO reviews (
            id, title, author, category, rating, text, reviewer, likes, created_at
        ) VALUES (
            :id, :title, :author, :category, :rating, :text, :reviewer, :likes, :created_at
        )
        """,
        [normalize_review(review) for review in reviews],
    )


def seed_clubs(connection):
    connection.executemany(
        """
        INSERT OR IGNORE INTO clubs (
            id, title, description, theme, members, created_at
        ) VALUES (
            :id, :title, :description, :theme, :members, :created_at
        )
        """,
        [{**club, "created_at": int(time.time() * 1000)} for club in SEED_CLUBS],
    )


def load_reviews_from_json():
    if not DATA_FILE.exists():
        return []

    with DATA_FILE.open("r", encoding="utf-8") as file:
        data = json.load(file)
    return data.get("reviews", [])


def normalize_review(review):
    return {
        "id": review.get("id") or str(uuid.uuid4()),
        "title": str(review.get("title", "")).strip(),
        "author": str(review.get("author", "")).strip(),
        "category": str(review.get("category", "")).strip(),
        "rating": int(review.get("rating", 1)),
        "text": str(review.get("text", "")).strip(),
        "reviewer": str(review.get("reviewer", "")).strip() or "Visitante",
        "likes": int(review.get("likes", 0)),
        "created_at": int(review.get("createdAt") or review.get("created_at") or time.time() * 1000),
    }


def row_to_review(row):
    return {
        "id": row["id"],
        "title": row["title"],
        "author": row["author"],
        "category": row["category"],
        "rating": row["rating"],
        "text": row["text"],
        "reviewer": row["reviewer"],
        "likes": row["likes"],
        "createdAt": row["created_at"],
    }


def row_to_user(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "username": row["username"],
        "email": row["email"],
        "phone": row["phone"],
        "role": row["role"],
        "bio": row["bio"],
        "socialLinks": row["social_links"],
    }


def row_to_public_user(user):
    return {
        "id": user["id"],
        "name": user["name"],
        "username": user["username"],
        "email": user["email"],
        "phone": user["phone"],
        "role": user["role"],
        "bio": user.get("bio", ""),
        "socialLinks": user.get("social_links", ""),
    }


def row_to_club(row):
    return {
        "id": row["id"],
        "title": row["title"],
        "description": row["description"],
        "theme": row["theme"],
        "members": row["members"],
        "createdAt": row["created_at"],
    }


def row_to_book(row):
    return {
        "id": row["id"],
        "userId": row["user_id"],
        "title": row["title"],
        "genre": row["genre"],
        "description": row["description"],
        "link": row["link"],
        "createdAt": row["created_at"],
    }


def row_to_review_from_dict(review):
    return {
        "id": review["id"],
        "title": review["title"],
        "author": review["author"],
        "category": review["category"],
        "rating": review["rating"],
        "text": review["text"],
        "reviewer": review["reviewer"],
        "likes": review["likes"],
        "createdAt": review["created_at"],
    }


def validate_review(payload):
    required_fields = ["title", "author", "category", "rating", "text", "reviewer"]
    missing_fields = [field for field in required_fields if not payload.get(field)]
    if missing_fields:
        return f"Campos obrigatórios ausentes: {', '.join(missing_fields)}."

    try:
        rating = int(payload["rating"])
    except (TypeError, ValueError):
        return "A nota precisa ser um número entre 1 e 5."

    if rating < 1 or rating > 5:
        return "A nota precisa estar entre 1 e 5."

    return None


def normalize_identifier(value):
    return str(value or "").strip().lower()


def is_email(value):
    return "@" in value


def is_phone(value):
    return any(character.isdigit() for character in value) and "@" not in value


def get_admin_name(identifier):
    cleaned = str(identifier or "").strip()
    return cleaned or "Administrador"


def is_admin_request():
    return request.headers.get("X-Admin-Password") == ADMIN_PASSWORD


@app.get("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.get("/api/health")
def health():
    return jsonify({"ok": True, "database": DATABASE_FILE.name})


@app.post("/api/auth/register")
def register_user():
    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name", "")).strip()
    identifier = normalize_identifier(payload.get("identifier") or payload.get("contact"))
    password = str(payload.get("password", ""))

    if not name or not identifier or not password:
        return jsonify({"error": "Informe nome, usuário/email/telefone e senha."}), 400
    if len(password) < 4:
        return jsonify({"error": "A senha precisa ter pelo menos 4 caracteres."}), 400

    email = identifier if is_email(identifier) else None
    phone = identifier if is_phone(identifier) and not email else None
    username = None if email or phone else identifier
    user = {
        "id": str(uuid.uuid4()),
        "name": name,
        "username": username,
        "email": email,
        "phone": phone,
        "password_hash": generate_password_hash(password),
        "role": "reader",
        "bio": "",
        "social_links": "",
        "created_at": int(time.time() * 1000),
    }

    try:
        with get_connection() as connection:
            connection.execute(
                """
                INSERT INTO users (
                    id, name, username, email, phone, password_hash, role, bio, social_links, created_at
                ) VALUES (
                    :id, :name, :username, :email, :phone, :password_hash, :role, :bio, :social_links, :created_at
                )
                """,
                user,
            )
    except sqlite3.IntegrityError:
        return jsonify({"error": "Já existe uma conta com esse usuário, email ou telefone."}), 409

    return jsonify({"user": row_to_public_user(user)}), 201


@app.post("/api/auth/login")
def login_user():
    payload = request.get_json(silent=True) or {}
    identifier = normalize_identifier(payload.get("identifier") or payload.get("contact"))
    password = str(payload.get("password", ""))

    if not identifier or not password:
        return jsonify({"error": "Informe usuário, email ou telefone e senha."}), 400

    if password == ADMIN_PASSWORD:
        return jsonify(
            {
                "user": {
                    "id": "admin",
                    "name": get_admin_name(identifier),
                    "username": identifier,
                    "email": identifier if is_email(identifier) else None,
                    "phone": identifier if is_phone(identifier) else None,
                    "role": "admin",
                    "bio": "",
                    "socialLinks": "",
                }
            }
        )

    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT * FROM users
            WHERE lower(username) = ? OR lower(email) = ? OR lower(phone) = ?
            """,
            (identifier, identifier, identifier),
        ).fetchone()

    if not row or not check_password_hash(row["password_hash"], password):
        return jsonify({"error": "Usuário ou senha inválidos."}), 401

    return jsonify({"user": row_to_user(row)})


@app.get("/api/users/<user_id>/profile")
def get_user_profile(user_id):
    with get_connection() as connection:
        row = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        return jsonify({"error": "Usuário não encontrado."}), 404
    return jsonify({"user": row_to_user(row)})


@app.patch("/api/users/<user_id>/profile")
def update_user_profile(user_id):
    payload = request.get_json(silent=True) or {}
    bio = str(payload.get("bio", "")).strip()
    social_links = str(payload.get("socialLinks", "")).strip()

    with get_connection() as connection:
        cursor = connection.execute(
            "UPDATE users SET bio = ?, social_links = ? WHERE id = ?",
            (bio, social_links, user_id),
        )
        if cursor.rowcount == 0:
            return jsonify({"error": "Usuário não encontrado."}), 404
        row = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()

    return jsonify({"user": row_to_user(row)})


@app.get("/api/users/<user_id>/books")
def list_user_books(user_id):
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM user_books WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
    return jsonify({"books": [row_to_book(row) for row in rows]})


@app.post("/api/users/<user_id>/books")
def create_user_book(user_id):
    payload = request.get_json(silent=True) or {}
    title = str(payload.get("title", "")).strip()
    genre = str(payload.get("genre", "")).strip()
    description = str(payload.get("description", "")).strip()
    link = str(payload.get("link", "")).strip()

    if not title or not genre or not description:
        return jsonify({"error": "Informe título, gênero e descrição do livro."}), 400

    book = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "genre": genre,
        "description": description,
        "link": link,
        "created_at": int(time.time() * 1000),
    }

    with get_connection() as connection:
        user_exists = connection.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user_exists:
            return jsonify({"error": "Usuário não encontrado."}), 404
        connection.execute(
            """
            INSERT INTO user_books (
                id, user_id, title, genre, description, link, created_at
            ) VALUES (
                :id, :user_id, :title, :genre, :description, :link, :created_at
            )
            """,
            book,
        )

    return jsonify({"book": row_to_book(book)}), 201


@app.get("/api/reviews")
def list_reviews():
    with get_connection() as connection:
        rows = connection.execute("SELECT * FROM reviews ORDER BY created_at DESC").fetchall()
    return jsonify({"reviews": [row_to_review(row) for row in rows]})


@app.post("/api/reviews")
def create_review():
    payload = request.get_json(silent=True) or {}
    error = validate_review(payload)
    if error:
        return jsonify({"error": error}), 400

    review = normalize_review(
        {
            **payload,
            "id": str(uuid.uuid4()),
            "likes": 0,
            "createdAt": int(time.time() * 1000),
        }
    )

    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO reviews (
                id, title, author, category, rating, text, reviewer, likes, created_at
            ) VALUES (
                :id, :title, :author, :category, :rating, :text, :reviewer, :likes, :created_at
            )
            """,
            review,
        )

    return jsonify(row_to_review_from_dict(review)), 201


@app.post("/api/reviews/<review_id>/like")
def like_review(review_id):
    with get_connection() as connection:
        cursor = connection.execute("UPDATE reviews SET likes = likes + 1 WHERE id = ?", (review_id,))
        if cursor.rowcount == 0:
            return jsonify({"error": "Depoimento não encontrado."}), 404
        row = connection.execute("SELECT * FROM reviews WHERE id = ?", (review_id,)).fetchone()

    return jsonify(row_to_review(row))


@app.delete("/api/reviews/<review_id>")
def delete_review(review_id):
    if not is_admin_request():
        return jsonify({"error": "Acesso de administrador necessário."}), 403

    with get_connection() as connection:
        cursor = connection.execute("DELETE FROM reviews WHERE id = ?", (review_id,))
        if cursor.rowcount == 0:
            return jsonify({"error": "Depoimento não encontrado."}), 404

    return jsonify({"ok": True})


@app.get("/api/clubs")
def list_clubs():
    with get_connection() as connection:
        rows = connection.execute("SELECT * FROM clubs ORDER BY created_at DESC").fetchall()
    return jsonify({"clubs": [row_to_club(row) for row in rows]})


@app.post("/api/clubs")
def create_club():
    if not is_admin_request():
        return jsonify({"error": "Acesso de administrador necessário."}), 403

    payload = request.get_json(silent=True) or {}
    title = str(payload.get("title", "")).strip()
    description = str(payload.get("description", "")).strip()
    theme = str(payload.get("theme", "")).strip()

    if not title or not description or not theme:
        return jsonify({"error": "Informe nome, tema e descrição do clube."}), 400

    club = {
        "id": str(uuid.uuid4()),
        "title": title,
        "description": description,
        "theme": theme,
        "members": 0,
        "created_at": int(time.time() * 1000),
    }

    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO clubs (
                id, title, description, theme, members, created_at
            ) VALUES (
                :id, :title, :description, :theme, :members, :created_at
            )
            """,
            club,
        )

    return jsonify({"club": row_to_club_from_dict(club)}), 201


@app.post("/api/clubs/<club_id>/join")
def join_club(club_id):
    with get_connection() as connection:
        cursor = connection.execute("UPDATE clubs SET members = members + 1 WHERE id = ?", (club_id,))
        if cursor.rowcount == 0:
            return jsonify({"error": "Clube não encontrado."}), 404
        row = connection.execute("SELECT * FROM clubs WHERE id = ?", (club_id,)).fetchone()

    return jsonify({"club": row_to_club(row)})


@app.post("/api/clubs/<club_id>/leave")
def leave_club(club_id):
    with get_connection() as connection:
        cursor = connection.execute(
            "UPDATE clubs SET members = MAX(members - 1, 0) WHERE id = ?",
            (club_id,),
        )
        if cursor.rowcount == 0:
            return jsonify({"error": "Clube não encontrado."}), 404
        row = connection.execute("SELECT * FROM clubs WHERE id = ?", (club_id,)).fetchone()

    return jsonify({"club": row_to_club(row)})


@app.delete("/api/clubs/<club_id>")
def delete_club(club_id):
    if not is_admin_request():
        return jsonify({"error": "Acesso de administrador necessário."}), 403

    with get_connection() as connection:
        cursor = connection.execute("DELETE FROM clubs WHERE id = ?", (club_id,))
        if cursor.rowcount == 0:
            return jsonify({"error": "Clube não encontrado."}), 404

    return jsonify({"ok": True})


def row_to_club_from_dict(club):
    return {
        "id": club["id"],
        "title": club["title"],
        "description": club["description"],
        "theme": club["theme"],
        "members": club["members"],
        "createdAt": club["created_at"],
    }


init_database()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=True, use_reloader=False)
