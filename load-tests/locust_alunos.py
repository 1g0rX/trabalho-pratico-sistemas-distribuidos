"""Cenário de alunos simultâneos consultando dados e realizando compras."""

from locust import HttpUser, task, between


class AlunoUsuario(HttpUser):
    # Tempo de espera simulado entre ações de um mesmo usuário (em segundos)
    wait_time = between(0.5, 2.0)

    def on_start(self):
        """Autentica cada usuário virtual com a conta fictícia do ambiente de teste."""
        with self.client.post(
            "/api/login",
            json={
                "email": "aluno.teste@createjoy.test",
                "password": "Create123",
            },
            name="POST /api/login",
            catch_response=True,
        ) as response:
            if response.status_code != 200:
                response.failure(f"Falha no login: HTTP {response.status_code}")
                self.headers = {}
                return

            token = response.json().get("token")
            if not token:
                response.failure("Token ausente na resposta de login")
                self.headers = {}
                return

            self.headers = {"Authorization": f"Bearer {token}"}

    @task(3)
    def listar_recursos_aluno(self):
        """Simula alunos consultando páginas/listagens (maior frequência)."""
        self.client.get(
            "/api/alunos/dashboard",
            headers=self.headers,
            name="GET /api/alunos/dashboard",
        )

    @task(2)
    def listar_produtos(self):
        """Simula a abertura da loja pelos alunos."""
        self.client.get(
            "/api/loja/produtos",
            headers=self.headers,
            name="GET /api/loja/produtos",
        )

    @task(1)
    def realizar_compra_loja(self):
        """Simula compras simultâneas na loja (concorrência no banco de dados)."""
        payload = {
            "produto_id": 1,
            "quantidade": 1,
        }
        self.client.post(
            "/api/loja/comprar",
            json=payload,
            headers=self.headers,
            name="POST /api/loja/comprar",
        )
