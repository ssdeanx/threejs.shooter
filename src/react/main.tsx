import { createRoot } from 'react-dom/client';
import App from './App';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found. Ensure index.html contains <div id="root"></div>.');
}

createRoot(rootEl).render(<App />);