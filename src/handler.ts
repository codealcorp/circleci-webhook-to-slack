import {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  APIGatewayProxyEventHeaders
} from 'aws-lambda'
import {SSM} from 'aws-sdk'
import CryptoJS from 'crypto-js'
import {WebHookWorkflowCompletedPayload} from './circleci'

const ssm = new SSM()

const getSecret = async () => {
  const result = await ssm
    .getParameter({Name: process.env.SECRET, WithDecryption: true})
    .promise()
  return result.Parameter?.Value
}

const getSlackWebHookUrl = async () => {
  const result = await ssm
    .getParameter({Name: process.env.SLACK_WEBHOOK_URL, WithDecryption: true})
    .promise()
  return result.Parameter?.Value
}

const getSignatureFromHeader = (header: APIGatewayProxyEventHeaders) => {
  const signature = header['circleci-signature']
  if (!signature) {
    return null
  }

  const circleCISig = Object.fromEntries(
    signature.split(',').map((s) => {
      const [k, v] = s.split('=')
      return [k, v]
    })
  )

  return circleCISig['v1']
}

const checkSignature = async (signature: string, body: string) => {
  const secret = await getSecret()

  if (!secret) {
    return false
  }

  const digest = CryptoJS.HmacSHA256(body, secret).toString(CryptoJS.enc.Hex)
  return signature === digest
}

export async function webhoook(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const signature = getSignatureFromHeader(event.headers)
  const slackWebHookUrl = await getSlackWebHookUrl()
  if (!event.body) {
    return {
      statusCode: 400,
      headers: {},
      body: 'Body not found'
    }
  }

  if (!slackWebHookUrl) {
    return {
      statusCode: 400,
      headers: {},
      body: 'Slack webhook URL is not found'
    }
  }

  if (!signature) {
    return {
      statusCode: 400,
      headers: {},
      body: 'Signature is not found'
    }
  }

  if (!(await checkSignature(signature, event.body))) {
    return {
      statusCode: 400,
      headers: {},
      body: 'Signature mismatch'
    }
  }

  const body = JSON.parse(event.body) as WebHookWorkflowCompletedPayload

  let repoName = ''
  const matchedRepo = (body.pipeline?.vcs?.origin_repository_url || '').match(
    /^https:\/\/github\.com\/(.+)$/
  )
  if (matchedRepo) {
    repoName = matchedRepo[1]
  }

  let text = ''
  if (body.workflow.status === 'success') {
    text += ':white_check_mark: '
  } else {
    text += ':red_circle: '
  }
  // only for github
  text += `${body.workflow.status || ''}: `
  text += `Workflow (<${body.workflow.url}|${body.workflow.name}> `
  text += `in <${body.pipeline.vcs?.origin_repository_url || ''}|${repoName}> `
  text += `(<${body.pipeline.vcs?.origin_repository_url || ''}/tree/${
    body.pipeline.vcs?.branch || ''
  }|${body.pipeline.vcs?.branch || ''}>)\n`
  text += `${body.pipeline.vcs?.commit?.body || ''} (<${
    body.pipeline?.vcs?.origin_repository_url || ''
  }/commit/${body.pipeline.vcs?.revision || ''}|${(
    body.pipeline.vcs?.revision || ''
  ).substring(0, 7)}> by ${body.pipeline.vcs?.commit?.author?.name || ''})`

  const response = await fetch(slackWebHookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: text
          }
        }
      ]
    })
  })
  if (response.ok) {
    return {
      statusCode: 200,
      headers: {},
      body: ''
    }
  }

  console.error(response)
  return {
    statusCode: 500,
    headers: {},
    body: 'Failed to request Slack WebHook'
  }
}
