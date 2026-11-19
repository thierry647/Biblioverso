import tempfile
import unittest
from pathlib import Path

import server


class BiblioversoApiTest(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.database_file = Path(self.temporary_directory.name) / "test.db"
        self.original_database_file = server.DATABASE_FILE
        self.original_admin_password = server.ADMIN_PASSWORD
        server.DATABASE_FILE = self.database_file
        server.ADMIN_PASSWORD = "admin-test-password"
        server.ADMIN_TOKENS.clear()
        server.init_database()
        self.client = server.app.test_client()

    def tearDown(self):
        server.ADMIN_TOKENS.clear()
        server.DATABASE_FILE = self.original_database_file
        server.ADMIN_PASSWORD = self.original_admin_password
        self.temporary_directory.cleanup()

    def register_user(self, identifier="leitor@example.com", password="senha-segura"):
        return self.client.post(
            "/api/auth/register",
            json={"identifier": identifier, "password": password},
        )

    def test_login_rejects_missing_or_invalid_credentials(self):
        missing = self.client.post("/api/auth/login", json={"identifier": "", "password": ""})
        self.assertEqual(missing.status_code, 400)

        self.register_user()
        invalid = self.client.post(
            "/api/auth/login",
            json={"identifier": "leitor@example.com", "password": "senha-incorreta"},
        )
        self.assertEqual(invalid.status_code, 401)
        self.assertEqual(invalid.get_json()["error"], "Usuário ou senha inválidos.")

    def test_login_authenticates_registered_user_without_case_sensitivity(self):
        registration = self.register_user("Leitor@Example.com")
        self.assertEqual(registration.status_code, 201)

        login = self.client.post(
            "/api/auth/login",
            json={"identifier": "leitor@example.com", "password": "senha-segura"},
        )
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.get_json()["user"]["email"], "leitor@example.com")
        self.assertEqual(login.get_json()["user"]["role"], "reader")

    def test_registration_rejects_identifier_that_differs_only_by_case(self):
        self.assertEqual(self.register_user("Leitor@Example.com").status_code, 201)
        duplicate = self.register_user("leitor@example.com")
        self.assertEqual(duplicate.status_code, 409)

    def test_public_apis_and_invalid_review_response(self):
        health = self.client.get("/api/health")
        self.assertEqual(health.status_code, 200)
        self.assertTrue(health.get_json()["ok"])

        reviews = self.client.get("/api/reviews")
        self.assertEqual(reviews.status_code, 200)
        self.assertGreaterEqual(len(reviews.get_json()["reviews"]), 1)

        invalid_review = self.client.post("/api/reviews", json={"title": "Sem dados"})
        self.assertEqual(invalid_review.status_code, 400)

    def test_admin_api_requires_a_token_and_accepts_a_login_token(self):
        blocked = self.client.post(
            "/api/clubs",
            json={"title": "Teste", "theme": "Ficção", "description": "Descrição"},
        )
        self.assertEqual(blocked.status_code, 403)

        admin_login = self.client.post(
            "/api/auth/login",
            json={"identifier": "admin", "password": "admin-test-password"},
        )
        token = admin_login.get_json()["user"]["adminToken"]
        created = self.client.post(
            "/api/clubs",
            headers={"X-Admin-Token": token},
            json={"title": "Teste", "theme": "Ficção", "description": "Descrição"},
        )
        self.assertEqual(created.status_code, 201)

    def test_registration_only_requires_identifier_and_password(self):
        response = self.register_user("leitor-novo")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["user"]["name"], "leitor-novo")

    def test_registration_rejects_empty_identifier(self):
        response = self.register_user(identifier="")
        self.assertEqual(response.status_code, 400)

    def test_registration_rejects_short_password(self):
        response = self.register_user(password="1234567")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["error"], "A senha precisa ter pelo menos 8 caracteres.")

    def test_registration_accepts_an_eight_character_password(self):
        response = self.register_user(identifier="senha-oito", password="12345678")
        self.assertEqual(response.status_code, 201)

    def test_login_authenticates_a_username(self):
        self.assertEqual(self.register_user("leitor-teste").status_code, 201)
        response = self.client.post(
            "/api/auth/login",
            json={"identifier": "leitor-teste", "password": "senha-segura"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["user"]["username"], "leitor-teste")

    def test_login_authenticates_a_formatted_phone_number(self):
        self.assertEqual(self.register_user("11987654321").status_code, 201)
        response = self.client.post(
            "/api/auth/login",
            json={"identifier": "(11) 98765-4321", "password": "senha-segura"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["user"]["phone"], "11987654321")


if __name__ == "__main__":
    unittest.main()
