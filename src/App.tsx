import { Admin } from './components/Admin';
import { Invitation } from './components/Invitation';

export function App() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('admin') === '1') {
    return <Admin onExit={() => { window.location.href = window.location.pathname; }} />;
  }
  return <Invitation />;
}
