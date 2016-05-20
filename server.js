import express from 'express'
import bodyParser from 'body-parser'
import pipeP from './lib/pipeP'
import { pipe, path, tap, prop, match, complement, isEmpty, filter, map, split, join, curry } from 'ramda'
import { all } from 'bluebird'
import http from 'http-as-promised'
const app = express()
const jsonParser = bodyParser.json()

const s = (json) => JSON.stringify(json, null, 2)
const echo = (v) => console.log(v)
const ej = pipe(s, echo)

const createBranch = curry((author, repo, sha, newBranch) =>
http(
  `https://api.github.com/repos/${author}/${repo}/git/refs`,
  {
    method: 'POST',
    headers: {
      'User-Agent': 'reachbot'
    },
    auth: {
      user: process.env.REACHBOT_USERNAME,
      pass: process.env.REACHBOT_PASSWORD
    },
    resolve: 'body',
    json: {
      sha,
      ref: `refs/heads/${newBranch}`
    }
  }))

  const updateFile = curry((owner, repo, path, sha, branch, message, content) =>
  http(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      method: 'PUT',
      headers: {
        'User-Agent': 'reachbot'
      },
      auth: {
        user: process.env.REACHBOT_USERNAME,
        pass: process.env.REACHBOT_PASSWORD
      },
      resolve: 'body',
      json: { message, content: new Buffer(content).toString('base64'), sha, branch }
    }))

const getBodyFromHttp = (url) =>
http(url, {
  headers: {
    'User-Agent': 'reachbot'
  },
  auth: {
    user: process.env.REACHBOT_USERNAME,
    pass: process.env.REACHBOT_PASSWORD
  },
  resolve: 'body'
})

const getJsonFromHttp = (url) => getBodyFromHttp(url).then(JSON.parse)

const filterJsFiles = filter(
  pipe(
      prop('filename'),
      match(/\.js$/),
      complement(isEmpty)
  )
)

const commentOutEverything = pipe(
  split('\n'),
  map((s) => '// ' + s),
  join('\n')
)

app.post('/webhook', jsonParser, async (req, res) => {
  const prUrl = path(['pull_request', 'url'], req.body)
  const prBranchHeadSha = path(['pull_request', 'head', 'sha'], req.body)
  const prRepoAuthor = path(['repository', 'owner', 'login'], req.body)
  const prRepoName = path(['repository', 'name'], req.body)
  const prBranchName = path(['pull_request', 'head', 'ref'], req.body)

  //ej({webhook: req.body})

  ej({prRepoAuthor, prRepoName, prBranchHeadSha, prBranchName})
  //ej({prUrl})

  const prFilesMetadata = await getJsonFromHttp(prUrl + '/files')
  const jsFilesMetadata = filterJsFiles(prFilesMetadata)

  //ej({jsFilesMetadata})

  const newBranchName = `${prBranchName}-reachSuggestions-${Math.floor((Math.random() * 1000) + 1)}`
  const newBranchRef = await createBranch(prRepoAuthor, prRepoName, prBranchHeadSha, newBranchName).then(prop('ref'))

  const processedContents = await pipeP(
    pipe(
      map(
        (jsFileMetaData) => pipeP(
          prop('contents_url'),
          getJsonFromHttp,
          tap(ej),
          prop('download_url'),
          tap(ej),
          getBodyFromHttp,
          commentOutEverything,
          (newContents) => ({newContents, jsFileMetaData}) // TODO remove this weird device
        )(jsFileMetaData)
      ),
      all
    )
  )(jsFilesMetadata)

  for (let processedContent of processedContents) {
    const update = await updateFile(
      prRepoAuthor,
      prRepoName,
      processedContent.jsFileMetaData.filename,
      processedContent.jsFileMetaData.sha,
      newBranchName,
      `commenting out: ${processedContent.jsFileMetaData.filename}`,
      processedContent.newContents
    ).catch(console.log)

    console.log(`update: ${update}`)
  }

  ej({newBranchRef})

  ej({processedContents})

  res.send(s(req.body))
})

app.listen(3000, () => {
  console.log('Example app listening on port 3000!')
})
