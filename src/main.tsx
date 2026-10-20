import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { installApiClient } from './lib/apiClient';
import './index.css';

installApiClient();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
