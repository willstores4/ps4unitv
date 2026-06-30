/**
 * main.c — UnitV Pro PS4
 * Servidor HTTP local + launcher do navegador WebKit do PS4
 *
 * Fluxo:
 *   1. Inicia um servidor HTTP na porta 12345
 *   2. Serve os arquivos da web app em /app0/USRDIR/web/
 *   3. Abre o browser nativo do PS4 em http://localhost:12345/
 *
 * Compilar com: OpenOrbis PS4 Toolchain
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <netinet/in.h>
#include <unistd.h>
#include <fcntl.h>
#include <pthread.h>
#include <errno.h>
#include <orbis/libkernel.h>
#include <orbis/SystemService.h>
#include <orbis/UserService.h>

/* ── Configurações ────────────────────────────────────── */
#define SERVER_PORT     12345
#define WEB_ROOT        "/app0/USRDIR/web"
#define APP_URL         "http://localhost:12345/"
#define BUF_SIZE        8192
#define MAX_PATH        512
#define BACKLOG         8

/* ── MIME Types ────────────────────────────────────────── */
static const char* mime_type(const char *ext) {
    if (!ext) return "application/octet-stream";
    if (strcmp(ext, "html") == 0 || strcmp(ext, "htm") == 0)
        return "text/html; charset=utf-8";
    if (strcmp(ext, "css")  == 0) return "text/css; charset=utf-8";
    if (strcmp(ext, "js")   == 0) return "application/javascript; charset=utf-8";
    if (strcmp(ext, "json") == 0) return "application/json";
    if (strcmp(ext, "png")  == 0) return "image/png";
    if (strcmp(ext, "jpg")  == 0) return "image/jpeg";
    if (strcmp(ext, "jpeg") == 0) return "image/jpeg";
    if (strcmp(ext, "gif")  == 0) return "image/gif";
    if (strcmp(ext, "svg")  == 0) return "image/svg+xml";
    if (strcmp(ext, "ico")  == 0) return "image/x-icon";
    if (strcmp(ext, "woff") == 0) return "font/woff";
    if (strcmp(ext, "woff2")== 0) return "font/woff2";
    if (strcmp(ext, "mp4")  == 0) return "video/mp4";
    if (strcmp(ext, "m3u8") == 0) return "application/vnd.apple.mpegurl";
    if (strcmp(ext, "ts")   == 0) return "video/mp2t";
    if (strcmp(ext, "txt")  == 0) return "text/plain; charset=utf-8";
    return "application/octet-stream";
}

static const char* file_ext(const char *path) {
    const char *dot = strrchr(path, '.');
    return (dot && dot != path) ? dot + 1 : NULL;
}

/* ── Servir arquivo estático ────────────────────────────── */
static void serve_file(int client_fd, const char *filepath) {
    /* Verificar se o arquivo existe */
    struct stat st;
    if (stat(filepath, &st) < 0 || S_ISDIR(st.st_mode)) {
        /* 404 */
        const char *not_found =
            "HTTP/1.1 404 Not Found\r\n"
            "Content-Type: text/html; charset=utf-8\r\n"
            "Connection: close\r\n"
            "\r\n"
            "<h1>404 Not Found</h1>";
        write(client_fd, not_found, strlen(not_found));
        return;
    }

    int fd = open(filepath, O_RDONLY);
    if (fd < 0) {
        const char *err =
            "HTTP/1.1 500 Internal Server Error\r\n"
            "Connection: close\r\n\r\n";
        write(client_fd, err, strlen(err));
        return;
    }

    /* Cabeçalho HTTP */
    const char *ext  = file_ext(filepath);
    const char *mime = mime_type(ext);
    char header[512];
    int hlen = snprintf(header, sizeof(header),
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: %s\r\n"
        "Content-Length: %lld\r\n"
        "Cache-Control: public, max-age=3600\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Connection: close\r\n"
        "\r\n",
        mime, (long long)st.st_size);
    write(client_fd, header, hlen);

    /* Enviar conteúdo do arquivo */
    char buf[BUF_SIZE];
    ssize_t n;
    while ((n = read(fd, buf, sizeof(buf))) > 0) {
        write(client_fd, buf, n);
    }
    close(fd);
}

/* ── Processar requisição HTTP ──────────────────────────── */
static void handle_request(int client_fd) {
    char req[BUF_SIZE];
    ssize_t n = recv(client_fd, req, sizeof(req) - 1, 0);
    if (n <= 0) return;
    req[n] = '\0';

    /* Extrair método e caminho */
    char method[8], path[MAX_PATH];
    if (sscanf(req, "%7s %511s", method, path) != 2) return;

    /* Somente GET */
    if (strcmp(method, "GET") != 0) {
        const char *r = "HTTP/1.1 405 Method Not Allowed\r\nConnection: close\r\n\r\n";
        write(client_fd, r, strlen(r));
        return;
    }

    /* Decodificar %XX no caminho (básico) */
    char decoded[MAX_PATH];
    int di = 0;
    for (int si = 0; path[si] && di < MAX_PATH - 1; si++) {
        if (path[si] == '%' && path[si+1] && path[si+2]) {
            char hex[3] = { path[si+1], path[si+2], '\0' };
            decoded[di++] = (char)strtol(hex, NULL, 16);
            si += 2;
        } else {
            decoded[di++] = path[si];
        }
    }
    decoded[di] = '\0';

    /* Sanitizar path (evitar path traversal) */
    if (strstr(decoded, "..")) {
        const char *r = "HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n";
        write(client_fd, r, strlen(r));
        return;
    }

    /* Construir caminho completo */
    char fullpath[MAX_PATH];
    if (strcmp(decoded, "/") == 0) {
        snprintf(fullpath, sizeof(fullpath), "%s/index.html", WEB_ROOT);
    } else {
        snprintf(fullpath, sizeof(fullpath), "%s%s", WEB_ROOT, decoded);
    }

    serve_file(client_fd, fullpath);
}

/* ── Thread worker por conexão ──────────────────────────── */
typedef struct { int fd; } client_args_t;

static void* client_thread(void *arg) {
    client_args_t *ca = (client_args_t *)arg;
    handle_request(ca->fd);
    close(ca->fd);
    free(ca);
    return NULL;
}

/* ── Loop do servidor HTTP ─────────────────────────────── */
static void* server_thread(void *arg) {
    (void)arg;

    int srv = socket(AF_INET, SOCK_STREAM, 0);
    if (srv < 0) return NULL;

    /* Reutilizar endereço */
    int opt = 1;
    setsockopt(srv, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family      = AF_INET;
    addr.sin_port        = htons(SERVER_PORT);
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK); /* apenas localhost */

    if (bind(srv, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        close(srv);
        return NULL;
    }

    if (listen(srv, BACKLOG) < 0) {
        close(srv);
        return NULL;
    }

    printf("[UnitV] Servidor HTTP em http://localhost:%d\n", SERVER_PORT);

    while (1) {
        int client = accept(srv, NULL, NULL);
        if (client < 0) continue;

        /* Criar thread por conexão */
        client_args_t *ca = (client_args_t *)malloc(sizeof(client_args_t));
        if (!ca) { close(client); continue; }
        ca->fd = client;

        pthread_t tid;
        if (pthread_create(&tid, NULL, client_thread, ca) == 0) {
            pthread_detach(tid);
        } else {
            close(client);
            free(ca);
        }
    }

    close(srv);
    return NULL;
}

/* ── Abrir browser do PS4 ───────────────────────────────── */
static void launch_browser(void) {
    /* Aguardar o servidor subir */
    sceKernelSleep(1);

    /* Notificação na XMB */
    OrbisNotificationRequest note;
    memset(&note, 0, sizeof(note));
    note.type       = NotificationRequest;
    note.reqId      = 0;
    note.priority   = 0;
    note.msglen     = snprintf(note.message, sizeof(note.message),
                               "UnitV Pro — Iniciando...");
    note.targetId   = -1;
    sceKernelSendNotificationRequest(0, &note, sizeof(note), 0);

    /* Abrir navegador WebKit com a URL local */
    SceSystemServiceWebAppStatus status;
    SceSystemServiceWebAppParam  param;
    memset(&status, 0, sizeof(status));
    memset(&param,  0, sizeof(param));

    strncpy(param.url, APP_URL, sizeof(param.url) - 1);
    param.userId      = 0;
    param.errorPage   = 0;
    param.userdata    = 0;

    int ret = sceSystemServiceLaunchWebBrowser(param.url, NULL);
    if (ret < 0) {
        /* Fallback: tentar via LoadExec */
        char args[256];
        snprintf(args, sizeof(args), "%s", APP_URL);
        sceSystemServiceLoadExec("internet", args);
    }
}

/* ── Ponto de entrada ───────────────────────────────────── */
int main(void) {
    printf("[UnitV] UnitV Pro PS4 iniciando...\n");
    printf("[UnitV] Web root: %s\n", WEB_ROOT);

    /* Iniciar servidor HTTP em background */
    pthread_t srv_tid;
    if (pthread_create(&srv_tid, NULL, server_thread, NULL) != 0) {
        printf("[UnitV] ERRO: falha ao criar thread do servidor\n");
        return 1;
    }
    pthread_detach(srv_tid);

    /* Abrir o browser após servidor subir */
    launch_browser();

    /* Manter o processo vivo enquanto o servidor roda */
    /* O PS4 fecha o app quando o browser é fechado */
    sceKernelSleep(3600); /* 1 hora max, UI fecha antes */

    return 0;
}
