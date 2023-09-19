import fetchToHandler from './fetch-to-handler.js'
import getTheFetch from '../dir/hyperfetch.js'

export default async function createHandler (options, session) {

  const {makeHyper, close} = await getTheFetch(options)
  
  return { handler: fetchToHandler(makeHyper, session), close }
}
