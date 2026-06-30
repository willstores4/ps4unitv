/**
 * main.c — UnitV Pro PS4
 *
 * Servidor HTTP local (single-threaded com select) + launcher do browser.
 * Sem dependência de libScePthread — usa apenas:
 *   - libkernel  (sceKernelSleep, sceKernelFork)
 *   - libSceLibcInternal (libc)
 *   - libSceSystemService (sceSystemServiceLoadExec)
 *   - BSD sockets (sys/socket.h) via libkernel
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <sys/select.h>
#include <netinet/in.h>
#include <unistd.h>
#include <fcntl.h>
#include <errno.h>
#include <orbis/libkernel.h>
#include <orbis/SystemService.h>

/* ── Configurações ─────────────────────────────────── */
#define SERVER_PORT  12345
#define WEB_ROOT     "/app0/USRDIR/web"
#define APP_URL      "http://localhost:12345/"
#define BUF_SIZE     8192
#define MAX_PATH     512
#define BACKLOG      8
#define MAX_CLIENTS  16

/* ── MIME Types ─────────────────────────────────────── */
static const char* mime_type(const char *ext) {
    if (!ext) return "application/octet-stream";
    if (!strcmp(ext,"html") || !strcmp(ext,"htm")) return "text/html; charset=utf-8";
    if (!strcmp(ext,"css"))  return "text/css; charset=utf-8";
    if (!strcmp(ext,"js"))   return "application/javascript; charset=utf-8";
    if (!strcmp(ext,"json")) return "application/json";
    if (!strcmp(ext,"png"))  return "image/png";
    if (!strcmp(ext,"jpg") || !strcmp(ext,"jpeg")) return "image/jpeg";
    if (!strcmp(ext,"gif"))  return "image/gif";
    if (!strcmp(ext,"svg"))  return "image/svg+xml";
    if (!strcmp(ext,"ico"))  return "image/x-icon";
    if (!strcmp(ext,"woff")) return "font/woff";
    if (!strcmp(ext,"woff2"))return "font/woff2";
    if (!strcmp(ext,"m3u8")) return "application/vnd.apple.mpegurl";
    if (!strcmp(ext,"ts"))   return "video/mp2t";
    if (!strcmp(ext,"mp4"))  return "video/mp4";
    return "application/octet-stream";
}

static const char* file_ext(const char *path) {
    const char *d = strrchr(path, '.');
    return (d && d != path) ? d + 1 : NULL;
}

/* ── Servir arquivo estático ─────────────────────────── */
static void serve_file(int cfd, const char *filepath) {
    struct stat st;
    if (stat(filepath, &st) < 0 || S_ISDIR(st.st_mode)) {
        const char *r =
            "HTTP/1.1 404 Not Found\r\n"
            "Content-Type: text/html\r\n"
            "Connection: close\r\n\r\n"
            "<h1>404 Not Found</h1>";
        write(cfd, r, strlen(r));
        return;
    }
    int fd = open(filepath, O_RDONLY);
    if (fd < 0) {
        const char *r = "HTTP/1.1 500 Error\r\nConnection: close\r\n\r\n";
        write(cfd, r, strlen(r));
        return;
    }
    char header[512];
    int hlen = snprintf(header, sizeof(header),
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: %s\r\n"
        "Content-Length: %lld\r\n"
        "Cache-Control: public, max-age=3600\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Connection: close\r\n\r\n",
        mime_type(file_ext(filepath)),
        (long long)st.st_size);
    write(cfd, header, hlen);
    char buf[BUF_SIZE];
    ssize_t n;
    while ((n = read(fd, buf, sizeof(buf))) > 0)
        write(cfd, buf, n);
    close(fd);
}

/* ── Processar requisição HTTP ───────────────────────── */
static void handle_client(int cfd) {
    char req[BUF_SIZE];
    ssize_t n = recv(cfd, req, sizeof(req) - 1, 0);
    if (n <= 0) return;
    req[n] = '\0';

    char method[8], path[MAX_PATH];
    if (sscanf(req, "%7s %511s", method, path) != 2) return;

    if (strcmp(method, "GET") != 0) {
        const char *r = "HTTP/1.1 405 Method Not Allowed\r\nConnection: close\r\n\r\n";
        write(cfd, r, strlen(r));
        return;
    }

    /* Decodificar %XX */
    char dec[MAX_PATH];
    int di = 0;
    for (int si = 0; path[si] && di < MAX_PATH - 1; si++) {
        if (path[si] == '%' && path[si+1] && path[si+2]) {
            char h[3] = { path[si+1], path[si+2], '\0' };
            dec[di++] = (char)strtol(h, NULL, 16);
            si += 2;
        } else {
            dec[di++] = path[si];
        }
    }
    dec[di] = '\0';

    /* Bloquear path traversal */
    if (strstr(dec, "..")) {
        const char *r = "HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n";
        write(cfd, r, strlen(r));
        return;
    }

    char fullpath[MAX_PATH];
    if (strcmp(dec, "/") == 0)
        snprintf(fullpath, sizeof(fullpath), "%s/index.html", WEB_ROOT);
    else
        snprintf(fullpath, sizeof(fullpath), "%s%s", WEB_ROOT, dec);

    serve_file(cfd, fullpath);
}

/* ── Configurar socket não-bloqueante ────────────────── */
static void set_nonblocking(int fd) {
    int flags = fcntl(fd, F_GETFL, 0);
    if (flags >= 0) fcntl(fd, F_SETFL, flags | O_NONBLOCK);
}

/* ── Main ───────────────────────────────────────────── */
int main(void) {
    /* ── Criar socket do servidor ──────────────────────── */
    int srv = socket(AF_INET, SOCK_STREAM, 0);
    if (srv < 0) return 1;

    int opt = 1;
    setsockopt(srv, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
    set_nonblocking(srv);

    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family      = AF_INET;
    addr.sin_port        = htons(SERVER_PORT);
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);

    if (bind(srv, (struct sockaddr*)&addr, sizeof(addr)) < 0 ||
        listen(srv, BACKLOG) < 0) {
        close(srv);
        return 1;
    }

    /* ── Lançar browser após 2 segundos ─────────────────── */
    /* Usamos fork para que o processo pai sirva HTTP
     * e o filho lance o browser (ou vice-versa)           */
    pid_t pid = fork();
    if (pid == 0) {
        /* Processo filho: aguardar e abrir browser */
        sceKernelSleep(2);
        const char *args[] = { APP_URL, NULL };
        sceSystemServiceLoadExec("internet", args);
        _exit(0);
    }
    /* Processo pai: loop do servidor HTTP */

    /* ── Loop select — sem threads ────────────────────── */
    int clients[MAX_CLIENTS];
    for (int i = 0; i < MAX_CLIENTS; i++) clients[i] = -1;

    while (1) {
        fd_set rfds;
        FD_ZERO(&rfds);
        FD_SET(srv, &rfds);
        int maxfd = srv;

        for (int i = 0; i < MAX_CLIENTS; i++) {
            if (clients[i] >= 0) {
                FD_SET(clients[i], &rfds);
                if (clients[i] > maxfd) maxfd = clients[i];
            }
        }

        struct timeval tv = { .tv_sec = 1, .tv_usec = 0 };
        int ready = select(maxfd + 1, &rfds, NULL, NULL, &tv);
        if (ready < 0) continue;

        /* Nova conexão */
        if (FD_ISSET(srv, &rfds)) {
            int cfd = accept(srv, NULL, NULL);
            if (cfd >= 0) {
                set_nonblocking(cfd);
                for (int i = 0; i < MAX_CLIENTS; i++) {
                    if (clients[i] < 0) {
                        clients[i] = cfd;
                        break;
                    }
                }
            }
        }

        /* Requisições pendentes */
        for (int i = 0; i < MAX_CLIENTS; i++) {
            if (clients[i] >= 0 && FD_ISSET(clients[i], &rfds)) {
                handle_client(clients[i]);
                close(clients[i]);
                clients[i] = -1;
            }
        }
    }

    close(srv);
    return 0;
}
