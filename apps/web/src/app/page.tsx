import { Suspense } from 'react';
import { AskLawsScreen } from './ask-laws-screen';

export default function IndexPage() {
  return (
    <main>
      <Suspense fallback={<p className="p-6">Loading Ask the Laws…</p>}>
        <AskLawsScreen />
      </Suspense>
    </main>
  );
}
