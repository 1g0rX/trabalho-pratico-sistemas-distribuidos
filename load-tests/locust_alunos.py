"""Cenário de alunos simultâneos consultando dados e solicitando produtos."""

import random

from locust import HttpUser, between, task


class AlunoUsuario(HttpUser):
    wait_time = between(0.5, 2.0)

    def on_start(self):
        """Abre uma sessão real usando apenas a conta fictícia do ambiente local."""
        self.csrf_token = ""
        self.product_ids = []
        with self.client.post(
            "/api/index.php?route=auth/login",
            json={
                "email": "aluno.demo@createjoy.local",
                "password": "Admin@123",
                "role": "student",
            },
            name="POST auth/login",
            catch_response=True,
        ) as response:
            if response.status_code != 200:
                response.failure(f"Falha no login: HTTP {response.status_code}")
                return
            payload = response.json()
            self.csrf_token = payload.get("csrfToken", "")
            self.product_ids = [
                product["id"]
                for product in payload.get("data", {}).get("storeProducts", [])
            ]
            if not self.csrf_token:
                response.failure("Token CSRF ausente no login")

    @task(4)
    def carregar_painel(self):
        """Atualiza dashboard, missões, atividades e demais dados do aluno."""
        self.client.get(
            "/api/index.php?route=bootstrap",
            name="GET bootstrap do aluno",
        )

    @task(3)
    def abrir_loja(self):
        """A listagem da loja faz parte do mesmo bootstrap autenticado."""
        self.client.get(
            "/api/index.php?route=bootstrap",
            name="GET catálogo da CreateStore",
        )

    @task(1)
    def solicitar_produto(self):
        """Exercita a concorrência das solicitações sem descontar Joys na criação."""
        if not self.csrf_token or not self.product_ids:
            return
        product_id = random.choice(self.product_ids)
        with self.client.post(
            "/api/index.php?route=store/request/create",
            json={
                "product_id": product_id,
                "details": "Solicitação fictícia gerada pelo teste de carga.",
            },
            headers={"X-CSRF-Token": self.csrf_token},
            name="POST solicitação da CreateStore",
            catch_response=True,
        ) as response:
            if response.status_code in (200, 201, 409):
                response.success()
            else:
                response.failure(f"Falha na solicitação: HTTP {response.status_code}")
