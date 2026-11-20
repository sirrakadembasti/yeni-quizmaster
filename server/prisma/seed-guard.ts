import fs from 'node:fs';
import path from 'node:path';

// seed tüm iş verisini siler. Üretimde ya da kurulumu tamamlanmış (installation.lock) bir örnekte
// yalnız QUIZMASTER_ALLOW_SEED=1 ile bilinçli olarak çalıştırılabilir.
export function assertSeedAllowed(env: NodeJS.ProcessEnv, dataRoot: string): void {
  if (env.QUIZMASTER_ALLOW_SEED === '1') return;
  const production = env.NODE_ENV === 'production';
  const installed = fs.existsSync(path.join(dataRoot, 'installation.lock'));
  if (!production && !installed) return;
  throw new Error(
    `seed tüm verileri siler ve ${production ? 'üretimde' : 'kurulu bir örnekte (installation.lock mevcut)'} çalıştırılmaz. ` +
    'Gerçekten istiyorsanız QUIZMASTER_ALLOW_SEED=1 ile yeniden çalıştırın.',
  );
}
