import { WorkspaceProvider } from './state/workspaceContext';
import { Desktop } from './components/desktop/Desktop';

export function App() {
  return (
    <WorkspaceProvider>
      <Desktop />
    </WorkspaceProvider>
  );
}
