import { MatchEnemy } from "./MatchEnemy";
import { weakPointWorldPosition, type WeakPointAnchor } from "../WeakPoints";
import type { CurrentSystem } from "../CurrentSystem";

/**
 * Um ponto fraco preso ao corpo de um chefe (item 11).
 *
 * É um `MatchEnemy` no TIPO — só assim ele é mirável pelo `Targeting`, colidível pelo
 * `ProjectileCore` e alcançável por splash, corrente e área, tudo sem tipo-união atravessando meia
 * dúzia de sistemas. Mas ele NÃO entra na lista de inimigos da partida: é essa separação que o
 * mantém fora da contagem de vitória, do dano ao Recife, da recompensa de abate e do bestiário.
 */
export class MatchWeakPoint extends MatchEnemy {
  constructor(
    id: string,
    definition: MatchEnemy["definition"],
    readonly parent: MatchEnemy,
    readonly anchor: WeakPointAnchor,
    readonly index: number,
  ) {
    super(id, definition, parent.route, parent.pathId);
    this.follow();
  }

  override get isWeakPoint(): boolean {
    return true;
  }

  /** A mira preditiva precisa da velocidade do corpo em que ele está preso, não de zero. */
  override get velocity() {
    return this.parent.velocity;
  }

  override get isBlockable(): boolean {
    return false;
  }

  /** Cola no chefe: posição, direção e progresso saem todos do pai. */
  follow(): void {
    const position = weakPointWorldPosition(this.parent, this.anchor, this.parent.definition.hitRadius);
    this.x = position.x;
    this.y = position.y;
    this.heading = this.parent.heading;
    this.setPathDistance(this.parent.pathDistance);
  }

  /** Nunca anda sozinho, então nunca chega ao Recife: devolve sempre `false`. */
  override tick(now: number, _deltaMs: number, _currents: CurrentSystem): boolean {
    this.status.update?.(now);
    this.follow();
    return false;
  }
}
