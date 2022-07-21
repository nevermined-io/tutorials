import Catalog from '@nevermined-io/components-catalog'
import React, { useEffect, useState } from 'react'

function App() {

  const query = {
    offset: 150,
    page: 1,
    query: {},
    sort: {
      created: 'desc'
    }
  };

  const MultipleAssets = () => {
    const { isLoading: isLoadingAssets, result } = Catalog.useAssets(query)
    const [dids, setDids] = useState<string[]>()

    useEffect(() => {
      setDids(result?.results?.map(asset => asset.id))
    }, [result])

    const [filterQuery, setQuery] = useState("")

    function filterItems(query: string) {
       setQuery(query)
       setDids(result?.results?.map(asset => asset.id)?.filter(item => item.includes(query)))
     }

    return (
      <>
        <input
          type="search"
          name="search-form"
          id="search-form"
          className="search-input"
          placeholder="Search for..."
          value={filterQuery}
          onChange={(e) => filterItems(e.target.value)}
        />
        <div>Assets: </div>
        <div>
          <ul>{!isLoadingAssets ? dids?.map(asset => <li key={asset}>{asset}</li>) : "Loading assets..."}</ul>
        </div>
      </>
    )
}
  return (
    <div className="App">
      <header className="App-header">
        <MultipleAssets />
      </header>
    </div>
  );
}

export default App;