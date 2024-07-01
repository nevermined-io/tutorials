export type AssetTypeSearchFilter =
  | 'subscription'
  | 'service'
  | 'assistant'
  | 'dataset'
  | 'model'
  | 'algorithm'
  | 'file'
  | 'other'
  | 'asset'
  | 'datasetassets'

  export const textFilter = (searchInputText = '') => ({
    nested: {
      path: ['service'],
      query: {
        query_string: { query: `*${searchInputText}*`, fields: ['service.attributes.main.name'] },
      },
    },
  })


export const isListedFilter = () => ({
    bool: {
      should: [
        {
          bool: {
            must_not: [
              {
                nested: {
                  path: ['service'],
                  query: {
                    term: {
                      'service.attributes.curation.isListed': false,
                    },
                  },
                },
              },
            ],
          },
        },
      ],
    },
  })


  export const assetTypeFilter = (assetType: AssetTypeSearchFilter) => {
    const filter: { [field: string]: unknown }[] = [
      {
        match: { 'service.type': 'metadata' },
      },
      {
        match: {
          'service.attributes.main.nftType': 'nft1155-credit',
        },
      },
    ]
  
    if (assetType === 'asset') {
      filter.push({
        bool: {
          must_not: [
            {
              match: {
                'service.attributes.main.type': 'subscription',
              },
            },
          ],
        },
      })
    } else if (assetType === 'datasetassets') {
      filter.push({
        bool: {
          must_not: [
            {
              match: {
                'service.attributes.main.type': 'subscription',
              },
            },
            {
              match: {
                'service.attributes.main.type': 'service',
              },
            },
          ],
        },
      })
    } else {
      filter.push({
        match: {
          'service.attributes.main.type': assetType,
        },
      })
    }
  
    return {
      nested: {
        path: ['service'],
        query: {
          bool: {
            filter,
          },
        },
      },
    }
  }


  export const nftTokenIdFilter = (tokenIds: string[]) => ({
    nested: {
      path: ['service'],
      query: {
        bool: {
          should: tokenIds?.map((tokenId) => ({
            match: {
              'service.attributes.serviceAgreementTemplate.conditions.parameters.value':
                tokenId.replace('did:nv:', ''),
            },
          })),
        },
      },
    },
  })