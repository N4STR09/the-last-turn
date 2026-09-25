import type { Difficulty } from '../../game/types';

export interface SkullProps {
  /**
   * En Agonía la calavera lleva cuernos y los ojos cambian a rojo con aura. En
   * Normal es una calavera corriente. No hay un tercer caso: el motor solo
   * produce esos dos valores de dificultad.
   */
  readonly difficulty: Difficulty;
}

/**
 * Calavera de fondo para la terminal. Es decorativa y va marcada como tal para
 * lectores de pantalla: la difficulty ya la anuncia el texto de la partida.
 *
 * Va en línea y no como archivo para no añadir una petición de red. El color lo
 * pone CSS con `currentColor`, y los huecos de los ojos se rellenan con el color
 * del panel para que lean como huecos y no como manchas.
 */
export function Skull({ difficulty }: SkullProps) {
  const isAgony = difficulty === 'agony';

  return (
    <svg
      aria-hidden="true"
      className="skull"
      data-difficulty={difficulty}
      focusable="false"
      viewBox="0 0 240 260"
      xmlns="http://www.w3.org/2000/svg"
    >
      {isAgony ? (
        <g className="skull__horns">
          <path d="M48 68C26 54 15 27 29 6c4 22 16 39 34 47z" />
          <path d="M192 68c22-14 33-41 19-62-4 22-16 39-34 47z" />
        </g>
      ) : null}
      <path
        className="skull__cranium"
        d="M120 16C60 16 26 58 26 108c0 26 10 44 26 57 8 7 10 15 10 25 0 12 10 22 24 24h68c14-2 24-12 24-24 0-10 2-18 10-25 16-13 26-31 26-57 0-50-34-92-94-92z"
      />
      <g className="skull__sockets">
        <ellipse cx="84" cy="110" rx="27" ry="31" />
        <ellipse cx="156" cy="110" rx="27" ry="31" />
      </g>
      <path className="skull__nose" d="M120 134l19 46h-38z" />
      <g className="skull__teeth">
        <path d="M88 190h64M88 203h64" />
        <path d="M99 190v24M110 190v24M120 190v24M130 190v24M141 190v24" />
      </g>
    </svg>
  );
}
