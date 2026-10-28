import { Fragment } from 'react'
import { mergeSearchHighlights } from '../lib/siteSearch'

export default function SearchHighlight({ text, ranges = [] }: { text: string; ranges?: [number, number][] }) {
  const merged = mergeSearchHighlights(text, ranges)
  return <>{merged.map(([from, to], index) => <Fragment key={from}>{text.slice(index ? merged[index - 1][1] + 1 : 0, from)}<mark>{text.slice(from, to + 1)}</mark></Fragment>)}{text.slice(merged.length ? merged[merged.length - 1][1] + 1 : 0)}</>
}
