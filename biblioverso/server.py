from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import time
import uuid


BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data.json"


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


def ensure_data_file():
    if not DATA_FILE.exists():
        save_data({"reviews": SEED_REVIEWS})


def load_data():
    ensure_data_file()
    with DATA_FILE.open("r", encoding="utf-8") as file:
        return json.load(file)


def save_data(data):
    with DATA_FILE.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=True, indent=2)


class BiblioversoHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def do_GET(self):
        if self.path.startswith("/api/reviews"):
            self.send_json(load_data())
            return

        super().do_GET()

    def do_POST(self):
        if self.path == "/api/reviews":
            payload = self.read_json()
            required_fields = ["title", "author", "category", "rating", "text", "reviewer"]

            if not all(payload.get(field) for field in required_fields):
                self.send_json({"error": "Campos obrigatórios ausentes."}, status=400)
                return

            data = load_data()
            review = {
                "id": str(uuid.uuid4()),
                "title": payload["title"].strip(),
                "author": payload["author"].strip(),
                "category": payload["category"],
                "rating": int(payload["rating"]),
                "text": payload["text"].strip(),
                "reviewer": payload["reviewer"].strip() or "Visitante",
                "likes": 0,
                "createdAt": int(time.time() * 1000),
            }
            data["reviews"].insert(0, review)
            save_data(data)
            self.send_json(review, status=201)
            return

        if self.path.startswith("/api/reviews/") and self.path.endswith("/like"):
            review_id = self.path.split("/")[3]
            data = load_data()
            for review in data["reviews"]:
                if review["id"] == review_id:
                    review["likes"] += 1
                    save_data(data)
                    self.send_json(review)
                    return

            self.send_json({"error": "Depoimento não encontrado."}, status=404)
            return

        self.send_json({"error": "Rota não encontrada."}, status=404)

    def do_DELETE(self):
        if self.path.startswith("/api/reviews/"):
            review_id = self.path.split("/")[3]
            data = load_data()
            original_total = len(data["reviews"])
            data["reviews"] = [review for review in data["reviews"] if review["id"] != review_id]

            if len(data["reviews"]) == original_total:
                self.send_json({"error": "Depoimento não encontrado."}, status=404)
                return

            save_data(data)
            self.send_json({"ok": True})
            return

        self.send_json({"error": "Rota não encontrada."}, status=404)

    def read_json(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8")
        return json.loads(body or "{}")

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=True).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def run():
    server = ThreadingHTTPServer(("localhost", 8000), BiblioversoHandler)
    print("Biblioverso rodando em http://localhost:8000")
    server.serve_forever()


if __name__ == "__main__":
    run()
