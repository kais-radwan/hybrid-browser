import fetchToHandler from './fetch-to-handler.js'
import makeGarlic from '../dir/iipfetch.js'

export default async function createHandler (options, session) {

  const useFetch = await makeGarlic(options)

  return fetchToHandler(useFetch, session)
}