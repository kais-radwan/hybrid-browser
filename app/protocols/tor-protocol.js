import fetchToHandler from './fetch-to-handler.js'
import makeOnion from '../dir/torfetch.js'

export default async function createHandler (options, session) {

  const useFetch = await makeOnion(options)

  return fetchToHandler(useFetch, session)
}