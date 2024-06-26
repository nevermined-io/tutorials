import Providers from '@/layout/Providers'
import { AppProps } from 'next/app'

const App = ({ Component, pageProps, ...appProps }: AppProps) => {
  return (
    <div className="App">
      <header className="App-header">
        <Providers>
          <Component {...pageProps}/>
        </Providers>
      </header>
    </div>
  )
}


export default App
