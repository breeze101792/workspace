import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/global.css';
import './styles/desktop.css';
import './styles/window.css';
import './styles/windows/markdown.css';
import './styles/windows/text.css';
import './styles/windows/html.css';
import './styles/windows/image.css';
import './styles/windows/explorer.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
