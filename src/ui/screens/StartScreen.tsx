import { AppButton } from '../components/AppButton';

export interface StartScreenProps {
  readonly onBegin: () => void;
}

export function StartScreen({ onBegin }: StartScreenProps) {
  return (
    <main className="screen screen--start" aria-labelledby="start-title">
      <section className="hero-panel">
        <p className="eyebrow">Supervivencia por turnos</p>
        <h1 id="start-title" tabIndex={-1}>
          The Last Turn
        </h1>
        <p className="hero-panel__lead">
          Cada decisión cuenta. Overvive todo lo que puedas antes de que el
          refugio, la energía o la comida te abandonen.
        </p>
        <AppButton onClick={onBegin}>Comenzar</AppButton>
        <p className="screen-note">
          La partida no se guarda: dura mientras la página permanezca abierta.
        </p>
      </section>
    </main>
  );
}
