import fetchToHandler from './fetch-to-handler.js'
import makeIndex from '../dir/ouifetch.js'

export default async function createHandler (options, session) {

  const useFetch = await makeIndex(options)

  return fetchToHandler(useFetch, session)
}
