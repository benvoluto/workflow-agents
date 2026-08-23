import { SAMPLES } from './samples.generated'

/**
 * The sample list as the picker needs it: names only.
 *
 * The bodies are several kilobytes each and are only ever read on the server,
 * so passing the full objects to a client component would put them in the RSC
 * payload of every page that renders the upload dialog.
 */
export const SAMPLE_OPTIONS = SAMPLES.map(({ id, program, name }) => ({
  id,
  program,
  name,
}))
