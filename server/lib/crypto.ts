/**
 * 敏感配置加密（AES-256-GCM）
 * 密钥由环境变量 AI_SECRET / JWT_SECRET 派生，仅服务端可见。
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import dotenv from 'dotenv'

let cachedKey: Buffer | null = null

function getKey(): Buffer {
  if (!cachedKey) {
    dotenv.config()
    const secret = process.env.AI_SECRET || process.env.JWT_SECRET || 'dev-secret'
    cachedKey = scryptSync(secret, 'esp32-classroom-ai', 32)
  }
  return cachedKey
}

/** 加密，输出格式：v1:<iv>:<tag>:<data>（均为 hex） */
export function encryptSecret(plain: string): string {
  if (!plain) return ''
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [
    'v1',
    iv.toString('hex'),
    cipher.getAuthTag().toString('hex'),
    data.toString('hex'),
  ].join(':')
}

/** 解密；格式错误或密钥不匹配时返回空字符串 */
export function decryptSecret(enc: string): string {
  if (!enc) return ''
  const [version, ivHex, tagHex, dataHex] = enc.split(':')
  if (version !== 'v1' || !ivHex || !tagHex || !dataHex) return ''
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      getKey(),
      Buffer.from(ivHex, 'hex'),
    )
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
    const data = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ])
    return data.toString('utf8')
  } catch {
    return ''
  }
}
