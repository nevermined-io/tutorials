import React from 'react'
import ReactDOM from 'react-dom'
import './index.css'
import App from './App'
import Catalog from '@nevermined-io/components-catalog'
import { appConfig } from './config'
import reportWebVitals from './reportWebVitals'

ReactDOM.render(
  <div>
    <Catalog.NeverminedProvider config={appConfig}>
        <App />
    </Catalog.NeverminedProvider>
  </div>,
  document.getElementById('root') as HTMLElement
)

reportWebVitals();
