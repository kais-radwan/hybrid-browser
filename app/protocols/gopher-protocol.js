import fetchToHandler from './fetch-to-handler.js'
import makeGopher from '../dir/gopherfetch.js'

export default async function createHandler (options, session) {

  const useFetch = await makeGopher(options)

  return fetchToHandler(useFetch, session)
}