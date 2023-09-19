import fetchToHandler from './fetch-to-handler.js'
import makeHTTP from '../dir/hhttpfetch.js'

export default async function createHandler (opt, session) {

  const useFetch = await makeHTTP(opt)

  return fetchToHandler(useFetch, session)
}
