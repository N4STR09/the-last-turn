import { AccountPanel } from '../components/AccountPanel';
import { AppButton } from '../components/AppButton';
import { ShopPanel } from '../components/ShopPanel';

export interface StartScreenProps {
  readonly onBegin: () => void;
  /**
   * Aviso de que ha cambiado quién está dentro de la cuenta.
   *
   * Pasa por aquí y no por ninguna otra pantalla porque `AccountPanel` vive en
   * esta, y porque la cuenta sigue sin gobernar nada: esto no cambia qué se
   * enseña, solo le dice a la sesión de juego que ya hay con quién hablar de las
   * estadísticas.
   */
  readonly onSessionChange?: (autenticado: boolean) => void;
}

export function StartScreen({ onBegin, onSessionChange }: StartScreenProps) {
  return (
    <main className="screen screen--start" aria-labelledby="start-title">
      <section className="hero-panel">
        <p className="eyebrow">Supervivencia por turnos</p>
        <h1 id="start-title" tabIndex={-1}>
          The Last Turn
        </h1>
        <p className="hero-panel__lead">
          Cada decisión cuenta. Sobrevive todo lo que puedas antes de que el
          refugio, la energía o la comida te abandonen.
        </p>
        <AppButton onClick={onBegin}>Comenzar</AppButton>
        <p className="screen-note">
          La partida no se guarda: dura mientras la página permanezca abierta.
        </p>
        {/*
          * La cuenta va debajo de la nota y no encima del botón «Comenzar».
          * Entrar o salir no cambia lo que hay que elegir para jugar, y un
          * bloque de acceso entre el titular y la única acción de la pantalla
          * haría parecer que jugar exige cuenta, que es exactamente lo que no
          * es: sin cuenta se juega igual, y lo único que aporta la cuenta es
          * guardar la marca de la mejor partida. El aviso de sesión sale por
          * aquí abajo y llega hasta esa misma marca, sin tocar la pantalla.
          */}
        <AccountPanel onSessionChange={onSessionChange} />
        {/*
          * La tienda va debajo de la cuenta y no en otra pantalla: compra con
          * el saldo que la misma sesión acaba de traer, así que el sitio donde
          * se entra y se sale es también el sitio donde se gasta. Como
          * `AccountPanel`, sin cuentas no pinta nada ni hace ninguna petición.
          */}
        <ShopPanel />
      </section>
    </main>
  );
}
