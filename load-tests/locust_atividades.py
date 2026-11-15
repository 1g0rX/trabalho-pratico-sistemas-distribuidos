"""
Cenário B (Membro 4): Envio Simultâneo de Atividades com Entradas de Tamanhos Variados.

Objetivo:
- Observar no Grafana o impacto de payloads Pequeno (~1 KB), Médio (~100 KB) e Grande (~5 MB)
  sobre Memória RAM, I/O de disco e Tráfego de Rede.
- Enquanto o `app` usar `httpbin`, `/post` recebe e valida qualquer payload.
- Quando a aplicação real estiver pronta, ajuste a rota conforme `app/ROTAS.md`.
"""

import os
import string
import random
from locust import HttpUser, task, between


def gerar_texto(tamanho_bytes: int) -> str:
    """Gera uma string aleatória com o tamanho aproximado desejado em bytes."""
    bloco = "".join(random.choices(string.ascii_letters + string.digits, k=1024))
    repeticoes = max(1, tamanho_bytes // 1024)
    return bloco * repeticoes


# Pré-gera os payloads em memória para não gargalar a CPU do próprio Locust
PAYLOAD_PEQUENO = gerar_texto(1 * 1024)         # ~1 KB
PAYLOAD_MEDIO = gerar_texto(100 * 1024)         # ~100 KB
PAYLOAD_GRANDE = gerar_texto(5 * 1024 * 1024)   # ~5 MB (ajustar se necessário)

# Permite filtrar via variável de ambiente TAMANHO_ENTRADA (pequeno | medio | grande | todos)
MODO = os.getenv("TAMANHO_ENTRADA", "todos").lower()


class EnvioAtividadeUsuario(HttpUser):
    wait_time = between(0.5, 2.0)

    def on_start(self):
        # TODO (Membro 5): Se a rota exigir autenticação, fazer login aqui
        self.headers = {}

    @task(3)
    def enviar_atividade_pequena(self):
        if MODO not in ("todos", "pequeno"):
            return
        # TODO (Membro 5): Trocar "/post" pela rota real (ex: "/api/atividades/enviar")
        self.client.post(
            "/post",
            json={"atividade_id": 1, "tamanho": "pequeno", "conteudo": PAYLOAD_PEQUENO},
            headers=self.headers,
            name="POST /atividades (1KB)",
        )

    @task(2)
    def enviar_atividade_media(self):
        if MODO not in ("todos", "medio"):
            return
        self.client.post(
            "/post",
            json={"atividade_id": 1, "tamanho": "medio", "conteudo": PAYLOAD_MEDIO},
            headers=self.headers,
            name="POST /atividades (100KB)",
        )

    @task(1)
    def enviar_atividade_grande(self):
        if MODO not in ("todos", "grande"):
            return
        self.client.post(
            "/post",
            json={"atividade_id": 1, "tamanho": "grande", "conteudo": PAYLOAD_GRANDE},
            headers=self.headers,
            name="POST /atividades (5MB)",
        )
