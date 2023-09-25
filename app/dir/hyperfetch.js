export default async function makeHyperFetch (opts = {}) {
    const {default: mime} = await import('mime/lite.js')
    const {default: parseRange} = await import('range-parser')
    const { Readable, pipelinePromise } = await import('streamx')
    const path = await import('path')
    const DEFAULT_OPTS = {timeout: 30000}
    const finalOpts = { ...DEFAULT_OPTS, ...opts }
    const app = await (async (finalOpts) => {if(finalOpts.sdk){return finalOpts.sdk}else{const SDK = await import('hyper-sdk');const sdk = await SDK.create(finalOpts);return sdk;}})(finalOpts)
    const hyperTimeout = finalOpts.timeout
    const hostType = '_'
  
    const drives = new Map()
    const id = await (async () => {
      const drive = await app.getDrive('id')
      const check = drive.key.toString('hex')
      drives.set(check, drive)
      return check
    })()
  
    async function checkForDrive(prop){
      if(drives.has(prop)){
        return drives.get(prop)
      }
      const drive = await app.getDrive(prop)
      drives.set(drive.key.toString('hex'), drive)
      return drive
    }
  
    async function waitForStuff(useTo, mainData) {
      if (useTo.num) {
        return await Promise.race([
          new Promise((resolve, reject) => setTimeout(() => { const err = new Error(`${useTo.msg} timed out`); err.name = 'TimeoutError'; reject(err); }, useTo.num)),
          mainData
        ])
      } else {
        return await mainData
      }
    }
  
    function formatReq(hostname, pathname){
  
      const useData = {}
      if(hostname === hostType){
        useData.useHost = id
      } else {
        useData.useHost = hostname
      }
      useData.usePath = decodeURIComponent(pathname)
      return useData
    }

    function handleFormData(formdata){
        const arr = []
        for (const info of formdata.values()) {
          if (info.stream) {
            arr.push(info)
          }
        }
        return arr
    }
  
    async function saveFileData(drive, title, main, body, useOpt) {
      await pipelinePromise(Readable.from(body), drive.createWriteStream(main.usePath, useOpt))
      return 'hyper://' + path.join(title, main.usePath, info.webkitRelativePath || info.name).replace(/\\/g, "/")
    }
  
    async function saveFormData(drive, title, mid, data, useOpts) {
      const arr = []
      for (const info of data) {
        const str = path.join(mid.usePath, info.webkitRelativePath || info.name).replace(/\\/g, "/")
        await pipelinePromise(Readable.from(info.stream()), drive.createWriteStream(str, useOpts))
        arr.push('hyper://' + path.join(title, str).replace(/\\/g, "/"))
      }
      return arr
    }
  
    function getMimeType (path) {
      let mimeType = mime.getType(path) || 'text/plain'
      if (mimeType.startsWith('text/')) mimeType = `${mimeType}; charset=utf-8`
      return mimeType
    }

    async function makeHyper(url, opt){
      const session = new Request(url, opt)
        const mainURL = new URL(session.url)
        const reqHeaders = new Headers(session.headers)
        const searchParams = mainURL.searchParams
        const body = session.body
        const method = session.method
        const mainTimeout = reqHeaders.has('x-timer') || searchParams.has('x-timer') ? reqHeaders.get('x-timer') !== '0' || searchParams.get('x-timer') !== '0' ? Number(reqHeaders.get('x-timer') || searchParams.get('x-timer')) * 1000 : 0 : hyperTimeout
        const main = formatReq(decodeURIComponent(mainURL.hostname), decodeURIComponent(mainURL.pathname))

        if(method === 'HEAD'){
            const useOpt = reqHeaders.has('x-opt') || searchParams.has('x-opt') ? JSON.parse(reqHeaders.get('x-opt') || decodeURIComponent(searchParams.get('x-opt'))) : {}
            const useOpts = { ...useOpt, timeout: mainTimeout }
            
            if (reqHeaders.has('x-copy') || searchParams.has('x-copy')) {
              const useDrive = await waitForStuff({ num: useOpts.timeout, msg: 'drive' }, checkForDrive(main.useHost))
              if (path.extname(main.usePath)) {
                const useData = await useDrive.entry(main.usePath)
                if (useData) {
                  const pathToFile = JSON.parse(reqHeaders.get('x-copy') || searchParams.get('x-copy')) ? path.join(`/${useDrive.key.toString('hex')}`, useData.key).replace(/\\/g, "/") : useData.key
                  const mainDrive = await checkForDrive(id)
                  await mainDrive.put(pathToFile, await useDrive.get(useData.key))
                  const useHeaders = {}
                  useHeaders['X-Link'] = 'hyper://_' + pathToFile.replace(/\\/g, "/")
                  useHeaders['Link'] = `<${useHeaders['X-Link']}>; rel="canonical"`
                  return new Response(null, { status: 200, headers: { 'Content-Length': `${useData.value.blob.byteLength}`, ...useHeaders } })
                } else {
                  return new Response(null, { status: 400, headers: { 'X-Error': 'did not find any file' } })
                }
              } else {
                const useIdenPath = JSON.parse(reqHeaders.get('x-copy') || searchParams.get('x-copy')) ? `/${useDrive.key.toString('hex')}` : '/'
                const mainDrive = await checkForDrive(id)
                let useNum = 0
                for await (const test of useDrive.list(main.usePath)) {
                  useNum = useNum + test.value.blob.byteLength
                  const pathToFile = path.join(useIdenPath, test.key).replace(/\\/g, "/")
                  await mainDrive.put(pathToFile, await useDrive.get(test.key))
                }
                const pathToFolder = path.join(useIdenPath, main.usePath).replace(/\\/g, "/")
                const useHeaders = {}
                useHeaders['X-Link'] = 'hyper://_' + pathToFolder.replace(/\\/g, "/")
                useHeaders['Link'] = `<${useHeaders['X-Link']}>; rel="canonical"`
                return new Response(null, { status: 200, headers: { 'Content-Length': `${useNum}`, ...useHeaders } })
              }
            } else if (reqHeaders.has('x-load') || searchParams.has('x-load')) {
              const useDrive = await waitForStuff({ num: useOpts.timeout, msg: 'drive' }, checkForDrive(main.useHost))
              if (JSON.parse(reqHeaders.get('x-load') || searchParams.get('x-load'))) {
                if (path.extname(main.usePath)) {
                  const useData = await useDrive.entry(main.usePath)
                  await useDrive.get(main.usePath)
                  const useHeaders = {}
                  useHeaders['X-Link'] = `hyper://${useDrive.key.toString('hex')}${main.usePath}`
                  useHeaders['Link'] = `<${useHeaders['X-Link']}>; rel="canonical"`
                  return new Response(null, { status: 200, headers: { 'Content-Length': `${useData.value.blob.byteLength}`, ...useHeaders } })
                } else {
                  await useDrive.download(main.usePath, useOpts)
                  const useHeaders = {}
                  useHeaders['X-Link'] = `hyper://${useDrive.key.toString('hex')}${main.usePath}`
                  useHeaders['Link'] = `<${useHeaders['X-Link']}>; rel="canonical"`
                  return new Response(null, { status: 200, headers: { 'Content-Length': '0', ...useHeaders } })
                }
              } else {
                if (path.extname(main.usePath)) {
                  await useDrive.del(main.usePath)
                  const useLink = 'hyper://' + path.join(useDrive.key.toString('hex'), main.usePath).replace(/\\/g, '/')
                  return new Response(null, {status: 200, headers: {'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"`}})
                } else {
                  for await (const test of useDrive.list(main.usePath)){
                    await useDrive.del(test.key)
                  }
                  const useLink = 'hyper://' + path.join(useDrive.key.toString('hex'), main.usePath).replace(/\\/g, '/')
                  return new Response(null, { status: 200, headers: { 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"` }})
                }
              }
            } else {
              const useDrive = await waitForStuff({num: useOpts.timeout, msg: 'drive'}, checkForDrive(main.useHost))
              if (path.extname(main.usePath)) {
                const useData = await useDrive.entry(main.usePath)
                if (useData) {
                  const useLink = 'hyper://' + path.join(useDrive.key.toString('hex'), useData.key).replace(/\\/g, "/")
                  return new Response(null, { status: 200, headers: { 'Content-Length': String(useData.value.blob.byteLength), 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"` } })
                } else {
                  return new Response(null, {status: 400, headers: {'X-Error': 'did not find any file'}})
                }
              } else {
                let useNum = 0
                for await (const test of useDrive.list(main.usePath)) {
                  useNum = useNum + test.value.blob.byteLength
                }
                const useLink = 'hyper://' + path.join(useDrive.key.toString('hex'), main.usePath).replace(/\\/g, "/")
                return new Response(null, { status: 200, headers: { 'Content-Length': String(useNum), 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"` } })
              }
            }
        } else if(method === 'GET'){
            const useOpt = reqHeaders.has('x-opt') || searchParams.has('x-opt') ? JSON.parse(reqHeaders.get('x-opt') || decodeURIComponent(searchParams.get('x-opt'))) : {}
            const useOpts = { ...useOpt, timeout: mainTimeout }
        
            const mainReq = !reqHeaders.has('accept') || !reqHeaders.get('accept').includes('application/json')
            const mainRes = mainReq ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8'
        
            const useDrive = await waitForStuff({num: useOpts.timeout, msg: 'drive'}, checkForDrive(main.useHost))
            if (path.extname(main.usePath)) {
              const useData = await useDrive.entry(main.usePath)
              if (useData) {
                const useLink = 'hyper://' + path.join(useDrive.key.toString('hex'), useData.key).replace(/\\/g, "/")
                const isRanged = reqHeaders.has('Range') || reqHeaders.has('range')
                if(isRanged){
                  const ranges = parseRange(useData.value.blob.byteLength, reqHeaders.get('Range') || reqHeaders.get('range'))
                  // if (ranges && ranges.length && ranges.type === 'bytes') {
                  if ((ranges !== -1 && ranges !== -2) && ranges.type === 'bytes') {
                    const [{ start, end }] = ranges
                    const length = (end - start + 1)
                    return new Response(useDrive.createReadStream(useData.key, {start, end}), {status: 206, headers: {'Content-Type': getMimeType(useData.key), 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"`, 'Content-Length': `${length}`, 'Content-Range': `bytes ${start}-${end}/${useData.value.blob.byteLength}`}})
                  } else {
                    return new Response(mainReq ? '<html><head><title>range</title></head><body><div><p>malformed or unsatisfiable range</p></div></body></html>' : JSON.stringify('malformed or unsatisfiable range'), {status: 416, headers: {'Content-Type': mainRes, 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"`, 'Content-Length': `${useData.value.blob.byteLength}`}})
                  }
                } else {
                  return new Response(useDrive.createReadStream(useData.key), {status: 200, headers: {'Content-Type': getMimeType(useData.key), 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"`, 'Content-Length': `${useData.value.blob.byteLength}`}})
                }
              } else {
                return new Response(mainReq ? `<html><head><title>hyper://${main.useHost}${main.usePath}</title></head><body><div><p>did not find any file</p></div></body></html>` : JSON.stringify('did not find any file'), { status: 400, headers: { 'Content-Type': mainRes } })
              }
            } else {
              const useLink = 'hyper://' + path.join(useDrive.key.toString('hex'), main.usePath).replace(/\\/g, "/")
                const arr = []
              for await (const test of useDrive.readdir(main.usePath)) {
                  arr.push(path.join('/', test).replace(/\\/g, '/'))
                }
              return new Response(mainReq ? `<html><head><title>${main.usePath}</title></head><body><div><p><a href='../'>..</a></p>${arr.map((data) => {return `<p><a href="${data}">${data}</a></p>`})}</div></body></html>` : JSON.stringify(arr), {status: 200, headers: {'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"`, 'Content-Type': mainRes}})
            }
        } else if(method === 'POST'){
            const mainReq = !reqHeaders.has('accept') || !reqHeaders.get('accept').includes('application/json')
            const mainRes = mainReq ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8'
            
            const useDrive = await checkForDrive(main.useHost)
            const useName = useDrive.key.toString('hex')
            const useOpt = reqHeaders.has('x-opt') || searchParams.has('x-opt') ? JSON.parse(reqHeaders.get('x-opt') || decodeURIComponent(searchParams.get('x-opt'))) : {}
            const getSaved = reqHeaders.has('content-type') && reqHeaders.get('content-type').includes('multipart/form-data') ? await saveFormData(useDrive, useName, main, handleFormData(await session.formData()), useOpt) : await saveFileData(useDrive, useName, main, body, useOpt)
            // const useName = useDrive.key.toString('hex')
            // const saved = 'hyper://' + path.join(useName, main.usePath).replace(/\\/g, '/')
            const useLink = 'hyper://' + path.join(useName, main.usePath).replace(/\\/g, '/')
              return new Response(mainReq ? `<html><head><title>Fetch</title></head><body><div>${Array.isArray(getSaved) ? JSON.stringify(getSaved) : getSaved}</div></body></html>` : JSON.stringify(getSaved), {status: 200, headers: {'Content-Type': mainRes, 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"`}})
        } else if(method === 'DELETE'){
            const mainReq = !reqHeaders.has('accept') || !reqHeaders.get('accept').includes('application/json')
            const mainRes = mainReq ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8'
            
            const useDrive = await checkForDrive(main.useHost)
            const useOpt = reqHeaders.has('x-opt') || searchParams.has('x-opt') ? JSON.parse(reqHeaders.get('x-opt') || decodeURIComponent(searchParams.get('x-opt'))) : {}
            if (path.extname(main.usePath)) {
              const useData = await useDrive.entry(main.usePath)
              if (useData) {
                await useDrive.del(useData.key)
                const useLink = 'hyper://' + path.join(useDrive.key.toString('hex'), useData.key).replace(/\\/g, '/')
                useOpt.deleted = 'success'
                return new Response(mainReq ? `<html><head><title>Fetch</title></head><body><div>${useLink}</div></body></html>` : JSON.stringify(useLink), {status: 200, headers: {'Status': useOpt.deleted, 'Content-Type': mainRes, 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"`, 'Content-Length': `${useData.value.blob.byteLength}`}})
              } else {
                return new Response(mainReq ? '<html><head><title>range</title></head><body><div><p>did not find any file</p></div></body></html>' : JSON.stringify('did not find any file'), { status: 400, headers: { 'Content-Type': mainRes } })
              }
            } else {
                let useNum = 0
                for await (const test of useDrive.list(main.usePath)){
                  useNum = useNum + test.value.blob.byteLength
                  await useDrive.del(test.key)
              }
              const useLink = 'hyper://' + path.join(useDrive.key.toString('hex'), main.usePath).replace(/\\/g, '/')
              return new Response(mainReq ? `<html><head><title>Fetch</title></head><body><div>${useLink}</div></body></html>` : JSON.stringify(useLink), { status: 200, headers: { 'Content-Type': mainRes, 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"`, 'Content-Length': `${useNum}` } })
            }
        } else {
            throw new Error('invalid method')
        }
    }
  
    async function close(){
        for (const drive of drives.values()) {
            await drive.close()
        }
        drives.clear()
        return await app.close()
    }

    return {makeHyper, close}
  }