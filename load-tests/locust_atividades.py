"""
Cenário B (Membro 4): Envio Simultâneo de Atividades com Entradas de Tamanhos Variados.

Objetivo:
- Simular o envio concorrente de atividades/missões no CreateJoy com entradas de:
  * 1 KB   (Pequena) -> Baseline de latência e overhead mínimo de requisição
  * 100 KB (Média)   -> Pressão moderada de rede, banco e escrita em disco
  * 5 MB   (Grande)  -> Estresse de Memória RAM, I/O de Disco, hash SHA-256 e Tráfego de Rede
- Utiliza as rotas reais documentadas em `app/ROTAS.md`:
  * Login: `POST /api/index.php?route=auth/login` (sessão `CREATEJOYSESSID` + `csrfToken`)
  * Envio: `POST /api/index.php?route=submissions/create` (`multipart/form-data` + `X-CSRF-Token`)
- Mantém fallback automático para `/post` caso executado contra o placeholder `httpbin`.
"""

import io
import os
import random
import string
from locust import HttpUser, between, task


def gerar_codigo_ino(tamanho_bytes: int) -> bytes:
    """Gera um conteúdo de código Arduino (.ino) com o tamanho exato solicitado em bytes."""
    cabecalho = (
        "// Sketch gerado automaticamente pelo Locust para teste de carga (CreateJoy)\n"
        "void setup() { pinMode(13, OUTPUT); }\n"
        "void loop() { digitalWrite(13, HIGH); delay(500); digitalWrite(13, LOW); delay(500); }\n"
    )
    bloco_comentario = "// " + "".join(
        random.choices(string.ascii_letters + string.digits, k=1020)
    ) + "\n"
    restante = max(0, tamanho_bytes - len(cabecalho))
    repeticoes, sobra = divmod(restante, len(bloco_comentario))
    texto = cabecalho + (bloco_comentario * repeticoes) + bloco_comentario[:sobra]
    return texto.encode("utf-8")[:tamanho_bytes]


# ==============================================================================
# PRÉ-GERAÇÃO DOS PAYLOADS EM MEMÓRIA (1 KB, 100 KB e 5 MB)
# Evita que a geração de strings consuma CPU do container do Locust durante o teste.
# No envio de 5 MB, o payload total de 5 MB é dividido nos 3 anexos `files[]` (~1,67 MB cada)
# previstos em `app/ROTAS.md`, respeitando o `upload_max_filesize=2M` padrão do PHP/Apache
# e totalizando 5 MB exatos por requisição POST.
# ==============================================================================
TAMANHO_PEQUENO_BYTES = 1 * 1024               # 1 KB
TAMANHO_MEDIO_BYTES = 100 * 1024               # 100 KB
TAMANHO_GRANDE_TOTAL_BYTES = 5 * 1024 * 1024   # 5 MB total na requisição
TAMANHO_GRANDE_PARTE_BYTES = TAMANHO_GRANDE_TOTAL_BYTES // 3

PAYLOAD_PEQUENO_BYTES = gerar_codigo_ino(TAMANHO_PEQUENO_BYTES)
PAYLOAD_MEDIO_BYTES = gerar_codigo_ino(TAMANHO_MEDIO_BYTES)
PAYLOAD_GRANDE_PARTE_BYTES = gerar_codigo_ino(TAMANHO_GRANDE_PARTE_BYTES)

# Permite filtrar via variável de ambiente TAMANHO_ENTRADA (pequeno | medio | grande | todos)
MODO = os.getenv("TAMANHO_ENTRADA", "todos").strip().lower()

ROTA_LOGIN = os.getenv("ROTA_LOGIN", "/api/index.php?route=auth/login").strip()
ROTA_SUBMISSAO = os.getenv("ROTA_ATIVIDADES", "/api/index.php?route=submissions/create").strip()
ROTA_FALLBACK_HTTPBIN = "/post"

AUTH_EMAIL = os.getenv("AUTH_EMAIL", "aluno.demo@createjoy.local").strip()
AUTH_PASSWORD = os.getenv("AUTH_PASSWORD", "Admin@123").strip()


class EnvioAtividadeUsuario(HttpUser):
    """
    Usuário virtual do Locust responsável por autenticar como aluno no CreateJoy
    e enviar atividades simultâneas com entradas de 1 KB, 100 KB e 5 MB.
    """

    wait_time = between(0.5, 2.0)

    def on_start(self):
        """Autentica na conta fictícia do CreateJoy e obtém o token CSRF e missões ativas."""
        self.csrf_token = ""
        self.mission_ids = [1, 2]
        self.usar_fallback_httpbin = False

        with self.client.post(
            ROTA_LOGIN,
            json={
                "email": AUTH_EMAIL,
                "password": AUTH_PASSWORD,
                "role": "student",
            },
            name="POST auth/login",
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                try:
                    payload = response.json()
                    self.csrf_token = payload.get("csrfToken", "")
                    missoes = [
                        m["id"]
                        for m in payload.get("data", {}).get("missions", [])
                        if m.get("status") in ("ativa", "active")
                        and not m.get("bloqueada", False)
                        and not m.get("concluida", False)
                        and m.get("progress_status") not in ("blocked", "approved")
                    ]
                    if missoes:
                        self.mission_ids = missoes
                except ValueError:
                    pass

                if self.csrf_token:
                    response.success()
                else:
                    response.failure("Token CSRF ausente na resposta do login")
            elif response.status_code in (404, 405):
                # Fallback automático caso o ambiente esteja rodando com o placeholder httpbin
                self.usar_fallback_httpbin = True
                response.success()
            else:
                response.failure(f"Falha no login: HTTP {response.status_code}")

    def _enviar_submissao(self, rotulo: str, categoria: str, arquivos: list[tuple[str, bytes]]):
        """Envia a tentativa da atividade/missão via multipart/form-data com X-CSRF-Token."""
        if self.usar_fallback_httpbin:
            arquivos_httpbin = [
                ("files[]", (nome, io.BytesIO(conteudo), "text/plain"))
                for nome, conteudo in arquivos
            ]
            with self.client.post(
                ROTA_FALLBACK_HTTPBIN,
                data={"mission_id": "1", "tamanho": categoria},
                files=arquivos_httpbin,
                name=rotulo,
                catch_response=True,
            ) as resp:
                if resp.status_code in (200, 201):
                    resp.success()
                else:
                    resp.failure(f"Falha HTTP {resp.status_code} no fallback")
            return

        if not self.csrf_token:
            return

        mission_id = random.choice(self.mission_ids)
        data = {
            "mission_id": str(mission_id),
            "notes": f"Envio automatizado de teste de carga ({categoria}).",
            "learned": f"Validação experimental de impacto de I/O, RAM e Rede ({categoria}).",
        }
        files = [
            ("files[]", (nome, io.BytesIO(conteudo), "text/plain"))
            for nome, conteudo in arquivos
        ]

        with self.client.post(
            ROTA_SUBMISSAO,
            data=data,
            files=files,
            headers={"X-CSRF-Token": self.csrf_token},
            name=rotulo,
            catch_response=True,
        ) as response:
            if response.status_code in (200, 201):
                response.success()
            else:
                response.failure(
                    f"Falha no envio ({categoria}): HTTP {response.status_code} - {response.text[:160]}"
                )

    @task(3)
    def enviar_atividade_pequena(self):
        """Envio de atividade com entrada pequena (~1 KB)."""
        if MODO not in ("todos", "pequeno", "1kb"):
            return
        self._enviar_submissao(
            rotulo="POST /atividades (1KB)",
            categoria="1KB",
            arquivos=[("sketch_1kb.ino", PAYLOAD_PEQUENO_BYTES)],
        )

    @task(2)
    def enviar_atividade_media(self):
        """Envio de atividade com entrada média (~100 KB)."""
        if MODO not in ("todos", "medio", "100kb"):
            return
        self._enviar_submissao(
            rotulo="POST /atividades (100KB)",
            categoria="100KB",
            arquivos=[("sketch_100kb.ino", PAYLOAD_MEDIO_BYTES)],
        )

    @task(1)
    def enviar_atividade_grande(self):
        """Envio de atividade com entrada grande (~5 MB totais em 3 arquivos .ino)."""
        if MODO not in ("todos", "grande", "5mb"):
            return
        self._enviar_submissao(
            rotulo="POST /atividades (5MB)",
            categoria="5MB",
            arquivos=[
                ("sketch_5mb_parte1.ino", PAYLOAD_GRANDE_PARTE_BYTES),
                ("sketch_5mb_parte2.ino", PAYLOAD_GRANDE_PARTE_BYTES),
                ("sketch_5mb_parte3.ino", PAYLOAD_GRANDE_PARTE_BYTES),
            ],
        )
