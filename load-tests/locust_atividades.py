"""
Cenário B (Membro 4): Envio Simultâneo de Atividades com Entradas de Tamanhos Variados.

Objetivo:
- Simular o envio concorrente de atividades com entradas de:
  * 1 KB   (Pequena) -> Baseline de latência e overhead mínimo de requisição
  * 100 KB (Média)   -> Pressão moderada de serialização e buffer de rede
  * 5 MB   (Grande)  -> Estresse de Memória RAM, I/O de Disco e Tráfego de Rede
- Compatível tanto com a aplicação real definida em `app/ROTAS.md` (`/api/atividades/enviar`)
  quanto com o container placeholder `httpbin` (`/post`) via detecção automática de fallback.

Variáveis de ambiente suportadas (opcionais):
- TAMANHO_ENTRADA : "todos" (padrão) | "pequeno" | "medio" | "grande"
- TIPO_CONTEUDO   : "json" (padrão) | "multipart"
- ROTA_LOGIN      : "/api/login" (padrão)
- ROTA_ATIVIDADES : "/api/atividades/enviar" (padrão, com fallback automático para "/post" no httpbin)
- AUTH_EMAIL      : "aluno.teste@cefetmg.br" (padrão do seed em app/ROTAS.md)
- AUTH_PASSWORD   : "123456" (padrão do seed em app/ROTAS.md)
"""

import io
import logging
import os
import random
import string
from locust import HttpUser, between, task

logger = logging.getLogger(__name__)


def gerar_texto(tamanho_bytes: int) -> str:
    """Gera uma string alfanumérica com o tamanho exato em bytes."""
    bloco_base = "".join(random.choices(string.ascii_letters + string.digits, k=1024))
    repeticoes, resto = divmod(max(1, tamanho_bytes), 1024)
    return (bloco_base * repeticoes) + bloco_base[:resto]


# ==============================================================================
# PRÉ-GERAÇÃO DOS PAYLOADS EM MEMÓRIA (1 KB, 100 KB e 5 MB)
# Evita que a geração de strings consuma CPU do container do Locust durante o teste
# ==============================================================================
TAMANHO_PEQUENO_BYTES = 1 * 1024           # 1 KB
TAMANHO_MEDIO_BYTES = 100 * 1024           # 100 KB
TAMANHO_GRANDE_BYTES = 5 * 1024 * 1024     # 5 MB

PAYLOAD_PEQUENO = gerar_texto(TAMANHO_PEQUENO_BYTES)
PAYLOAD_MEDIO = gerar_texto(TAMANHO_MEDIO_BYTES)
PAYLOAD_GRANDE = gerar_texto(TAMANHO_GRANDE_BYTES)

# ==============================================================================
# CONFIGURAÇÕES E CONTRATO DE ROTAS (app/ROTAS.md)
# ==============================================================================
MODO = os.getenv("TAMANHO_ENTRADA", "todos").strip().lower()
TIPO_CONTEUDO = os.getenv("TIPO_CONTEUDO", "json").strip().lower()

ROTA_LOGIN = os.getenv("ROTA_LOGIN", "/api/login").strip()
ROTA_ATIVIDADES_PADRAO = os.getenv("ROTA_ATIVIDADES", "/api/atividades/enviar").strip()
ROTA_FALLBACK_HTTPBIN = "/post"

AUTH_EMAIL = os.getenv("AUTH_EMAIL", "aluno.teste@cefetmg.br").strip()
AUTH_PASSWORD = os.getenv("AUTH_PASSWORD", "123456").strip()
ATIVIDADE_ID_PADRAO = int(os.getenv("ATIVIDADE_ID", "1"))


class EnvioAtividadeUsuario(HttpUser):
    """
    Usuário virtual do Locust responsável por submeter atividades concorrentes
    com payloads de 1 KB, 100 KB e 5 MB.
    """

    wait_time = between(0.5, 2.0)

    def on_start(self):
        """
        Executado quando o usuário virtual inicia:
        1. Tenta autenticar na rota de login definida em `app/ROTAS.md` (`/api/login`).
        2. Caso receba token JWT, configura o header `Authorization: Bearer <token>`.
        3. Se o container alvo ainda for o placeholder `httpbin` (status 404 em `/api/login`),
           ativa automaticamente o fallback para `/post`.
        """
        self.headers = {}
        self.rota_envio = ROTA_ATIVIDADES_PADRAO

        with self.client.post(
            ROTA_LOGIN,
            json={"email": AUTH_EMAIL, "password": AUTH_PASSWORD},
            name="AUTH /api/login",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 201):
                try:
                    dados = resp.json()
                    token = (
                        dados.get("token")
                        or dados.get("access_token")
                        or dados.get("jwt")
                    )
                    if token:
                        self.headers["Authorization"] = f"Bearer {token}"
                except ValueError:
                    pass
                resp.success()
            elif resp.status_code in (404, 405):
                # Placeholder httpbin detectado ou aplicação sem autenticação obrigatória
                if "ROTA_ATIVIDADES" not in os.environ:
                    self.rota_envio = ROTA_FALLBACK_HTTPBIN
                resp.success()
            else:
                resp.failure(f"Falha inesperada no login (HTTP {resp.status_code})")

    def _enviar_atividade(self, rotulo: str, categoria: str, conteudo: str):
        """
        Dispara o payload da atividade conforme o contrato em `app/ROTAS.md`,
        suportando tanto `application/json` quanto `multipart/form-data`.
        """
        atividade_id = ATIVIDADE_ID_PADRAO

        if TIPO_CONTEUDO == "multipart":
            arquivo_virtual = io.BytesIO(conteudo.encode("utf-8"))
            files = {
                "arquivo": (f"atividade_{categoria}.txt", arquivo_virtual, "text/plain")
            }
            data = {
                "atividade_id": str(atividade_id),
                "tamanho": categoria,
            }
            requisicao = self.client.post(
                self.rota_envio,
                data=data,
                files=files,
                headers=self.headers,
                name=rotulo,
                catch_response=True,
            )
        else:
            payload = {
                "atividade_id": atividade_id,
                "tamanho": categoria,
                "conteudo": conteudo,
            }
            requisicao = self.client.post(
                self.rota_envio,
                json=payload,
                headers=self.headers,
                name=rotulo,
                catch_response=True,
            )

        with requisicao as resp:
            if resp.status_code in (200, 201, 202):
                resp.success()
            elif resp.status_code == 404 and self.rota_envio != ROTA_FALLBACK_HTTPBIN:
                # Fallback dinâmico caso a rota real ainda não exista no container alvo
                self.rota_envio = ROTA_FALLBACK_HTTPBIN
                resp.success()
            else:
                resp.failure(
                    f"Erro HTTP {resp.status_code} ao enviar atividade ({categoria})"
                )

    @task(3)
    def enviar_atividade_pequena(self):
        """Envio de atividade com entrada pequena (~1 KB)."""
        if MODO not in ("todos", "pequeno", "1kb"):
            return
        self._enviar_atividade(
            rotulo="POST /atividades (1KB)",
            categoria="pequeno",
            conteudo=PAYLOAD_PEQUENO,
        )

    @task(2)
    def enviar_atividade_media(self):
        """Envio de atividade com entrada média (~100 KB)."""
        if MODO not in ("todos", "medio", "100kb"):
            return
        self._enviar_atividade(
            rotulo="POST /atividades (100KB)",
            categoria="medio",
            conteudo=PAYLOAD_MEDIO,
        )

    @task(1)
    def enviar_atividade_grande(self):
        """Envio de atividade com entrada grande (~5 MB) — estresse de RAM, Disco e Rede."""
        if MODO not in ("todos", "grande", "5mb"):
            return
        self._enviar_atividade(
            rotulo="POST /atividades (5MB)",
            categoria="grande",
            conteudo=PAYLOAD_GRANDE,
        )
