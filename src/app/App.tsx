import { useRef } from 'react';

import { DifficultyScreen } from '../ui/screens/DifficultyScreen';
import { GameOverScreen } from '../ui/screens/GameOverScreen';
import { GameScreen } from '../ui/screens/GameScreen';
import { StartScreen } from '../ui/screens/StartScreen';
import { useGameSession } from './use-game-session';
import { useScreenFocus } from './screen-focus';

export function App() {
  const session = useGameSession();
  const rootRef = useRef<HTMLDivElement>(null);
  useScreenFocus(session.state.screen, rootRef);

  return (
    <div ref={rootRef} className="app-root">
      {session.state.screen === 'start' ? (
        <StartScreen onBegin={session.showDifficulty} />
      ) : null}
      {session.state.screen === 'difficulty' ? (
        <DifficultyScreen onSelect={session.selectDifficulty} />
      ) : null}
      {session.state.screen === 'playing' ? (
        <GameScreen
          model={session.gameModel!}
          onAction={session.performAction}
        />
      ) : null}
      {session.state.screen === 'dead' ? (
        <GameOverScreen
          model={session.gameOverModel!}
          onRestart={session.restart}
        />
      ) : null}
    </div>
  );
}
