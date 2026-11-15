"""
Cenário A (Membro 3): Usuários Simultâneos, Requisições de Alunos e Compras na Loja.

Como funciona:
- Este script roda dentro do container `locustio/locust` (sem instalar nada no host).
- Enquanto o `app` usar o placeholder `httpbin`, as rotas `/get` e `/post` respondem 200 OK.
- Quando a aplicação real da Lívia estiver no ar, substitua as URLs e payloads conforme `app/ROTAS.md`.
"""

from locust import HttpUser, task, between


class AlunoUsuario(HttpUser):
    # Tempo de espera simulado entre ações de um mesmo usuário (em segundos)
    wait_time = between(0.5, 2.0)

    def on_start(self):
        """Executado uma vez quando cada usuário virtual inicia (ex: login)."""
        # TODO (Membro 4): Ajustar para a rota real de login de app/ROTAS.md
        # resp = self.client.post("/api/login", json={"email": "aluno.teste@cefetmg.br", "password": "123456"})
        # self.token = resp.json().get("token")
        self.headers = {}

    @task(3)
    def listar_recursos_aluno(self):
        """Simula alunos consultando páginas/listagens (maior frequência)."""
        # TODO (Membro 4): Trocar "/get" pela rota real (ex: "/api/alunos/dashboard")
        self.client.get("/get", headers=self.headers, name="GET /alunos/dashboard")

    @task(1)
    def realizar_compra_loja(self):
        """Simula compras simultâneas na loja (concorrência no banco de dados)."""
        payload = {
            "produto_id": 1,
            "quantidade": 1,
        }
        # TODO (Membro 4): Trocar "/post" pela rota real (ex: "/api/loja/comprar")
        self.client.post("/post", json=payload, headers=self.headers, name="POST /loja/comprar")
