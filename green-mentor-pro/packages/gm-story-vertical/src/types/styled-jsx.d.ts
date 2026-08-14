// The vendored viz-engine uses Next's styled-jsx (<style jsx global>) in
// MapboxBackground. Inside a Next app those attributes are typed by
// styled-jsx's own augmentation; this package typechecks standalone, so it
// carries the same augmentation as a shim.
import 'react'

declare module 'react' {
  interface StyleHTMLAttributes<T> extends HTMLAttributes<T> {
    jsx?: boolean
    global?: boolean
  }
}
