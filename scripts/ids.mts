import { db, schema } from '../lib/db/index'
const programs = await db.select().from(schema.programs)
for (const p of programs) console.log(`${p.id}\t${p.name}`)
