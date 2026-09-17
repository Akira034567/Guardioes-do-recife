import type { EnemyRole, GuardianId } from "../../types";
import type { StatusIcon } from "../../assets/statusArt";

/**
 * Momentos: a segunda camada do tutorial.
 *
 * O `TutorialDirector` ensina a MEXER no jogo e só existe no Recife 1. O que ele nunca ensinou é o
 * jogo em si — o que o Polvo faz, por que o ícone de caveira apareceu em cima do inimigo, por que o
 * tiro entortou dentro da correnteza. Isso não cabe numa sequência fixa de seis passos, porque não
 * acontece em ordem: depende de qual esquadrão o jogador levou e de qual fase ele abriu.
 *
 * Então aqui a regra é outra. Cada momento é um gatilho que dispara UMA VEZ NA VIDA do jogador, em
 * qualquer fase, no instante em que a coisa acontece pela primeira vez — e aponta para a aula da
 * Escola onde o assunto está inteiro.
 *
 * Três limites que existem por motivo, não por gosto:
 *
 * 1. **Um por vez, com intervalo.** A onda 1 do Recife 3 pode envenenar, atordoar, revelar e mostrar
 *    um elite no mesmo segundo. Quatro cartões empilhados não ensinam nada; viram ruído que o jogador
 *    aprende a fechar sem ler. A fila solta um de cada vez.
 * 2. **Sai o mais urgente, não o mais antigo.** A fila não é FIFO: o ícone de veneno some em quatro
 *    segundos, então a aula dele passa na frente da correnteza, que fica ali a fase inteira.
 * 3. **Nunca durante um passo do tutorial.** Enquanto a faixa está ocupada pelos seis passos do
 *    Recife 1, os momentos ficam calados: duas vozes ensinando ao mesmo tempo é pior que uma.
 * 4. **Nunca bloqueia.** Igual ao resto do tutorial — a faixa aparece, o jogo continua.
 */

/** O que o momento está ensinando. Define o ícone que aparece ao lado do texto. */
export type MomentArt = { kind: "status"; icon: StatusIcon } | { kind: "none" };

export interface Moment {
  id: string;
  /** A frase que aparece na faixa. Uma só, curta — é lida no meio de uma onda. */
  text: string;
  /** A aula da Escola que abre o assunto inteiro (`data/school.ts`). */
  lessonId: string;
  art: MomentArt;
}

/** Tudo que pode disparar um momento, colhido do quadro atual da partida. */
export interface MomentSignals {
  /** Guardiões que o jogador acabou de ter em campo nesta partida. */
  guardiansOnField: readonly GuardianId[];
  /** Status ativos em qualquer inimigo neste instante. */
  activeStatuses: readonly StatusIcon[];
  /** Tipos de invasor presentes em campo agora. */
  enemyRoles: readonly EnemyRole[];
  /** A fase tem zona de corrente natural. */
  hasCurrentZone: boolean;
  /** Há um invasor camuflado em campo (visível ou não). */
  hasCloakedEnemy: boolean;
}

/** Momento por Guardião: dispara quando ele entra em campo pela primeira vez. */
const GUARDIAN_MOMENTS: Record<GuardianId, { text: string; lessonId: string }> = {
  "pistol-shrimp": {
    text: "Camarão: tiro longo no inimigo mais adiantado. É a régua de dano do jogo.",
    lessonId: "guardiao-camarao",
  },
  jellyfish: {
    text: "Água-viva não mata: ela segura. O dano vem de quem você puser em volta.",
    lessonId: "guardiao-aguaviva",
  },
  pufferfish: {
    text: "Baiacu agarra quem passa e cobra no contato — mas o agarrão tem prazo.",
    lessonId: "guardiao-baiacu",
  },
  "reef-crab": {
    text: "Caranguejo dá o melhor dano por pérola, com alcance mínimo. Ponha-o no trecho lento.",
    lessonId: "guardiao-caranguejo",
  },
  "ink-octopus": {
    text: "Polvo rende pelos vizinhos: ele marca o alvo e o resto do esquadrão cobra a conta.",
    lessonId: "guardiao-polvo",
  },
  shark: {
    text: "Tubarão mira quem tem MENOS vida, não o mais adiantado. Deixe alguém ferir antes.",
    lessonId: "guardiao-tubarao",
  },
  "sea-turtle": {
    text: "Tartaruga segura de verdade: 9 segundos na base, contra 3,5 do Baiacu.",
    lessonId: "guardiao-tartaruga",
  },
  stonefish: {
    text: "Peixe-Pedra encaixa sozinho na borda e embosca sem parar. Você escolhe onde, não quando.",
    lessonId: "guardiao-peixe-pedra",
  },
  dolphin: {
    text: "O sonar do Golfinho revela camuflados. Sem ele, o que é invisível não leva tiro.",
    lessonId: "guardiao-golfinho",
  },
};

/** Momento por status: dispara na primeira vez que o jogador vê aquele ícone em campo. */
const STATUS_MOMENTS: Record<StatusIcon, { text: string; lessonId: string }> = {
  slow: {
    text: "Lento. Lentidões não somam: vale sempre a mais forte que estiver ativa.",
    lessonId: "efeito-lento",
  },
  stun: {
    text: "Atordoado. Contra elite e chefe, cada atordoamento seguido vale menos que o anterior.",
    lessonId: "efeito-atordoado",
  },
  poison: {
    text: "Envenenado. O único efeito que ACUMULA — até 2 doses — e ignora armadura.",
    lessonId: "efeito-envenenado",
  },
  vulnerable: {
    text: "Vulnerável: recebe mais dano de TODO o esquadrão. Não soma; vale a maior marca.",
    lessonId: "efeito-vulneravel",
  },
  revealed: {
    text: "Revelado. Enquanto durar, o camuflado vira alvo como qualquer outro.",
    lessonId: "efeito-revelado",
  },
};

/** Momentos de campo: correnteza e tipos de invasor. */
const FIELD_MOMENTS: readonly Moment[] = [
  {
    id: "momento-correnteza",
    text: "Correnteza: muda a velocidade de quem atravessa E entorta o projétil que passa por ela.",
    lessonId: "corrente-mapa",
    art: { kind: "none" },
  },
  {
    id: "momento-camuflado",
    text: "Camuflado em campo: ninguém mira o que não vê. Revele com sonar ou prenda na rota.",
    lessonId: "ameaca-camuflado",
    art: { kind: "status", icon: "revealed" },
  },
  {
    id: "momento-cardume",
    text: "Cardume: o gargalo é quantos você mata por segundo, não quanto dano dá por tiro.",
    lessonId: "ameaca-cardume",
    art: { kind: "none" },
  },
  {
    id: "momento-blindado",
    text: "Blindado: a armadura corta uma fração de CADA golpe — golpe pequeno sofre mais.",
    lessonId: "ameaca-blindado",
    art: { kind: "none" },
  },
  {
    id: "momento-veloz",
    text: "Veloz: mais dano não resolve. Lentidão e bloqueio, sim — ele precisa ficar no seu alcance.",
    lessonId: "ameaca-veloz",
    art: { kind: "none" },
  },
  {
    id: "momento-elite",
    text: "Elite: resiste a controle repetido e ocupa DUAS vagas de bloqueio.",
    lessonId: "ameaca-elite",
    art: { kind: "none" },
  },
  {
    id: "momento-chefe",
    text: "Chefe: não é preso nem empurrado, e tira 10 de vida do Recife se chegar.",
    lessonId: "ameaca-chefe",
    art: { kind: "none" },
  },
];

const ROLE_MOMENT: Partial<Record<EnemyRole, string>> = {
  swarm: "momento-cardume",
  armored: "momento-blindado",
  fast: "momento-veloz",
  elite: "momento-elite",
  boss: "momento-chefe",
};

export const MOMENTS: readonly Moment[] = [
  ...Object.entries(GUARDIAN_MOMENTS).map(([guardianId, moment]) => ({
    id: `momento-guardiao-${guardianId}`,
    text: moment.text,
    lessonId: moment.lessonId,
    art: { kind: "none" } as MomentArt,
  })),
  ...Object.entries(STATUS_MOMENTS).map(([icon, moment]) => ({
    id: `momento-status-${icon}`,
    text: moment.text,
    lessonId: moment.lessonId,
    art: { kind: "status", icon: icon as StatusIcon } as MomentArt,
  })),
  ...FIELD_MOMENTS,
];

const BY_ID: ReadonlyMap<string, Moment> = new Map(MOMENTS.map((moment) => [moment.id, moment]));

/**
 * Prioridade de ensino: quanto MENOR, mais cedo sai da fila.
 *
 * O critério é quanto tempo a coisa fica visível. O ícone de veneno some do inimigo em quatro
 * segundos — se a aula dele esperar atrás de cinco outras, ela chega quando não há mais nada na tela
 * para olhar, e explicar um ícone ausente não ensina nada. A correnteza, ao contrário, fica ali a
 * fase inteira e pode esperar. O Guardião é o último porque foi o jogador quem o escolheu: ele já
 * tem algum palpite sobre o que aquilo faz.
 *
 * Sem isto a fila era FIFO pura, e numa fase movimentada as aulas de status levavam minutos para
 * aparecer, atrás das de campo que entraram no primeiro quadro.
 */
const PRIORITY: ReadonlyArray<readonly [prefix: string, rank: number]> = [
  ["momento-status-", 0],
  ["momento-camuflado", 1],
  ["momento-cardume", 2],
  ["momento-veloz", 2],
  ["momento-blindado", 2],
  ["momento-elite", 2],
  ["momento-chefe", 2],
  ["momento-correnteza", 3],
  ["momento-guardiao-", 4],
];

export function priorityOf(id: string): number {
  for (const [prefix, rank] of PRIORITY) if (id.startsWith(prefix)) return rank;
  return PRIORITY.length;
}

/** Os momentos que os sinais deste quadro justificam. A ordem de saída é a de `priorityOf`. */
export function momentsFor(signals: MomentSignals): string[] {
  const ids: string[] = [];
  for (const icon of signals.activeStatuses) ids.push(`momento-status-${icon}`);
  if (signals.hasCloakedEnemy) ids.push("momento-camuflado");
  for (const role of signals.enemyRoles) {
    const id = ROLE_MOMENT[role];
    if (id) ids.push(id);
  }
  if (signals.hasCurrentZone) ids.push("momento-correnteza");
  for (const guardianId of signals.guardiansOnField) ids.push(`momento-guardiao-${guardianId}`);
  return ids.sort((a, b) => priorityOf(a) - priorityOf(b));
}

/**
 * Intervalo mínimo entre um momento e o próximo.
 *
 * Longo de propósito. O momento não é um alerta: é uma frase para ler. Encavalar dois em cinco
 * segundos transforma o tutorial no balão que o jogador aprende a ignorar.
 */
export const MOMENT_GAP_MS = 14_000;

/** Quanto tempo a faixa fica na tela antes de sair sozinha. */
export const MOMENT_HOLD_MS = 9_000;

/**
 * Fila de momentos de uma partida.
 *
 * Recebe os sinais a cada quadro do HUD, descarta o que já foi ensinado alguma vez, e solta um de
 * cada vez respeitando o intervalo. O que ela marca como visto nunca mais volta — nem nesta partida,
 * nem nas próximas.
 */
export class MomentQueue {
  private readonly seen: Set<string>;
  private readonly queued: string[] = [];
  private showing: { moment: Moment; until: number } | null = null;
  private nextAllowedAt = 0;

  constructor(seen: readonly string[] = []) {
    this.seen = new Set(seen);
  }

  /** Tudo que já foi ensinado, para o save. */
  get seenIds(): string[] {
    return [...this.seen];
  }

  /**
   * Avança a fila e devolve o momento que deve estar na faixa agora.
   *
   * `muted` cala tudo sem perder os sinais — é o que mantém o tutorial básico com a palavra enquanto
   * ele ainda está rodando.
   */
  update(now: number, signals: MomentSignals, muted = false): Moment | null {
    for (const id of momentsFor(signals)) {
      if (this.seen.has(id) || this.queued.includes(id)) continue;
      if (!BY_ID.has(id)) continue;
      this.queued.push(id);
    }
    if (this.showing) {
      if (now < this.showing.until) return this.showing.moment;
      this.showing = null;
      this.nextAllowedAt = now + MOMENT_GAP_MS;
    }
    if (muted || now < this.nextAllowedAt) return null;
    // Não é FIFO: sai o mais urgente que estiver esperando, mesmo que tenha entrado por último.
    if (this.queued.length === 0) return null;
    let best = 0;
    for (let index = 1; index < this.queued.length; index += 1) {
      if (priorityOf(this.queued[index]) < priorityOf(this.queued[best])) best = index;
    }
    const [id] = this.queued.splice(best, 1);
    if (!id) return null;
    const moment = BY_ID.get(id);
    if (!moment) return null;
    // Marcado como visto ao ENTRAR na tela, não ao sair: se o jogador fechar o jogo no meio da onda,
    // a frase não volta na próxima partida como se nada tivesse acontecido.
    this.seen.add(id);
    this.showing = { moment, until: now + MOMENT_HOLD_MS };
    return moment;
  }

  /** "PULAR" na faixa: some com o que está na tela e cala a fila por um intervalo. */
  dismiss(now: number): void {
    this.showing = null;
    this.nextAllowedAt = now + MOMENT_GAP_MS;
  }
}
