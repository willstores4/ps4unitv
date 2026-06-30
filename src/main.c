/**
 * main.c — UnitV Pro PS4
 * Servidor HTTP local + launcher do browser via sceSystemServiceLoadExec
 *
 * APIs usadas (confirmadas no OpenOrbis v0.5.4):
 *   - sceSystemServiceLoadExec(const char *path, const char *args[])
 *   - sceKernelSleep(uint seconds)
 *   - BSD sockets (sys/socket.h, netinet/in.h)
 *   - pthread
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
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

/* ── Configurações ──────────────────────────────── */
#define SERVER_PORT  12345
#define WEB_ROOT     "/app0/USRDIR/web"
#define APP_URL      "http://localhost:12345/"
#define BUF_SIZE     8192
#define MAX_PATH     512
#define BACKLOG      8

/* ── MIME Types ─────────────────────────────────── */
static const char* mime_type(const char *ext) {
    if (!ext) return "application/octet-stream";
    if (strcmp(ext,"html")==0||strcmp(ext,"htm")==0) return "text/html; charset=utf-8";
    if (strcmp(ext,"css") ==0) return "text/css; charset=utf-8";
    if (strcmp(ext,"js")  ==0) return "application/javascript; charset=utf-8";
    if (strcmp(ext,"json")==0) return "application/json";
    if (strcmp(ext,"png") ==0) return "image/png";
    if (strcmp(ext,"jpg") ==0||strcmp(ext,"jpeg")==0) return "image/jpeg";
    if (strcmp(ext,"gif") ==0) return "image/gif";
    if (strcmp(ext,"svg") ==0) return "image/svg+xml";
    if (strcmp(ext,"ico") ==0) return "image/x-icon";
    if (strcmp(ext,"woff")==0) return "font/woff";
    if (strcmp(ext,"woff2")==0) return "font/woff2";
    if (strcmp(ext,"m3u8")==0) return "application/vnd.apple.mpegurl";
    if (strcmp(ext,"ts")  ==0) return "video/mp2t";
    if (strcmp(ext,"mp4") ==0) return "video/mp4";
    return "application/octet-stream";
}

static const char* file_ext(const char *path) {
    const char *dot = strrchr(path, '.');
    return (dot && dot != path) ? dot + 1 : NULL;
}

/* ── Servir arquivo ─────────────────────────────── */
static void serve_file(int cfd, const char *filepath) {
    struct stat st;
    if (stat(filepath, &st) < 0 || S_ISDIR(st.st_mode)) {
        const char *r = "HTTP/1.1 404 Not Found\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n<h1>404</h1>";
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
    while ((n = read(fd, buf, sizeof(buf))) > 0) write(cfd, buf, n);
    close(fd);
}

/* ── Processar requisição ───────────────────────── */
static void handle_request(int cfd) {
    char req[BUF_SIZE];
    ssize_t n = recv(cfd, req, sizeof(req)-1, 0);
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
    for (int si = 0; path[si] && di < MAX_PATH-1; si++) {
        if (path[si]=='%' && path[si+1] && path[si+2]) {
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

/* ── Thread por conexão ─────────────────────────── */
typedef struct { int fd; } client_t;

static void* client_thread(void *arg) {
    client_t *c = (client_t*)arg;
    handle_request(c->fd);
    close(c->fd);
    free(c);
    return NULL;
}

/* ── Loop do servidor HTTP ──────────────────────── */
static void* server_loop(void *arg) {
    (void)arg;
    int srv = socket(AF_INET, SOCK_STREAM, 0);
    if (srv < 0) return NULL;

    int opt = 1;
    setsockopt(srv, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family      = AF_INET;
    addr.sin_port        = htons(SERVER_PORT);
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);

    if (bind(srv, (struct sockaddr*)&addr, sizeof(addr)) < 0 ||
        listen(srv, BACKLOG) < 0) {
        close(srv);
        return NULL;
    }

    while (1) {
        int cfd = accept(srv, NULL, NULL);
        if (cfd < 0) continue;
        client_t *c = (client_t*)malloc(sizeof(client_t));
        if (!c) { close(cfd); continue; }
        c->fd = cfd;
        pthread_t tid;
        if (pthread_create(&tid, NULL, client_thread, c) == 0)
            pthread_detach(tid);
        else { close(cfd); free(c); }
    }
    close(srv);
    return NULL;
}

/* ── Lançar browser nativo do PS4 ──────────────── */
static void launch_browser(void) {
    /* Aguardar servidor subir */
    sceKernelSleep(2);

    /*
     * sceSystemServiceLoadExec: abre o browser com a URL
     * Assinatura real (OpenOrbis):
     *   int32_t sceSystemServiceLoadExec(const char *path, const char *args[]);
     *
     * path = "internet" → inicia o browser
     * args[0] = URL, args[1] = NULL (terminador)
     */
    const char *args[] = { APP_URL, NULL };
    sceSystemServiceLoadExec("internet", args);
}

/* ── Main ───────────────────────────────────────── */
int main(void) {
    /* Iniciar servidor HTTP em background */
    pthread_t srv_tid;
    pthread_create(&srv_tid, NULL, server_loop, NULL);
    pthread_detach(srv_tid);

    /* Abrir browser */
    launch_browser();

    /* Manter processo vivo (browser fecha o app quando terminar) */
    sceKernelSleep(7200);
    return 0;
}
