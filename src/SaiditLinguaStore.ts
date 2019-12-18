import {
  ExpressLikeStore,
  LinguaWebcaClient,
  LinguaWebcaStore,
  PathPrefixedStore,
  SwitchingStore,
  webca as universe
} from '@lingua-webca/core'
import { parse as parseQuery } from 'query-string'
import { filter, map, pathOr, pipe, prop, range } from 'ramda'
import { parse as uriParse } from 'uri-js'

const getListingThings = pipe(
  pathOr([], ['data', 'children']),
  map(prop('data')),
  filter(d => !!d)
)

const ID_BASE = 36
const MAX_INFO_THINGS = 100

export function createSpecificSaiditStore(
  host: string,
  webca: LinguaWebcaClient = universe
): LinguaWebcaStore {
  const app = new ExpressLikeStore()

  app.get('/things/:kind/after/:lastId', async (req, res) => {
    const { kind, lastId } = req.params
    const query = parseQuery(req.query || '')
    const limit = Math.min(
      MAX_INFO_THINGS,
      parseInt(query.limit as string, 10) || MAX_INFO_THINGS
    )
    const firstIdNum = parseInt(lastId, ID_BASE) + 1
    const lastIdNum = firstIdNum + limit
    const idNums = range(firstIdNum, lastIdNum)
    const fullIds = idNums.map(idNum => `${kind}_${idNum.toString(ID_BASE)}`)
    const apiRes = await webca.get(
      `http://${host}/api/info.json?id=${fullIds.join(',')}`
    )
    const children = getListingThings(apiRes)

    res.json(children)
  })

  return app.request
}

export function createSaiditStore(
  webca: LinguaWebcaClient = universe
): LinguaWebcaStore {
  const storeCache: Record<string, LinguaWebcaStore> = {}

  return SwitchingStore.create(request => {
    const { scheme, host, port, userinfo } = uriParse(request.uri)

    // tslint:disable-next-line: no-if-statement
    if (scheme !== 'saidit') {
      return () =>
        Promise.resolve({
          body: `Invalid saidit uri scheme ${scheme}`,
          code: 500,
          request,
          uri: request.uri
        })
    }

    // tslint:disable-next-line: no-if-statement
    if (!host) {
      return () =>
        Promise.resolve({
          body: `Invalid saidit uri host`,
          code: 500,
          request,
          uri: request.uri
        })
    }

    const basePath = `${scheme}://${userinfo ? `${userinfo}@` : ''}${host}${
      port ? `:${port}` : ''
    }`

    // tslint:disable-next-line: no-let
    let store = storeCache[host]

    if (!store) {
      store = PathPrefixedStore.create(
        basePath,
        createSpecificSaiditStore(host, webca)
      )
    }

    return store
  })
}

export const SaiditLinguaStore = {
  create: createSaiditStore,
  createSpecific: createSpecificSaiditStore
}
