/**
 * main.c — UnitV Pro PS4
 *
 * Lançador mínimo: abre o browser nativo do PS4 com a web app local.
 * Os arquivos HTML/CSS/JS ficam em /app0/USRDIR/web/ (dentro do PKG).
 *
 * Dependências: libkernel + libSceSystemService + libc (crt1.o)
 * Sem threads, sem fork, sem sockets.
 */

#include <orbis/libkernel.h>
#include <orbis/SystemService.h>

int main(void) {
    /*
     * Pequena pausa para o sistema PS4 inicializar o contexto do app.
     * sceKernelSleep está em libkernel.
     */
    sceKernelSleep(1);

    /*
     * Abrir o browser nativo do PS4 apontando para o index.html local.
     * /app0/ é o mount point do PKG dentro do sandbox do app.
     *
     * Assinatura (OpenOrbis):
     *   int32_t sceSystemServiceLoadExec(const char *path, const char *args[]);
     *
     * path  = "internet"  → launcher do browser WebKit
     * args[0] = URL a abrir
     * args[1] = NULL (terminador obrigatório)
     */
    const char *args[] = {
        "file:///app0/USRDIR/web/index.html",
        NULL
    };

    sceSystemServiceLoadExec("internet", args);

    /* Não deve chegar aqui (LoadExec substitui o processo).
     * Caso falhe, aguarda 60s e encerra. */
    sceKernelSleep(60);
    return 0;
}
