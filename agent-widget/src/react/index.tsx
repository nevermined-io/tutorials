import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Agent } from './agent';

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Agent />
  </BrowserRouter>
);
