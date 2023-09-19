import fetchToHandler from './fetch-to-handler.js'
import makeGemini from '../dir/geminifetch.js'

export default async function createHandler (options, session) {

  const useFetch = await makeGemini(options)

  return fetchToHandler(useFetch, session)
}