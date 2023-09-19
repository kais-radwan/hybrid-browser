import fetchToHandler from './fetch-to-handler.js'
import makeLayer from '../dir/lokfetch.js'

export default async function createHandler (options, session) {

  const useFetch = await makeLayer(options)

  return fetchToHandler(useFetch, session)
}