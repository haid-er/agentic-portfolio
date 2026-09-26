'use client'
/**
 * Keeps a render error inside one editor form (for example JSON applied with a
 * missing key) from taking the whole page, and the unsaved edits, down with it.
 * The form state lives in EditorShell, above this boundary, so nothing is lost;
 * "Revert" restores the last state that rendered.
 */
import { Component, useEffect, type ReactNode } from 'react'
import { Button, Icon } from '@/components/ui'

interface Props {
  children: ReactNode
  /** Put the form back to the last state that rendered. */
  onRevert: () => void
  /** Called after every successful render of the children. */
  onRendered: () => void
  /** The form data: a new value (e.g. fixed JSON applied) retries the render. */
  resetKey: unknown
}

/** Its effect only runs when the subtree committed without throwing. */
function Rendered({ onRendered }: { onRendered: () => void }) {
  useEffect(() => { onRendered() })
  return null
}

export class EditorBoundary extends Component<Props, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  revert = () => {
    this.props.onRevert()
    this.setState({ error: null })
  }

  render() {
    if (!this.state.error) {
      return (
        <>
          {this.props.children}
          <Rendered onRendered={this.props.onRendered} />
        </>
      )
    }
    return (
      <div role="alert" className="grid gap-s3 p-s4 bg-surface border border-danger rounded-1">
        <p className="m-0 font-semibold text-danger flex items-center gap-2">
          <Icon name="alert" size={18} /> The form cannot show this data
        </p>
        <p className="m-0 text-0 text-ink-2">
          The last change left the collection in a shape the form does not understand ({this.state.error.message}).
          Nothing was saved. Revert to the last state that worked, or fix it in “Edit as JSON” below.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="primary" icon="refresh" onClick={this.revert}>Revert to last valid state</Button>
        </div>
      </div>
    )
  }
}
