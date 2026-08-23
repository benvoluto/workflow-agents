import { eq } from 'drizzle-orm'
import { db, schema } from '../lib/db/index'
const ref = process.argv[2] ?? 'AWD-1041'
const [r] = await db.select().from(schema.records).where(eq(schema.records.ref, ref))
console.log(r?.id ?? 'not-found')
