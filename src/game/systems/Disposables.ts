import { devAssert, lifecycleLog } from "./devLog";

/**
 * Registro de limpeza (item 8). O `SHUTDOWN` da `GameScene` desfazia tudo num bloco só, em ordem de
 * escrita: se um `destroy()` estourasse no meio, os seguintes nunca rodavam e a partida seguinte
 * herdava listeners e áudio da anterior. Aqui cada limpeza é nomeada, roda isolada e em ordem
 * inversa da criação, e uma que falhe não leva as outras junto.
 */
export class Disposables {
  private readonly entries: Array<{ label: string; dispose: () => void }> = [];
  private disposed = false;

  add(label: string, dispose: () => void): void {
    if (this.disposed) {
      devAssert(false, "Disposables.add depois do disposeAll", { label });
      return;
    }
    this.entries.push({ label, dispose });
  }

  get size(): number {
    return this.entries.length;
  }

  /** Idempotente: chamar duas vezes não repete nada nem quebra. */
  disposeAll(): void {
    if (this.disposed) return;
    this.disposed = true;
    lifecycleLog("disposables", "disposeAll", { count: this.entries.length });
    for (let index = this.entries.length - 1; index >= 0; index -= 1) {
      const entry = this.entries[index];
      try {
        entry.dispose();
      } catch (error) {
        devAssert(false, `limpeza falhou: ${entry.label}`, { error: String(error) });
      }
    }
    this.entries.length = 0;
  }
}
